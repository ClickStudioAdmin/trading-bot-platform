alter table public.backtest_runs
  add column replay_events jsonb
  check (replay_events is null or jsonb_typeof(replay_events) = 'array');
