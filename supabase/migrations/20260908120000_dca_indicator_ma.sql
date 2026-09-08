-- Straight EMA / SMA start (price crosses the average) plus a period.
-- Legacy ema_cross + a typed price level still means EMA 21 vs that price.

alter table public.dca_playbooks
    add column if not exists indicator_period integer,
    add column if not exists short_indicator_period integer;

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_indicator_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_indicator_kind_check
    check (
        indicator_kind is null
        or indicator_kind in ('rsi', 'macd', 'ema_cross', 'ema', 'sma')
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_indicator_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_indicator_kind_check
    check (
        short_indicator_kind is null
        or short_indicator_kind in ('rsi', 'macd', 'ema_cross', 'ema', 'sma')
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_indicator_period_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_indicator_period_check
    check (
        indicator_period is null
        or (indicator_period >= 2 and indicator_period <= 400)
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_indicator_period_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_indicator_period_check
    check (
        short_indicator_period is null
        or (short_indicator_period >= 2 and short_indicator_period <= 400)
    );
