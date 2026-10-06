-- Added replay indicators belong to one login and one backtest.
-- The app session check sits in TypeScript; TBP has no Supabase Auth JWT.

create table public.replay_run_indicators (
    user_id uuid not null references public.members (user_id) on delete cascade,
    run_id uuid not null references public.backtest_runs (id) on delete cascade,
    reference_indicators text[] not null default '{}',
    reference_inputs jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    primary key (user_id, run_id),
    constraint replay_run_indicators_inputs_object
        check (jsonb_typeof(reference_inputs) = 'object'),
    constraint replay_run_indicators_inputs_size
        check (octet_length(reference_inputs::text) <= 4000),
    constraint replay_run_indicators_references
        check (
            coalesce(cardinality(reference_indicators), 0) <= 7
            and reference_indicators <@ array[
                'rsi', 'macd', 'sma', 'ema', 'bb', 'supertrend', 'atr_band'
            ]::text[]
        )
);

create index replay_run_indicators_run_id_idx
    on public.replay_run_indicators (run_id);

alter table public.replay_run_indicators enable row level security;

revoke all on table public.replay_run_indicators from anon, authenticated;

alter table public.replay_view_preferences
    drop constraint replay_view_preferences_inputs_object,
    drop constraint replay_view_preferences_inputs_size,
    drop constraint replay_view_preferences_references,
    drop column reference_indicators,
    drop column reference_inputs;
