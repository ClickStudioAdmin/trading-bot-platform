-- Roadmap 2 step 1: immutable venue + venue environment on each desk.

alter table public.trading_accounts
    add column venue text not null default 'bybit'
        check (venue in ('bybit', 'hyperliquid'));

alter table public.trading_accounts
    add column venue_environment text
        check (
            venue_environment is null
            or venue_environment in ('demo', 'live', 'testnet')
        );

alter table public.trading_accounts
    add constraint trading_accounts_paper_environment_null
        check (mode <> 'paper' or venue_environment is null);

update public.trading_accounts as accounts
set venue_environment = connections.environment
from public.strategy_settings as settings
inner join public.exchange_connections as connections
    on connections.id = settings.exchange_connection_id
where settings.account_id = accounts.id
    and accounts.mode = 'live'
    and accounts.venue_environment is null
    and connections.venue = accounts.venue
    and connections.environment in ('demo', 'live', 'testnet');

update public.trading_accounts as accounts
set venue_environment = connections.environment
from public.paper_engine_settings as settings
inner join public.exchange_connections as connections
    on connections.id = settings.exchange_connection_id
where settings.account_id = accounts.id
    and accounts.mode = 'live'
    and accounts.venue_environment is null
    and connections.venue = accounts.venue
    and connections.environment in ('demo', 'live', 'testnet');

create or replace function public.trading_accounts_forbid_venue_change()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'UPDATE' and new.venue is distinct from old.venue then
        raise exception 'trading account venue cannot change';
    end if;
    if tg_op = 'UPDATE'
        and old.venue_environment is not null
        and new.venue_environment is distinct from old.venue_environment then
        raise exception 'trading account venue environment cannot change';
    end if;
    return new;
end;
$$;

create trigger trading_accounts_forbid_venue_change
    before update on public.trading_accounts
    for each row
    execute procedure public.trading_accounts_forbid_venue_change();
