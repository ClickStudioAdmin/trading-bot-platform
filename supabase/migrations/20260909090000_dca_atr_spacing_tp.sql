-- Wave 1 adaptive DCA: ATR spacing and ATR take profit.
-- Defaults keep today's percent bots unchanged.

alter table public.dca_playbooks
    add column if not exists spacing_kind text not null default 'percent',
    add column if not exists atr_period integer,
    add column if not exists atr_spacing_mult numeric,
    add column if not exists take_profit_kind text not null default 'percent',
    add column if not exists take_profit_atr_mult numeric;

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_spacing_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_spacing_kind_check
    check (spacing_kind in ('percent', 'atr'));

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_take_profit_kind_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_take_profit_kind_check
    check (take_profit_kind in ('percent', 'atr'));

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_atr_period_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_atr_period_check
    check (
        atr_period is null
        or (
            atr_period >= 2
            and atr_period <= 400
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_atr_spacing_mult_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_atr_spacing_mult_check
    check (
        atr_spacing_mult is null
        or (
            atr_spacing_mult >= 0.1
            and atr_spacing_mult <= 50
        )
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_take_profit_atr_mult_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_take_profit_atr_mult_check
    check (
        take_profit_atr_mult is null
        or (
            take_profit_atr_mult >= 0.1
            and take_profit_atr_mult <= 50
        )
    );
