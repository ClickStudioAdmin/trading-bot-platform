-- Phase 5: trading accounts. One login, many books. Mode is paper or live and cannot change.

create table public.trading_accounts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    name text not null check (char_length(trim(name)) between 1 and 40),
    mode text not null check (mode in ('paper', 'live')),
    created_at timestamptz not null default now()
);

create unique index trading_accounts_user_name_idx
    on public.trading_accounts (user_id, lower(name));

create index trading_accounts_user_created_idx
    on public.trading_accounts (user_id, created_at);

insert into public.trading_accounts (user_id, name, mode)
select distinct source.user_id, 'Paper', 'paper'
from (
    select user_id from public.members
    union
    select user_id from public.paper_carries
    union
    select user_id from public.paper_rules
    union
    select user_id from public.paper_engine_settings
) as source
where source.user_id is not null;

create or replace function public.trading_accounts_forbid_mode_change()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'UPDATE' and new.mode is distinct from old.mode then
        raise exception 'trading account mode cannot change';
    end if;
    return new;
end;
$$;

create trigger trading_accounts_forbid_mode_change
    before update on public.trading_accounts
    for each row
    execute procedure public.trading_accounts_forbid_mode_change();

alter table public.paper_engine_settings
    add column account_id uuid references public.trading_accounts (id);

update public.paper_engine_settings as settings
set account_id = accounts.id
from public.trading_accounts as accounts
where accounts.user_id = settings.user_id
    and accounts.mode = 'paper'
    and accounts.name = 'Paper';

insert into public.paper_engine_settings (user_id, account_id, enabled)
select accounts.user_id, accounts.id, false
from public.trading_accounts as accounts
left join public.paper_engine_settings as settings
    on settings.account_id = accounts.id
where settings.account_id is null;

alter table public.paper_engine_settings
    drop constraint paper_engine_settings_pkey;

alter table public.paper_engine_settings
    alter column account_id set not null;

alter table public.paper_engine_settings
    add primary key (account_id);

alter table public.paper_rules
    add column account_id uuid references public.trading_accounts (id);

update public.paper_rules as rules
set account_id = accounts.id
from public.trading_accounts as accounts
where accounts.user_id = rules.user_id
    and accounts.mode = 'paper'
    and accounts.name = 'Paper';

alter table public.paper_rules
    alter column account_id set not null;

drop index if exists public.paper_rules_user_sort_idx;

create index paper_rules_account_sort_idx
    on public.paper_rules (account_id, sort_order);

alter table public.paper_carries
    add column account_id uuid references public.trading_accounts (id);

update public.paper_carries as carries
set account_id = accounts.id
from public.trading_accounts as accounts
where accounts.user_id = carries.user_id
    and accounts.mode = 'paper'
    and accounts.name = 'Paper';

alter table public.paper_carries
    alter column account_id set not null;

drop index if exists public.paper_carries_user_status_idx;

create index paper_carries_account_status_idx
    on public.paper_carries (account_id, status, opened_at desc);

alter table public.paper_orders
    add column account_id uuid references public.trading_accounts (id);

update public.paper_orders as orders
set account_id = accounts.id
from public.trading_accounts as accounts
where accounts.user_id = orders.user_id
    and accounts.mode = 'paper'
    and accounts.name = 'Paper';

alter table public.paper_orders
    alter column account_id set not null;

create index paper_orders_account_filled_idx
    on public.paper_orders (account_id, filled_at);

alter table public.event_logs
    add column account_id uuid references public.trading_accounts (id) on delete set null;

update public.event_logs as logs
set account_id = accounts.id
from public.trading_accounts as accounts
where logs.user_id = accounts.user_id
    and accounts.mode = 'paper'
    and accounts.name = 'Paper'
    and logs.account_id is null
    and logs.scope in ('trade', 'strategy');

create index event_logs_account_created_idx
    on public.event_logs (account_id, created_at desc);

alter table public.trading_accounts enable row level security;

create policy trading_accounts_select_own
    on public.trading_accounts
    for select
    to authenticated
    using (user_id = auth.uid());

grant select on table public.trading_accounts to authenticated;

revoke insert, update, delete on table public.trading_accounts from anon, authenticated;
