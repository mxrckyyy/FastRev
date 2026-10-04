-- Phase 1: initial schema + RLS
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: drops policies/objects if they already exist.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  question text not null,
  answer text not null,
  source text,
  due timestamptz not null default now(),
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days integer not null default 0,
  scheduled_days integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  state smallint not null default 0,
  last_review timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.review_logs (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null,
  reviewed_at timestamptz not null default now()
);

-- Indexes for the review queue and per-user lookups.
create index if not exists cards_user_due_idx on public.cards (user_id, due);
create index if not exists decks_user_idx on public.decks (user_id);
create index if not exists review_logs_card_idx on public.review_logs (card_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.decks enable row level security;
alter table public.cards enable row level security;
alter table public.review_logs enable row level security;

-- decks
drop policy if exists "decks_select_own" on public.decks;
create policy "decks_select_own" on public.decks
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "decks_insert_own" on public.decks;
create policy "decks_insert_own" on public.decks
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "decks_update_own" on public.decks;
create policy "decks_update_own" on public.decks
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "decks_delete_own" on public.decks;
create policy "decks_delete_own" on public.decks
  for delete to authenticated
  using (auth.uid() = user_id);

-- cards
drop policy if exists "cards_select_own" on public.cards;
create policy "cards_select_own" on public.cards
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "cards_insert_own" on public.cards;
create policy "cards_insert_own" on public.cards
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "cards_update_own" on public.cards;
create policy "cards_update_own" on public.cards
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cards_delete_own" on public.cards;
create policy "cards_delete_own" on public.cards
  for delete to authenticated
  using (auth.uid() = user_id);

-- review_logs
drop policy if exists "review_logs_select_own" on public.review_logs;
create policy "review_logs_select_own" on public.review_logs
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "review_logs_insert_own" on public.review_logs;
create policy "review_logs_insert_own" on public.review_logs
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "review_logs_update_own" on public.review_logs;
create policy "review_logs_update_own" on public.review_logs
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "review_logs_delete_own" on public.review_logs;
create policy "review_logs_delete_own" on public.review_logs
  for delete to authenticated
  using (auth.uid() = user_id);
