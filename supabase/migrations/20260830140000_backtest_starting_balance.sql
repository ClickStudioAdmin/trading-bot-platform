-- Backtests require an initial paper balance. Dates already live on from_ms / to_ms.

alter table public.backtest_runs
    add column if not exists starting_balance_usdt numeric not null default 10000
        check (starting_balance_usdt > 0);
