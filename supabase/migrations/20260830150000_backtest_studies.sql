-- Admin studies: one grouped search over a desk bot's discrete parameter grid.
-- Regular user backtests stay study_id null.

create table public.backtest_studies (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.members (user_id) on delete cascade,
    account_id uuid references public.trading_accounts (id) on delete set null,
    name text not null,
    desk_type text not null
        check (desk_type in ('perps', 'dca')),
    venue text not null,
    venue_environment text,
    symbol text not null,
    from_ms bigint not null
        check (from_ms > 0),
    to_ms bigint not null
        check (to_ms > from_ms),
    starting_balance_usdt numeric not null
        check (starting_balance_usdt > 0),
    seed_recipe jsonb not null
        check (jsonb_typeof(seed_recipe) = 'object'),
    scenario_count integer not null default 0
        check (scenario_count >= 0),
    status text not null
        check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),
    error text,
    created_at timestamptz not null default now(),
    finished_at timestamptz
);

create index backtest_studies_created_idx
    on public.backtest_studies (created_at desc);

alter table public.backtest_studies enable row level security;

revoke all on table public.backtest_studies from anon, authenticated;

alter table public.backtest_runs
    add column study_id uuid references public.backtest_studies (id) on delete cascade;

create index backtest_runs_study_idx
    on public.backtest_runs (study_id, created_at desc);
