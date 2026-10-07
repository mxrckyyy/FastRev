-- ============================================================
-- Phase 12 — Security hardening (authorization + input limits)
-- Idempotent: safe to run more than once.
-- Run this in the Supabase SQL Editor AFTER 0001 (or after schema.sql).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Cross-table ownership enforcement
--
-- RLS policies only check auth.uid() = user_id on the row being
-- written; they do not check that the referenced parent row (a deck
-- or a card) belongs to the same user. These SECURITY DEFINER
-- triggers close that gap so a client posting directly to the API
-- cannot attach its rows to another user's deck/card.
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- 2) Server-boundary input validation (length limits)
--
-- NOT VALID: existing rows are not checked (the migration can never
-- fail on legacy data) — every new or updated row IS enforced.
-- Limits mirror the client-side maxLength rules so users never hit a
-- constraint the UI allowed them to exceed.
-- ------------------------------------------------------------
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
-- End of Phase 12 hardening
-- ============================================================
