-- ============================================================
-- Student Review System — Full Schema
-- ============================================================

-- Decks table
create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  created_at timestamptz default now() not null
);

-- Cards table (with FSRS fields)
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid references public.decks(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  question text not null,
  answer text not null,
  source text,
  -- FSRS scheduling fields
  due timestamptz default now() not null,
  stability float default 0 not null,
  difficulty float default 0 not null,
  elapsed_days int default 0 not null,
  scheduled_days int default 0 not null,
  reps int default 0 not null,
  lapses int default 0 not null,
  state smallint default 0 not null,
  last_review timestamptz,
  created_at timestamptz default now() not null
);

-- Review logs table
create table if not exists public.review_logs (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references public.cards(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  rating smallint not null check (rating between 1 and 4),
  reviewed_at timestamptz default now() not null
);

-- Indexes for performance
create index if not exists idx_decks_user_id on public.decks(user_id);
create index if not exists idx_cards_user_id on public.cards(user_id);
create index if not exists idx_cards_deck_id on public.cards(deck_id);
create index if not exists idx_cards_due on public.cards(user_id, due);
create index if not exists idx_review_logs_user_id on public.review_logs(user_id);
create index if not exists idx_review_logs_card_id on public.review_logs(card_id);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.decks enable row level security;
alter table public.cards enable row level security;
alter table public.review_logs enable row level security;

-- Decks policies
drop policy if exists "Users can view own decks" on public.decks;
create policy "Users can view own decks"
  on public.decks for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own decks" on public.decks;
create policy "Users can insert own decks"
  on public.decks for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own decks" on public.decks;
create policy "Users can update own decks"
  on public.decks for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own decks" on public.decks;
create policy "Users can delete own decks"
  on public.decks for delete
  using (auth.uid() = user_id);

-- Cards policies
drop policy if exists "Users can view own cards" on public.cards;
create policy "Users can view own cards"
  on public.cards for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own cards" on public.cards;
create policy "Users can insert own cards"
  on public.cards for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own cards" on public.cards;
create policy "Users can update own cards"
  on public.cards for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own cards" on public.cards;
create policy "Users can delete own cards"
  on public.cards for delete
  using (auth.uid() = user_id);

-- Review logs policies
drop policy if exists "Users can view own review logs" on public.review_logs;
create policy "Users can view own review logs"
  on public.review_logs for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own review logs" on public.review_logs;
create policy "Users can insert own review logs"
  on public.review_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own review logs" on public.review_logs;
create policy "Users can delete own review logs"
  on public.review_logs for delete
  using (auth.uid() = user_id);

-- ============================================================
-- Phase 12 security hardening
-- (same content as migrations/0002_authorization_hardening.sql)
-- ============================================================

-- Cross-table ownership: a row may only reference a parent row owned
-- by the same user (RLS alone checks only the row being written).
create or replace function public.assert_deck_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  deck_owner uuid;
begin
  select user_id into deck_owner from public.decks where id = new.deck_id;
  if deck_owner is null then
    raise exception 'Referenced deck does not exist';
  end if;
  if deck_owner <> new.user_id then
    raise exception 'Deck does not belong to the current user';
  end if;
  return new;
end;
$$;

drop trigger if exists cards_deck_owner on public.cards;
create trigger cards_deck_owner
  before insert or update of deck_id, user_id
  on public.cards
  for each row
  execute function public.assert_deck_owner();

create or replace function public.assert_card_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  card_owner uuid;
begin
  select user_id into card_owner from public.cards where id = new.card_id;
  if card_owner is null then
    raise exception 'Referenced card does not exist';
  end if;
  if card_owner <> new.user_id then
    raise exception 'Card does not belong to the current user';
  end if;
  return new;
end;
$$;

drop trigger if exists review_logs_card_owner on public.review_logs;
create trigger review_logs_card_owner
  before insert or update of card_id, user_id
  on public.review_logs
  for each row
  execute function public.assert_card_owner();

-- Input limits at the database boundary (NOT VALID = enforced for new
-- and updated rows only, so this script can never fail on pre-existing
-- data). Limits mirror the client-side maxLength rules.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'decks_name_len' and conrelid = 'public.decks'::regclass
  ) then
    alter table public.decks add constraint decks_name_len
      check (char_length(btrim(name)) between 1 and 100) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'decks_description_len' and conrelid = 'public.decks'::regclass
  ) then
    alter table public.decks add constraint decks_description_len
      check (description is null or char_length(description) <= 500) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'cards_question_len' and conrelid = 'public.cards'::regclass
  ) then
    alter table public.cards add constraint cards_question_len
      check (char_length(btrim(question)) between 1 and 2000) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'cards_answer_len' and conrelid = 'public.cards'::regclass
  ) then
    alter table public.cards add constraint cards_answer_len
      check (char_length(btrim(answer)) between 1 and 2000) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'cards_source_len' and conrelid = 'public.cards'::regclass
  ) then
    alter table public.cards add constraint cards_source_len
      check (source is null or char_length(source) <= 500) not valid;
  end if;
end $$;

-- ============================================================
-- End of schema
-- ============================================================
