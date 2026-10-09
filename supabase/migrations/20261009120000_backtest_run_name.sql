-- Run title. Separate from the bot name stored on recipe.
alter table public.backtest_runs
    add column if not exists name text
        check (name is null or char_length(name) between 1 and 80);
