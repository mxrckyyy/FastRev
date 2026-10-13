-- ============================================================
-- Phase 1 (Edge Function track) — AI generation usage ledger
-- Idempotent: safe to run more than once.
-- Run this in the Supabase SQL Editor AFTER 0001 (or after schema.sql).
-- Never resets or drops existing tables.
-- ============================================================

-- ------------------------------------------------------------
-- 1) ai_generations ledger
--
-- One row per successful AI card-generation request, written ONLY
-- by the server-side Edge Function (service_role, bypasses RLS).
-- Authenticated users can READ their own rows (usage history);
-- they can NEVER insert / update / delete rows directly, so the
-- quota cannot be bypassed or tampered with from the browser.
--
-- tokens_used defaults to 0 because providers do not reliably
-- return usage: Groq/Cerebras (OpenAI-compatible) expose
-- `usage.prompt_tokens + completion_tokens`, while Gemini exposes
-- `usageMetadata` — either may be absent on errors, fallbacks, or
-- future model versions. The Edge Function fills in real numbers
-- when the provider returns them; 0 means "unknown", never a bill.
-- ------------------------------------------------------------

create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  tokens_used integer not null default 0 check (tokens_used >= 0),
  provider text,
  cards_generated integer not null default 0 check (cards_generated >= 0)
);

-- Query pattern for quota checks and usage history:
--   where user_id = ? and created_at > now() - interval '...'
--   order by created_at desc
create index if not exists ai_generations_user_created_idx
  on public.ai_generations (user_id, created_at desc);

-- ------------------------------------------------------------
-- 2) Row Level Security — read-own only, no direct writes
-- ------------------------------------------------------------

alter table public.ai_generations enable row level security;

drop policy if exists "ai_generations_select_own" on public.ai_generations;
create policy "ai_generations_select_own" on public.ai_generations
  for select to authenticated
  using (auth.uid() = user_id);

-- Defensive: guarantee no direct-write policy can survive on this
-- table (e.g. added by a future script). With RLS enabled and no
-- insert/update/delete policy, every direct client write is denied;
-- only service_role (the Edge Function) bypasses RLS to record usage.
drop policy if exists "ai_generations_insert_own" on public.ai_generations;
drop policy if exists "ai_generations_update_own" on public.ai_generations;
drop policy if exists "ai_generations_delete_own" on public.ai_generations;
-- (No policy is granted to `anon` at all: anonymous users get nothing.)

-- ------------------------------------------------------------
-- 3) Atomic quota gate — concurrency-safe check-and-record
--
-- A plain "SELECT count(*) then INSERT" from the Edge Function has
-- a race: two simultaneous requests can both see count < limit and
-- both insert, exceeding the quota. This SECURITY DEFINER function
-- runs the check AND the insert in ONE transaction while holding a
-- per-user advisory lock, so concurrent requests for the same user
-- serialize and the limit can never be overshot.
--
-- Intended caller: the generate-cards Edge Function, running with
-- the service_role key (server-only, never shipped to the browser).
-- Flow:
--   1. Edge Function calls claim_ai_generation_slot(user_id, limit)
--      BEFORE calling the AI provider (no wasted provider quota).
--      Over quota → raises AI_GENERATION_QUOTA_EXCEEDED (SQLSTATE
--      P0001); the function maps it to HTTP 429.
--   2. On provider success, the Edge Function UPDATEs the claimed
--      row (via service_role, bypassing RLS) with the real
--      tokens_used / provider / cards_generated.
--   3. On provider failure, the claimed row stays as an attempt
--      record (tokens 0) — attempts still count toward the quota,
--      which is the conservative choice against retry-abuse.
--
-- EXECUTE is revoked from anon/authenticated/public: clients must
-- go through the Edge Function and cannot pass an arbitrary
-- p_user_id of their choosing.
-- ------------------------------------------------------------

create or replace function public.claim_ai_generation_slot(
  p_user_id uuid,
  p_limit integer default 20,
  p_window_hours integer default 24
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_id uuid;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;
  if p_limit is null or p_limit < 1 then
    raise exception 'p_limit must be a positive integer';
  end if;
  if p_window_hours is null or p_window_hours < 1 then
    raise exception 'p_window_hours must be a positive integer';
  end if;

  -- Serialize quota checks per user for the life of this transaction.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select count(*) into v_count
  from public.ai_generations
  where user_id = p_user_id
    and created_at > now() - make_interval(hours => p_window_hours);

  if v_count >= p_limit then
    raise exception 'AI generation quota exceeded (%% of %% per %% hours)'
      using errcode = 'P0001',
            detail = 'AI_GENERATION_QUOTA_EXCEEDED';
  end if;

  insert into public.ai_generations (user_id)
  values (p_user_id)
  returning id into v_id;

  return v_id;
end;
$$;

-- Lock the function down to the server role. (Postgres grants EXECUTE
-- to PUBLIC by default, so the revokes below are load-bearing.)
revoke all on function public.claim_ai_generation_slot(uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_ai_generation_slot(uuid, integer, integer)
  to service_role;

-- ============================================================
-- Verification (run in the SQL Editor after applying):
--
-- -- 1. Table + index exist
-- select table_name from information_schema.tables
-- where table_schema = 'public' and table_name = 'ai_generations';
-- select indexname from pg_indexes
-- where schemaname = 'public' and tablename = 'ai_generations';
--
-- -- 2. RLS on, read-own-only (exactly one policy, SELECT, authenticated)
-- select relname, relrowsecurity from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relname = 'ai_generations';
-- select policyname, roles, cmd from pg_policies
-- where schemaname = 'public' and tablename = 'ai_generations';
--
-- -- 3. Function locked down (only service_role may execute)
-- select grantee, privilege_type
-- from information_schema.role_routine_grants
-- where specific_schema = 'public'
--   and routine_name = 'claim_ai_generation_slot';
-- ============================================================
