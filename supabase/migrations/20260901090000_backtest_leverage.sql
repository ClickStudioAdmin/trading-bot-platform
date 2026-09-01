-- Replay leverage for backtest cash (margin) and Performance ROE / APR.
alter table public.backtest_runs
    add column if not exists leverage numeric not null default 1
        check (leverage > 0);
