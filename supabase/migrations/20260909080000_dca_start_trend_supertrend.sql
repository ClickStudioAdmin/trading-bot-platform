-- Trend start: Supertrend. Reuses indicator_* columns (kind = supertrend).
-- Multiplier is ATR factor (default 3).

alter table public.dca_playbooks
    add column if not exists indicator_multiplier numeric,
    add column if not exists short_indicator_multiplier numeric;

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_start_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_start_kind_check
    check (start_kind in ('immediate', 'price', 'webhook', 'indicator', 'trend'));

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_indicator_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_indicator_kind_check
    check (
        indicator_kind is null
        or indicator_kind in (
            'rsi',
            'macd',
            'ema_cross',
            'ema',
            'sma',
            'sma_cross',
            'bb',
            'supertrend'
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_indicator_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_indicator_kind_check
    check (
        short_indicator_kind is null
        or short_indicator_kind in (
            'rsi',
            'macd',
            'ema_cross',
            'ema',
            'sma',
            'sma_cross',
            'bb',
            'supertrend'
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_indicator_multiplier_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_indicator_multiplier_check
    check (
        indicator_multiplier is null
        or (
            indicator_multiplier >= 0.5
            and indicator_multiplier <= 20
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_indicator_multiplier_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_indicator_multiplier_check
    check (
        short_indicator_multiplier is null
        or (
            short_indicator_multiplier >= 0.5
            and short_indicator_multiplier <= 20
        )
    );
