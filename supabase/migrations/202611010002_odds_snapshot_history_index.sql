-- Query helper index for event/market history timelines.
create index if not exists odds_snapshots_event_market_outcome_time_idx
  on public.odds_snapshots (event_id, market_key, outcome_name, captured_at asc);

create index if not exists odds_snapshots_event_bookmaker_time_idx
  on public.odds_snapshots (event_id, bookmaker_key, captured_at desc);
