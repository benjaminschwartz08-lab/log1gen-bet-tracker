-- EdgeBook odds history foundation
-- Run this migration in the Supabase SQL Editor.

create table if not exists public.odds_snapshots (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  sport_key text not null,
  sport_title text,
  home_team text not null,
  away_team text not null,
  commence_time timestamptz,
  bookmaker_key text not null,
  bookmaker_title text not null,
  market_key text not null,
  outcome_name text not null,
  outcome_point numeric,
  decimal_odds numeric(10, 4) not null check (decimal_odds > 1),
  captured_at timestamptz not null default now(),
  source text not null default 'the-odds-api',
  created_at timestamptz not null default now()
);

create index if not exists odds_snapshots_event_market_idx
  on public.odds_snapshots (event_id, market_key, captured_at desc);

create index if not exists odds_snapshots_sport_time_idx
  on public.odds_snapshots (sport_key, commence_time);

create index if not exists odds_snapshots_bookmaker_idx
  on public.odds_snapshots (bookmaker_key, captured_at desc);

alter table public.odds_snapshots enable row level security;

-- Authenticated users can read shared odds history.
drop policy if exists "Authenticated users can read odds snapshots" on public.odds_snapshots;
create policy "Authenticated users can read odds snapshots"
  on public.odds_snapshots for select
  to authenticated
  using (true);

-- Inserts are intentionally not granted to browser users.
-- Future scheduled/server ingestion should write with a Supabase service role
-- kept only in server-side environment variables.
