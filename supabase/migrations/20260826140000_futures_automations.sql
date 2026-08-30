-- Phase 8: alert automations for Futures. Desk commands stay on runFuturesCommand.
-- Not a copy of cash-and-carry paper_rules.

create table public.futures_automation_rules (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    account_id uuid not null references public.trading_accounts (id) on delete cascade,
    name text not null default 'Rule'
        check (char_length(trim(name)) between 1 and 40),
    sort_order integer not null default 0,
    mode text not null default 'active'
        check (mode in ('active', 'reduce_only', 'disabled')),
    symbol text not null check (
        char_length(symbol) between 4 and 32
        and symbol ~ '^[A-Z0-9]+$'
    ),
    action text not null check (action in ('buy', 'sell', 'flatten')),
    close_side text check (close_side in ('long', 'short')),
    order_type text not null default 'market'
        check (order_type in ('market', 'limit')),
    size_unit text not null default 'qty'
        check (size_unit in ('qty', 'usdt')),
    size numeric check (size is null or size > 0),
    limit_price numeric check (limit_price is null or limit_price > 0),
    trigger_by text not null default 'last'
        check (trigger_by in ('last', 'mark', 'index')),
    trigger_compare text not null default 'gte'
        check (trigger_compare in ('gte', 'lte')),
    trigger_price numeric not null check (trigger_price > 0),
    skip_if_open boolean not null default true,
    condition_true boolean not null default false,
    last_fired_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (
        (
            action in ('buy', 'sell')
            and close_side is null
            and size is not null
        )
        or (
            action = 'flatten'
            and close_side is not null
        )
    ),
    check (
        order_type = 'market'
        or limit_price is not null
    )
);

create index futures_automation_rules_account_sort_idx
    on public.futures_automation_rules (account_id, sort_order, id);

create or replace function public.futures_automation_rules_match_account_user()
returns trigger
language plpgsql
as $$
declare
    account_user uuid;
begin
    select user_id into account_user
    from public.trading_accounts
    where id = new.account_id;
    if account_user is null then
        raise exception 'trading account not found';
    end if;
    if account_user is distinct from new.user_id then
        raise exception 'futures automation user must match the account';
    end if;
    return new;
end;
$$;

create trigger futures_automation_rules_match_account_user
    before insert or update on public.futures_automation_rules
    for each row
    execute procedure public.futures_automation_rules_match_account_user();

alter table public.futures_automation_rules enable row level security;

create policy futures_automation_rules_select_own
    on public.futures_automation_rules
    for select
    to authenticated
    using (user_id = auth.uid());

create policy futures_automation_rules_insert_own
    on public.futures_automation_rules
    for insert
    to authenticated
    with check (user_id = auth.uid());

create policy futures_automation_rules_update_own
    on public.futures_automation_rules
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy futures_automation_rules_delete_own
    on public.futures_automation_rules
    for delete
    to authenticated
    using (user_id = auth.uid());

revoke all on table public.futures_automation_rules from anon, authenticated;
grant select, insert, update, delete on table public.futures_automation_rules to authenticated;

alter table public.futures_positions
    drop constraint if exists futures_positions_source_check;
alter table public.futures_positions
    add constraint futures_positions_source_check
        check (source in ('manual', 'engine'));
alter table public.futures_positions
    add column if not exists rule_id uuid
        references public.futures_automation_rules (id) on delete set null;
alter table public.futures_positions
    add column if not exists rule_name text;

alter table public.futures_orders
    drop constraint if exists futures_orders_source_check;
alter table public.futures_orders
    add constraint futures_orders_source_check
        check (source in ('manual', 'engine'));

alter table public.futures_working_orders
    drop constraint if exists futures_working_orders_source_check;
alter table public.futures_working_orders
    add constraint futures_working_orders_source_check
        check (source in ('manual', 'engine'));
