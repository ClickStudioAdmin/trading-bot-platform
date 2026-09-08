-- EMA Cross / SMA Cross: two periods (fast + slow). Defaults 9 and 21.

alter table public.dca_playbooks
    add column if not exists indicator_slow_period integer,
    add column if not exists short_indicator_slow_period integer;

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_indicator_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_indicator_kind_check
    check (
        indicator_kind is null
        or indicator_kind in (
            'rsi', 'macd', 'ema_cross', 'ema', 'sma', 'sma_cross', 'bb'
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_indicator_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_indicator_kind_check
    check (
        short_indicator_kind is null
        or short_indicator_kind in (
            'rsi', 'macd', 'ema_cross', 'ema', 'sma', 'sma_cross', 'bb'
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_indicator_slow_period_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_indicator_slow_period_check
    check (
        indicator_slow_period is null
        or (indicator_slow_period >= 2 and indicator_slow_period <= 400)
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_indicator_slow_period_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_indicator_slow_period_check
    check (
        short_indicator_slow_period is null
        or (
            short_indicator_slow_period >= 2
            and short_indicator_slow_period <= 400
        )
    );
