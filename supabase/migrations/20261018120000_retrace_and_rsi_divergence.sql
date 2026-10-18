-- Retrace is a lead condition. RSI divergence is an indicator kind.
-- The extra fields stay in the entry and exit JSON. No new columns.

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_start_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_start_kind_check
    check (start_kind in ('immediate', 'price', 'webhook', 'indicator', 'trend', 'retrace'));

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_start_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_start_kind_check
    check (
        short_start_kind is null
        or short_start_kind in ('immediate', 'price', 'webhook', 'indicator', 'trend', 'retrace')
    );

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_entry_source_check;
alter table public.futures_automation_rules
    add constraint futures_automation_rules_entry_source_check check (
        entry_source in ('price', 'webhook', 'indicator', 'trend', 'retrace')
        and (
            (
                entry_source in ('price', 'indicator', 'trend', 'retrace')
                and webhook_id is null
            )
            or (
                entry_source = 'webhook'
                and webhook_id is not null
            )
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_indicator_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_indicator_kind_check
    check (
        indicator_kind is null
        or indicator_kind in (
            'rsi', 'rsi_divergence', 'macd', 'ema_cross', 'ema', 'sma', 'sma_cross', 'bb', 'supertrend', 'atr_band'
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_indicator_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_indicator_kind_check
    check (
        short_indicator_kind is null
        or short_indicator_kind in (
            'rsi', 'rsi_divergence', 'macd', 'ema_cross', 'ema', 'sma', 'sma_cross', 'bb', 'supertrend', 'atr_band'
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_confirm_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_confirm_kind_check
    check (
        confirm_kind is null
        or confirm_kind in (
            'rsi', 'rsi_divergence', 'macd', 'sma', 'ema', 'sma_cross', 'ema_cross', 'bb', 'atr_band', 'supertrend'
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_confirm_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_confirm_kind_check
    check (
        short_confirm_kind is null
        or short_confirm_kind in (
            'rsi', 'rsi_divergence', 'macd', 'sma', 'ema', 'sma_cross', 'ema_cross', 'bb', 'atr_band', 'supertrend'
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_exit_if_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_exit_if_kind_check
    check (
        exit_if_kind is null
        or exit_if_kind in (
            'rsi', 'rsi_divergence', 'macd', 'sma', 'ema', 'sma_cross', 'ema_cross', 'bb', 'atr_band', 'supertrend'
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_exit_if_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_exit_if_kind_check
    check (
        short_exit_if_kind is null
        or short_exit_if_kind in (
            'rsi', 'rsi_divergence', 'macd', 'sma', 'ema', 'sma_cross', 'ema_cross', 'bb', 'atr_band', 'supertrend'
        )
    );

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_indicator_kind_check;
alter table public.futures_automation_rules
    add constraint futures_automation_rules_indicator_kind_check
    check (
        indicator_kind is null
        or indicator_kind in (
            'rsi', 'rsi_divergence', 'macd', 'ema_cross', 'ema', 'sma', 'sma_cross', 'bb', 'supertrend', 'atr_band'
        )
    );

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_confirm_kind_check;
alter table public.futures_automation_rules
    add constraint futures_automation_rules_confirm_kind_check
    check (
        confirm_kind is null
        or confirm_kind in (
            'rsi', 'rsi_divergence', 'macd', 'sma', 'ema', 'sma_cross', 'ema_cross', 'bb', 'atr_band', 'supertrend'
        )
    );

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_exit_if_kind_check;
alter table public.futures_automation_rules
    add constraint futures_automation_rules_exit_if_kind_check
    check (
        exit_if_kind is null
        or exit_if_kind in (
            'rsi', 'rsi_divergence', 'macd', 'sma', 'ema', 'sma_cross', 'ema_cross', 'bb', 'atr_band', 'supertrend'
        )
    );
