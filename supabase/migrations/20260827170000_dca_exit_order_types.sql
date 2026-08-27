-- Phase 11: take profit / stop loss may rest as market or limit.

alter table public.dca_playbooks
    add column if not exists take_profit_order_type text,
    add column if not exists stop_loss_order_type text;

update public.dca_playbooks
set
    take_profit_order_type = coalesce(take_profit_order_type, 'market'),
    stop_loss_order_type = coalesce(stop_loss_order_type, 'market');

alter table public.dca_playbooks
    alter column take_profit_order_type set default 'market',
    alter column take_profit_order_type set not null,
    alter column stop_loss_order_type set default 'market',
    alter column stop_loss_order_type set not null;

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_take_profit_order_type_check,
    drop constraint if exists dca_playbooks_stop_loss_order_type_check;

alter table public.dca_playbooks
    add constraint dca_playbooks_take_profit_order_type_check
        check (take_profit_order_type in ('market', 'limit')),
    add constraint dca_playbooks_stop_loss_order_type_check
        check (stop_loss_order_type in ('market', 'limit'));
