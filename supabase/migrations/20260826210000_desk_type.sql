-- Phase 10: typed desks. Type is set at create and cannot change.

alter table public.trading_accounts
    add column desk_type text not null default 'cash_and_carry'
        check (desk_type in ('cash_and_carry', 'perps', 'signal_follower'));

update public.trading_accounts as accounts
set desk_type = 'perps'
where exists (
        select 1 from public.futures_positions as rows
        where rows.account_id = accounts.id
    )
    or exists (
        select 1 from public.futures_orders as rows
        where rows.account_id = accounts.id
    )
    or exists (
        select 1 from public.futures_working_orders as rows
        where rows.account_id = accounts.id
    )
    or exists (
        select 1 from public.futures_automation_rules as rows
        where rows.account_id = accounts.id
    )
    or exists (
        select 1 from public.futures_webhooks as rows
        where rows.account_id = accounts.id
    )
    or exists (
        select 1 from public.strategy_settings as settings
        where settings.account_id = accounts.id
            and settings.strategy_id = 'futures'
    );

update public.trading_accounts as accounts
set desk_type = 'cash_and_carry'
where desk_type = 'perps'
    and (
        exists (
            select 1 from public.paper_carries as rows
            where rows.account_id = accounts.id
        )
        or exists (
            select 1 from public.paper_rules as rows
            where rows.account_id = accounts.id
        )
        or exists (
            select 1 from public.paper_engine_settings as settings
            where settings.account_id = accounts.id
                and (
                    settings.exchange_connection_id is not null
                    or settings.enabled is true
                )
        )
    );

create or replace function public.trading_accounts_forbid_desk_type_change()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'UPDATE' and new.desk_type is distinct from old.desk_type then
        raise exception 'trading account desk type cannot change';
    end if;
    return new;
end;
$$;

create trigger trading_accounts_forbid_desk_type_change
    before update on public.trading_accounts
    for each row
    execute procedure public.trading_accounts_forbid_desk_type_change();
