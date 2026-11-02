-- EdgeBook bet metadata and closing-line value fields
-- Run this migration in the Supabase SQL Editor after the existing odds snapshot migrations.

alter table public.bets
  add column if not exists event_id text,
  add column if not exists market_key text,
  add column if not exists outcome_name text,
  add column if not exists outcome_point numeric,
  add column if not exists closing_odds numeric(10, 4),
  add column if not exists closing_captured_at timestamptz;

alter table public.bets
  drop constraint if exists bets_closing_odds_gt_one;

alter table public.bets
  add constraint bets_closing_odds_gt_one
  check (closing_odds is null or closing_odds > 1);

create index if not exists bets_event_market_selection_idx
  on public.bets (event_id, market_key, outcome_name, outcome_point)
  where event_id is not null;

create index if not exists bets_missing_closing_odds_idx
  on public.bets (created_at)
  where result = 'Pending' and closing_odds is null;
