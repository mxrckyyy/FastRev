-- ============================================================
-- Fix Phase (Edge Function track) — quota slot accounting correction
-- Idempotent: safe to run more than once.
-- Run this in the Supabase SQL Editor AFTER 0004 (it upgrades the
-- 0004 claim function in place; the 4-arg signature is UNCHANGED so
-- existing callers keep working).
-- Never resets or drops existing tables. No RLS/policy changes.
-- ============================================================
--
-- ROOT CAUSE (confirmed in 0004, lines 112-123): the success gate counted
-- `status = 'completed'` ONLY. Active `reserved` rows were invisible to the
-- 20-per-day limit, so a burst of concurrent requests could each observe
-- e.g. 19 completed, all insert reservations (the 60-attempt ceiling is the
-- only backstop: 19 + 40 = 59 < 60), and all finalize — up to ~59 successes
-- against a limit of 20. Parallel tabs/requests bypassed the quota.
--
-- FIX: the success gate counts HELD slots = `completed` + active `reserved`
-- for the user since UTC midnight. Every claim occupies exactly one of the
-- 20 slots until it finalizes: success keeps it (`reserved`→`completed`
-- stays in the held set), failure releases it (`failed` leaves the set),
-- abandonment releases it after the TTL (`expired` leaves the set).
-- The separate attempt ceiling (reserved+completed+failed, expired
-- excluded) is UNCHANGED — still the abuse backstop.
--
-- Concurrency story (unchanged mechanism, now correct predicate): one
-- transaction, per-user advisory lock, check-expire-count-insert. A second
-- claim cannot observe a stale count because the lock serializes claims
-- per user; different users lock independently. The transaction commits
-- BEFORE the slow provider call (the lock is xact-scoped, never held
-- across the network) — finalization is a second, idempotent step.

-- ------------------------------------------------------------
-- 0) Ordering guard: 0004 must be applied first (status column).
-- ------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_generations'
      and column_name = 'status'
  ) then
    raise exception 'ai_generations.status is missing — apply 0004_ai_generation_quota.sql first';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1) Corrected claim — held slots (completed + active reserved)
--    count against the success limit.
-- ------------------------------------------------------------

create or replace function public.claim_ai_generation_slot(
  p_user_id uuid,
  p_limit integer default 20,
  p_attempt_limit integer default 60,
  p_reservation_ttl_minutes integer default 10
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_held integer;
  v_attempts integer;
  v_id uuid;
  v_day_start timestamptz;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;
  if p_limit is null or p_limit < 1 then
    raise exception 'p_limit must be a positive integer';
  end if;
  if p_attempt_limit is null or p_attempt_limit < 1 then
    raise exception 'p_attempt_limit must be a positive integer';
  end if;
  if p_reservation_ttl_minutes is null or p_reservation_ttl_minutes < 1 then
    raise exception 'p_reservation_ttl_minutes must be a positive integer';
  end if;

  -- UTC calendar-day start, rendered back to timestamptz AS UTC, so the
  -- boundary below never depends on the session TimeZone setting.
  v_day_start := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';

  -- Serialize quota checks per user for the life of this transaction.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  -- Abandoned reservations stop counting after the TTL and are marked so
  -- the ledger stays truthful. No cron job required.
  update public.ai_generations
  set status = 'expired'
  where user_id = p_user_id
    and status = 'reserved'
    and created_at < now() - make_interval(mins => p_reservation_ttl_minutes);

  -- Success quota: HELD slots (completed + active reserved) since UTC
  -- midnight. Counting reservations here is the fix: N parallel claims
  -- each see the previous claims' reservations and stop at the limit.
  select count(*) into v_held
  from public.ai_generations
  where user_id = p_user_id
    and status in ('completed', 'reserved')
    and created_at >= v_day_start;

  if v_held >= p_limit then
    raise exception 'AI generation quota exceeded (% of % successful generations per UTC day)'
      using errcode = 'P0001',
            detail = 'AI_GENERATION_QUOTA_EXCEEDED';
  end if;

  -- Attempt ceiling: active reservations + today's completed + failures.
  -- (Expired rows are excluded — abandonment must not burn budget forever.)
  -- Unchanged from 0004.
  select count(*) into v_attempts
  from public.ai_generations
  where user_id = p_user_id
    and created_at >= v_day_start
    and status in ('reserved', 'completed', 'failed');

  if v_attempts >= p_attempt_limit then
    raise exception 'AI generation attempt limit exceeded (% of % attempts per UTC day)'
      using errcode = 'P0001',
            detail = 'AI_GENERATION_ATTEMPT_LIMIT';
  end if;

  insert into public.ai_generations (user_id, status)
  values (p_user_id, 'reserved')
  returning id into v_id;

  return v_id;
end;
$$;

-- Re-assert the lockdown (CREATE OR REPLACE preserves grants, but the
-- revokes below are load-bearing by default, so state them explicitly).
revoke all on function public.claim_ai_generation_slot(uuid, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_ai_generation_slot(uuid, integer, integer, integer)
  to service_role;

-- finalize_ai_generation_slot() is UNCHANGED by this fix: it already flips
-- only `reserved` rows matching id+user (idempotent, boolean) — verified,
-- no replacement needed. Its lockdown from 0004 stands.

-- RLS posture is UNCHANGED (read-own SELECT only; no new policies, no
-- table grants). The existing (user_id, created_at) index serves the new
-- held-slot count (user_id equality + created_at range + status filter);
-- no new index needed.

-- ============================================================
-- Verification (run in the SQL Editor after applying):
--
-- -- 1. Success gate counts held slots (completed + reserved)
-- select pg_get_functiondef(p.oid) from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname = 'claim_ai_generation_slot';
-- -- confirm: status in ('completed', 'reserved') in the v_held query.
--
-- -- 2. Burst behavior (replace with a real auth.users id; run each
-- --    claim in its own statement to simulate separate requests):
-- --   select public.claim_ai_generation_slot('<user-uuid>', 2, 60, 10);
-- --   → slot A. Again → slot B. Third call → P0001
-- --   AI_GENERATION_QUOTA_EXCEEDED (2 held = limit, even with 0 completed).
-- --   select public.finalize_ai_generation_slot('<slot-A>', '<user-uuid>', 'failed', null, null, 0);
-- --   → true (releases the slot).
-- --   select public.claim_ai_generation_slot('<user-uuid>', 2, 60, 10);
-- --   → slot C (1 held again — failure released, not consumed).
-- ============================================================
