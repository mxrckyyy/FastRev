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
-- End of schema
-- ============================================================
