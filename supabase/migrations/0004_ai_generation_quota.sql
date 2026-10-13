-- ============================================================
-- Phase 4 (Edge Function track) — success-counted daily quota with
-- reservation-and-finalization.
-- Idempotent: safe to run more than once.
-- Run this in the Supabase SQL Editor AFTER 0003.
-- Never resets or drops existing tables.
-- ============================================================
--
-- Enforcement strategy (read this before the code):
--   * The LIMIT counts SUCCESSFUL generations per UTC calendar day
--     (default 20). Failed attempts do NOT consume success quota.
--   * A separate per-day ATTEMPT ceiling (default 60 = 3x) bounds
--     retry-abuse against provider resources.
--   * Flow per request, all inside ONE function transaction holding a
--     per-user advisory lock (concurrent requests serialize, so the
--     limit can never be overshot):
--       claim   → count today's completed; count today's attempts;
--                 insert a 'reserved' row; return its id.
--       success → finalize to 'completed' (+ tokens/provider/cards).
--       failure → finalize to 'failed' (releases success quota).
--   * ABANDONED reservations (crash between claim and finalize) stop
--     counting after a TTL (default 10 min) and are lazily marked
--     'expired' by the next claim — no cron job required.
--   * Day boundary is computed in UTC on BOTH sides of the comparison,
--     so it never depends on the session TimeZone.

-- ------------------------------------------------------------
-- 1) Reservation state on the ledger
-- ------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_generations'
      and column_name = 'status'
  ) then
    -- Pre-existing rows (if any) backfill as 'completed': the
    -- conservative choice — past usage counts toward the quota.
    alter table public.ai_generations
      add column status text not null default 'completed';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_generations_status_values'
      and conrelid = 'public.ai_generations'::regclass
  ) then
    -- NOT VALID (0002 convention): existing rows are not scanned, but
    -- every new or updated row IS enforced.
    alter table public.ai_generations add constraint ai_generations_status_values
      check (status in ('reserved', 'completed', 'failed', 'expired')) not valid;
  end if;
end $$;

-- The (user_id, created_at) index from 0003 already serves both quota
-- counts (user_id prefix + created_at range); no new index needed.

-- ------------------------------------------------------------
-- 2) Atomic claim — check, expire, reserve in one transaction
-- ------------------------------------------------------------
-- Replaces the Phase 1 rolling-window version: drop the old 3-arg
-- signature so exactly one claim function exists.

drop function if exists public.claim_ai_generation_slot(uuid, integer, integer);

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
  v_successes integer;
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

  -- Success quota: completed generations since UTC midnight.
  select count(*) into v_successes
  from public.ai_generations
  where user_id = p_user_id
    and status = 'completed'
    and created_at >= v_day_start;

  if v_successes >= p_limit then
    raise exception 'AI generation quota exceeded (%% of %% successful generations per UTC day)'
      using errcode = 'P0001',
            detail = 'AI_GENERATION_QUOTA_EXCEEDED';
  end if;

  -- Attempt ceiling: active reservations + today's completed + failures.
  -- (Expired rows are excluded — abandonment must not burn budget forever.)
  select count(*) into v_attempts
  from public.ai_generations
  where user_id = p_user_id
    and created_at >= v_day_start
    and status in ('reserved', 'completed', 'failed');

  if v_attempts >= p_attempt_limit then
    raise exception 'AI generation attempt limit exceeded (%% of %% attempts per UTC day)'
      using errcode = 'P0001',
            detail = 'AI_GENERATION_ATTEMPT_LIMIT';
  end if;

  insert into public.ai_generations (user_id, status)
  values (p_user_id, 'reserved')
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.claim_ai_generation_slot(uuid, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_ai_generation_slot(uuid, integer, integer, integer)
  to service_role;

-- ------------------------------------------------------------
-- 3) Finalize — complete or release a reservation
-- ------------------------------------------------------------
-- Only flips a row the caller owns AND that is still 'reserved', so a
-- double-finalize, a foreign slot id, or a wrong user is a silent no-op
-- (returns false) rather than a quota manipulation primitive.
-- p_tokens null = provider reported no usage → row keeps 0 ("unknown",
-- never invented). Service-role callers only (revokes below).

create or replace function public.finalize_ai_generation_slot(
  p_slot_id uuid,
  p_user_id uuid,
  p_status text,
  p_tokens integer default null,
  p_provider text default null,
  p_cards integer default 0
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_slot_id is null or p_user_id is null then
    raise exception 'p_slot_id and p_user_id are required';
  end if;
  if p_status not in ('completed', 'failed') then
    raise exception 'p_status must be completed or failed';
  end if;

  update public.ai_generations
  set status = p_status,
      tokens_used = case
        when p_tokens is null then tokens_used
        else greatest(p_tokens, 0)
      end,
      provider = coalesce(p_provider, provider),
      cards_generated = greatest(coalesce(p_cards, 0), 0)
  where id = p_slot_id
    and user_id = p_user_id
    and status = 'reserved';

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.finalize_ai_generation_slot(uuid, uuid, text, integer, text, integer)
  from public, anon, authenticated;
grant execute on function public.finalize_ai_generation_slot(uuid, uuid, text, integer, text, integer)
  to service_role;

-- RLS posture is UNCHANGED by this migration (read-own SELECT only; every
-- direct client write still denied; no new policies, no grants on the table).

-- ============================================================
-- Verification (run in the SQL Editor after applying):
--
-- -- 1. Status column + constraint
-- select column_name, column_default from information_schema.columns
-- where table_schema = 'public' and table_name = 'ai_generations'
--   and column_name = 'status';
-- select conname from pg_constraint
-- where conrelid = 'public.ai_generations'::regclass
--   and conname = 'ai_generations_status_values';
--
-- -- 2. Exactly one claim signature (4-arg) + finalize present
-- select p.proname, pg_get_function_arguments(p.oid) from pg_proc p
-- join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('claim_ai_generation_slot', 'finalize_ai_generation_slot');
--
-- -- 3. Both functions service_role-only
-- select routine_name, grantee from information_schema.role_routine_grants
-- where specific_schema = 'public'
--   and routine_name in ('claim_ai_generation_slot', 'finalize_ai_generation_slot');
-- -- (expect two rows, both grantee = service_role)
--
-- -- 4. RLS still read-own-only (one SELECT policy, no write policies)
-- select policyname, roles, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'ai_generations';
--
-- -- 5. Functional check (replace with a real auth.users id):
-- --   select public.claim_ai_generation_slot('<user-uuid>', 20, 60, 10);
-- --   → returns a slot id (service_role / SQL Editor context).
-- --   select public.finalize_ai_generation_slot('<slot-id>', '<user-uuid>', 'completed', 150, 'groq', 12);
-- --   → true. Second call with same args → false (no double-count).
-- ============================================================
