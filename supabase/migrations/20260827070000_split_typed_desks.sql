-- Phase 10: start over on typed desks.
-- Purge blotter history, then split books that still have both C&C and Futures config.

delete from public.futures_command_receipts;
delete from public.futures_working_orders;
delete from public.futures_orders;
delete from public.futures_positions;
delete from public.paper_orders;
delete from public.paper_carries;

do $$
declare
  src record;
  new_id uuid;
  new_name text;
  n integer;
begin
  for src in
    select accounts.*
    from public.trading_accounts as accounts
    where accounts.desk_type = 'cash_and_carry'
      and (
        exists (
          select 1
          from public.strategy_settings as settings
          where settings.account_id = accounts.id
            and settings.strategy_id = 'futures'
        )
        or exists (
          select 1
          from public.futures_automation_rules as rules
          where rules.account_id = accounts.id
        )
        or exists (
          select 1
          from public.futures_webhooks as hooks
          where hooks.account_id = accounts.id
        )
      )
  loop
    new_name := left(trim(src.name) || ' Perps', 40);
    n := 2;
    while exists (
      select 1
      from public.trading_accounts as other
      where other.user_id = src.user_id
        and lower(other.name) = lower(new_name)
    ) loop
      new_name := left(trim(src.name), 32) || ' P' || n::text;
      n := n + 1;
    end loop;

    insert into public.trading_accounts (user_id, name, mode, desk_type)
    values (src.user_id, new_name, src.mode, 'perps')
    returning id into new_id;

    insert into public.paper_engine_settings (user_id, account_id, enabled)
    values (src.user_id, new_id, false);

    update public.strategy_settings
    set account_id = new_id, updated_at = now()
    where account_id = src.id
      and strategy_id = 'futures';

    update public.futures_webhooks
    set account_id = new_id
    where account_id = src.id;

    update public.futures_automation_rules
    set account_id = new_id
    where account_id = src.id;

    update public.strategy_settings as dest
    set
      exchange_connection_id = paper.exchange_connection_id,
      updated_at = now()
    from public.paper_engine_settings as paper
    where dest.account_id = new_id
      and dest.strategy_id = 'futures'
      and dest.exchange_connection_id is null
      and paper.account_id = src.id
      and paper.exchange_connection_id is not null;

    insert into public.strategy_settings (
      account_id,
      strategy_id,
      user_id,
      exchange_connection_id
    )
    select
      new_id,
      'futures',
      src.user_id,
      paper.exchange_connection_id
    from public.paper_engine_settings as paper
    where paper.account_id = src.id
      and paper.exchange_connection_id is not null
      and not exists (
        select 1
        from public.strategy_settings as settings
        where settings.account_id = new_id
          and settings.strategy_id = 'futures'
      );
  end loop;
end $$;
