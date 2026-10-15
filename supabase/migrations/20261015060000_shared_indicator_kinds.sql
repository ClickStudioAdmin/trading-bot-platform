-- Entry and exit share one indicator list.
-- ATR band joins the entry kinds. MACD and moving-average crosses join confirm and hard exit.
-- Crosses store the slow length on its own column. The multiplier column stays the ATR factor
-- and the RSI Between upper level.

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
            'supertrend',
            'atr_band'
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
            'supertrend',
            'atr_band'
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_indicator_compare_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_indicator_compare_check
    check (
        indicator_compare is null
        or indicator_compare in ('gte', 'lte', 'cross_gte', 'cross_lte', 'inside')
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_indicator_compare_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_indicator_compare_check
    check (
        short_indicator_compare is null
        or short_indicator_compare in ('gte', 'lte', 'cross_gte', 'cross_lte', 'inside')
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_confirm_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_confirm_kind_check
    check (
        confirm_kind is null
        or confirm_kind in (
            'rsi',
            'macd',
            'sma',
            'ema',
            'sma_cross',
            'ema_cross',
            'bb',
            'atr_band',
            'supertrend'
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_confirm_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_confirm_kind_check
    check (
        short_confirm_kind is null
        or short_confirm_kind in (
            'rsi',
            'macd',
            'sma',
            'ema',
            'sma_cross',
            'ema_cross',
            'bb',
            'atr_band',
            'supertrend'
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_exit_if_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_exit_if_kind_check
    check (
        exit_if_kind is null
        or exit_if_kind in (
            'rsi',
            'macd',
            'sma',
            'ema',
            'sma_cross',
            'ema_cross',
            'bb',
            'atr_band',
            'supertrend'
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_exit_if_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_exit_if_kind_check
    check (
        short_exit_if_kind is null
        or short_exit_if_kind in (
            'rsi',
            'macd',
            'sma',
            'ema',
            'sma_cross',
            'ema_cross',
            'bb',
            'atr_band',
            'supertrend'
        )
    );

alter table public.dca_playbooks
    add column if not exists confirm_slow_period integer,
    add column if not exists short_confirm_slow_period integer,
    add column if not exists exit_if_slow_period integer,
    add column if not exists short_exit_if_slow_period integer;

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_confirm_slow_period_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_confirm_slow_period_check
    check (
        confirm_slow_period is null
        or (confirm_slow_period >= 2 and confirm_slow_period <= 400)
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_confirm_slow_period_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_confirm_slow_period_check
    check (
        short_confirm_slow_period is null
        or (short_confirm_slow_period >= 2 and short_confirm_slow_period <= 400)
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_exit_if_slow_period_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_exit_if_slow_period_check
    check (
        exit_if_slow_period is null
        or (exit_if_slow_period >= 2 and exit_if_slow_period <= 400)
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_exit_if_slow_period_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_exit_if_slow_period_check
    check (
        short_exit_if_slow_period is null
        or (short_exit_if_slow_period >= 2 and short_exit_if_slow_period <= 400)
    );

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
            'supertrend',
            'atr_band'
        )
    );

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_confirm_kind_check;
alter table public.futures_automation_rules
    add constraint futures_automation_rules_confirm_kind_check
    check (
        confirm_kind is null
        or confirm_kind in (
            'rsi',
            'macd',
            'sma',
            'ema',
            'sma_cross',
            'ema_cross',
            'bb',
            'atr_band',
            'supertrend'
        )
    );

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_exit_if_kind_check;
alter table public.futures_automation_rules
    add constraint futures_automation_rules_exit_if_kind_check
    check (
        exit_if_kind is null
        or exit_if_kind in (
            'rsi',
            'macd',
            'sma',
            'ema',
            'sma_cross',
            'ema_cross',
            'bb',
            'atr_band',
            'supertrend'
        )
    );

alter table public.futures_automation_rules
    add column if not exists confirm_slow_period integer,
    add column if not exists exit_if_slow_period integer;

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_confirm_slow_period_check;
alter table public.futures_automation_rules
    add constraint futures_automation_rules_confirm_slow_period_check
    check (
        confirm_slow_period is null
        or (confirm_slow_period >= 2 and confirm_slow_period <= 400)
    );

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_exit_if_slow_period_check;
alter table public.futures_automation_rules
    add constraint futures_automation_rules_exit_if_slow_period_check
    check (
        exit_if_slow_period is null
        or (exit_if_slow_period >= 2 and exit_if_slow_period <= 400)
    );
