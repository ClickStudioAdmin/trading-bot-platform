-- Bollinger Bands start: last price vs the top or bottom band.

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_indicator_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_indicator_kind_check
    check (
        indicator_kind is null
        or indicator_kind in (
            'rsi', 'macd', 'ema_cross', 'ema', 'sma', 'bb'
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_indicator_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_indicator_kind_check
    check (
        short_indicator_kind is null
        or short_indicator_kind in (
            'rsi', 'macd', 'ema_cross', 'ema', 'sma', 'bb'
        )
    );
