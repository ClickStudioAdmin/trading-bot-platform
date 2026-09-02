alter table public.dca_playbooks
    add column if not exists short_arm_trigger_by text,
    add column if not exists short_arm_compare text,
    add column if not exists short_arm_price numeric,
    add column if not exists short_indicator_kind text,
    add column if not exists short_indicator_timeframe text,
    add column if not exists short_indicator_compare text,
    add column if not exists short_indicator_level numeric;

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_arm_trigger_by_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_arm_trigger_by_check
    check (
        short_arm_trigger_by is null
        or short_arm_trigger_by in ('last', 'mark', 'index')
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_arm_compare_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_arm_compare_check
    check (
        short_arm_compare is null
        or short_arm_compare in ('gte', 'lte')
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_arm_price_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_arm_price_check
    check (short_arm_price is null or short_arm_price > 0);

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_indicator_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_indicator_kind_check
    check (
        short_indicator_kind is null
        or short_indicator_kind in ('rsi', 'macd', 'ema_cross')
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_indicator_timeframe_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_indicator_timeframe_check
    check (
        short_indicator_timeframe is null
        or short_indicator_timeframe in (
            '5', '15', '30', '60', '120', '240', '360', '720', 'D'
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_indicator_compare_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_indicator_compare_check
    check (
        short_indicator_compare is null
        or short_indicator_compare in ('gte', 'lte', 'cross_gte', 'cross_lte')
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_indicator_level_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_short_indicator_level_check
    check (short_indicator_level is null or short_indicator_level > 0);

update public.dca_playbooks
set
    short_arm_trigger_by = arm_trigger_by,
    short_arm_compare = case
        when arm_compare = 'gte' then 'lte'
        when arm_compare = 'lte' then 'gte'
        else arm_compare
    end,
    short_arm_price = arm_price
where direction = 'both'
  and start_kind = 'price'
  and arm_price is not null
  and short_arm_price is null;

update public.dca_playbooks
set
    short_indicator_kind = indicator_kind,
    short_indicator_timeframe = indicator_timeframe,
    short_indicator_compare = case
        when indicator_kind = 'rsi' and indicator_compare = 'cross_lte' then 'cross_gte'
        when indicator_kind = 'rsi' and indicator_compare = 'lte' then 'gte'
        when indicator_kind = 'rsi' and indicator_compare = 'cross_gte' then 'cross_gte'
        when indicator_kind = 'rsi' and indicator_compare = 'gte' then 'gte'
        else indicator_compare
    end,
    short_indicator_level = case
        when indicator_kind = 'rsi'
            and indicator_level is not null
            and indicator_level > 0
            and indicator_level < 100
        then 100 - indicator_level
        else indicator_level
    end
where direction = 'both'
  and start_kind = 'indicator'
  and indicator_kind is not null
  and short_indicator_kind is null;
