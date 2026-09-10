-- Perps bots: Indicator / Trend When, Secondary Entry, Hard Exit, Move Breakeven.
-- One side per bot (Action). Null kinds keep today's price / webhook bots unchanged.

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_entry_source_check;

alter table public.futures_automation_rules
    add constraint futures_automation_rules_entry_source_check check (
        entry_source in ('price', 'webhook', 'indicator', 'trend')
        and (
            (
                entry_source in ('price', 'indicator', 'trend')
                and webhook_id is null
            )
            or (
                entry_source = 'webhook'
                and webhook_id is not null
            )
        )
    );

alter table public.futures_automation_rules
    add column if not exists indicator_kind text,
    add column if not exists indicator_timeframe text,
    add column if not exists indicator_compare text,
    add column if not exists indicator_level numeric,
    add column if not exists indicator_period integer,
    add column if not exists indicator_slow_period integer,
    add column if not exists indicator_multiplier numeric,
    add column if not exists confirm_kind text,
    add column if not exists confirm_timeframe text,
    add column if not exists confirm_compare text,
    add column if not exists confirm_level numeric,
    add column if not exists confirm_period integer,
    add column if not exists confirm_multiplier numeric,
    add column if not exists exit_if_kind text,
    add column if not exists exit_if_timeframe text,
    add column if not exists exit_if_compare text,
    add column if not exists exit_if_level numeric,
    add column if not exists exit_if_period integer,
    add column if not exists exit_if_multiplier numeric,
    add column if not exists breakeven_activation_pct numeric,
    add column if not exists breakeven_offset_pct numeric;

alter table public.futures_positions
    add column if not exists breakeven_done boolean not null default false;

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_indicator_kind_check;
alter table public.futures_automation_rules
    add constraint futures_automation_rules_indicator_kind_check
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

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_indicator_multiplier_check;
alter table public.futures_automation_rules
    add constraint futures_automation_rules_indicator_multiplier_check
    check (
        indicator_multiplier is null
        or (
            indicator_multiplier >= 0.5
            and indicator_multiplier <= 20
        )
    );

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_confirm_kind_check;
alter table public.futures_automation_rules
    add constraint futures_automation_rules_confirm_kind_check
    check (
        confirm_kind is null
        or confirm_kind in ('ema', 'sma', 'rsi', 'bb', 'atr_band', 'supertrend')
    );

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_exit_if_kind_check;
alter table public.futures_automation_rules
    add constraint futures_automation_rules_exit_if_kind_check
    check (
        exit_if_kind is null
        or exit_if_kind in ('ema', 'sma', 'rsi', 'bb', 'atr_band', 'supertrend')
    );

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_breakeven_activation_check;
alter table public.futures_automation_rules
    add constraint futures_automation_rules_breakeven_activation_check
    check (
        breakeven_activation_pct is null
        or breakeven_activation_pct > 0
    );

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_breakeven_offset_check;
alter table public.futures_automation_rules
    add constraint futures_automation_rules_breakeven_offset_check
    check (
        breakeven_offset_pct is null
        or breakeven_offset_pct >= 0
    );
