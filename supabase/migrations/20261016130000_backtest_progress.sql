-- Candle progress for a running backtest. The page reads this on its refresh.
alter table public.backtest_runs
    add column if not exists progress_done integer,
    add column if not exists progress_total integer,
    add column if not exists progress_phase text;

alter table public.backtest_runs
    drop constraint if exists backtest_runs_progress_phase_check;

alter table public.backtest_runs
    add constraint backtest_runs_progress_phase_check
        check (progress_phase is null or progress_phase in ('candles', 'replay'));

alter table public.backtest_runs
    drop constraint if exists backtest_runs_progress_bounds_check;

alter table public.backtest_runs
    add constraint backtest_runs_progress_bounds_check
        check (
            (progress_done is null or progress_done >= 0)
            and (progress_total is null or progress_total >= 0)
        );
