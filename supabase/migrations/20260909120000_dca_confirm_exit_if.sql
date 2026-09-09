-- Wave 2 / 2b: optional AND confirm and Exit-if flatten.
-- Null kind keeps today's bots unchanged.

alter table public.dca_playbooks
    add column if not exists confirm_kind text,
    add column if not exists confirm_timeframe text,
    add column if not exists confirm_compare text,
    add column if not exists confirm_level numeric,
    add column if not exists confirm_period integer,
    add column if not exists confirm_multiplier numeric,
    add column if not exists short_confirm_kind text,
    add column if not exists short_confirm_timeframe text,
    add column if not exists short_confirm_compare text,
    add column if not exists short_confirm_level numeric,
    add column if not exists short_confirm_period integer,
    add column if not exists short_confirm_multiplier numeric,
    add column if not exists exit_if_kind text,
    add column if not exists exit_if_timeframe text,
    add column if not exists exit_if_compare text,
    add column if not exists exit_if_level numeric,
    add column if not exists exit_if_period integer,
    add column if not exists exit_if_multiplier numeric,
    add column if not exists short_exit_if_kind text,
    add column if not exists short_exit_if_timeframe text,
    add column if not exists short_exit_if_compare text,
    add column if not exists short_exit_if_level numeric,
    add column if not exists short_exit_if_period integer,
    add column if not exists short_exit_if_multiplier numeric;

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_confirm_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_confirm_kind_check
    check (
        confirm_kind is null
        or confirm_kind in ('ema', 'sma', 'rsi', 'bb', 'atr_band', 'supertrend')
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_confirm_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_confirm_kind_check
    check (
        short_confirm_kind is null
        or short_confirm_kind in ('ema', 'sma', 'rsi', 'bb', 'atr_band', 'supertrend')
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_exit_if_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_exit_if_kind_check
    check (
        exit_if_kind is null
        or exit_if_kind in ('ema', 'sma', 'rsi', 'bb', 'atr_band', 'supertrend')
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_exit_if_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_exit_if_kind_check
    check (
        short_exit_if_kind is null
        or short_exit_if_kind in ('ema', 'sma', 'rsi', 'bb', 'atr_band', 'supertrend')
    );
