-- Replay page layout and chart settings, one row per login.
-- The app session check sits in TypeScript; TBP has no Supabase Auth JWT.

create table public.replay_view_preferences (
    user_id uuid primary key references public.members (user_id) on delete cascade,
    positions_right boolean not null default false,
    chart_appearance jsonb not null default '{}'::jsonb,
    indicator_styles jsonb not null default '{}'::jsonb,
    reference_indicators text[] not null default '{}',
    reference_inputs jsonb not null default '{}'::jsonb,
    chart_interval text,
    updated_at timestamptz not null default now(),
    constraint replay_view_preferences_appearance_object
        check (jsonb_typeof(chart_appearance) = 'object'),
    constraint replay_view_preferences_styles_object
        check (jsonb_typeof(indicator_styles) = 'object'),
    constraint replay_view_preferences_inputs_object
        check (jsonb_typeof(reference_inputs) = 'object'),
    constraint replay_view_preferences_appearance_size
        check (octet_length(chart_appearance::text) <= 4000),
    constraint replay_view_preferences_styles_size
        check (octet_length(indicator_styles::text) <= 24000),
    constraint replay_view_preferences_inputs_size
        check (octet_length(reference_inputs::text) <= 4000),
    constraint replay_view_preferences_references
        check (
            coalesce(cardinality(reference_indicators), 0) <= 7
            and reference_indicators <@ array[
                'rsi', 'macd', 'sma', 'ema', 'bb', 'supertrend', 'atr_band'
            ]::text[]
        ),
    constraint replay_view_preferences_interval
        check (
            chart_interval is null
            or chart_interval in ('5', '15', '30', '60', '120', '240', '360', '720', 'D')
        )
);

alter table public.replay_view_preferences enable row level security;

revoke all on table public.replay_view_preferences from anon, authenticated;
