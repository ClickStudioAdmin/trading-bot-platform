-- Phase 8: Futures strategy bind + single-leg blotter.
-- Cash-and-carry stays on paper_engine_settings.

create table public.strategy_settings (
    account_id uuid not null references public.trading_accounts (id) on delete cascade,
    strategy_id text not null check (
        strategy_id in ('futures')
    ),
    user_id uuid not null,
    exchange_connection_id uuid
        references public.exchange_connections (id) on delete restrict,
    reduce_only boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (account_id, strategy_id)
);

create index strategy_settings_exchange_connection_idx
    on public.strategy_settings (exchange_connection_id)
    where exchange_connection_id is not null;

create or replace function public.strategy_settings_match_account_user()
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
        raise exception 'strategy settings user must match the account';
    end if;
    return new;
end;
$$;

create trigger strategy_settings_match_account_user
    before insert or update on public.strategy_settings
    for each row
    execute procedure public.strategy_settings_match_account_user();

alter table public.strategy_settings enable row level security;

create policy strategy_settings_select_own
    on public.strategy_settings
    for select
    to authenticated
    using (user_id = auth.uid());

revoke all on table public.strategy_settings from anon, authenticated;
grant select on table public.strategy_settings to authenticated;

create table public.futures_positions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    account_id uuid not null references public.trading_accounts (id),
    symbol text not null check (
        char_length(symbol) between 4 and 32
        and symbol ~ '^[A-Z0-9]+$'
    ),
    side text not null check (side in ('long', 'short')),
    qty numeric not null check (qty > 0),
    entry_price numeric not null check (entry_price > 0),
    notional_usdt numeric not null check (notional_usdt > 0),
    realized_usdt numeric not null default 0,
    status text not null default 'open' check (status in ('open', 'closed')),
    source text not null check (source in ('manual')),
    opened_at timestamptz not null default now(),
    closed_at timestamptz,
    venue text,
    environment text,
    check (
        (
            status = 'open'
            and closed_at is null
        )
        or (
            status = 'closed'
            and closed_at is not null
        )
    )
);

create unique index futures_positions_one_open_per_symbol
    on public.futures_positions (account_id, symbol)
    where status = 'open';

create index futures_positions_account_status_idx
    on public.futures_positions (account_id, status, opened_at desc);

create index futures_positions_user_status_idx
    on public.futures_positions (user_id, status, opened_at desc);

alter table public.futures_positions enable row level security;

create policy futures_positions_select_own
    on public.futures_positions
    for select
    to authenticated
    using (user_id = auth.uid());

create policy futures_positions_insert_own
    on public.futures_positions
    for insert
    to authenticated
    with check (user_id = auth.uid());

create policy futures_positions_update_own
    on public.futures_positions
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

grant select, insert, update on table public.futures_positions to authenticated;
revoke delete on table public.futures_positions from anon, authenticated;

create table public.futures_orders (
    id uuid primary key default gen_random_uuid(),
    position_id uuid not null references public.futures_positions (id),
    user_id uuid not null,
    account_id uuid not null references public.trading_accounts (id),
    action text not null check (action in ('buy', 'sell', 'flatten')),
    qty numeric not null check (qty > 0),
    price numeric,
    notional_usdt numeric,
    source text not null check (source in ('manual')),
    filled_at timestamptz not null default now(),
    venue text,
    environment text,
    venue_order_id text
);

create index futures_orders_position_filled_idx
    on public.futures_orders (position_id, filled_at, id);

create index futures_orders_account_filled_idx
    on public.futures_orders (account_id, filled_at desc);

alter table public.futures_orders enable row level security;

create policy futures_orders_select_own
    on public.futures_orders
    for select
    to authenticated
    using (user_id = auth.uid());

create policy futures_orders_insert_own
    on public.futures_orders
    for insert
    to authenticated
    with check (user_id = auth.uid());

grant select, insert on table public.futures_orders to authenticated;
revoke update, delete on table public.futures_orders from anon, authenticated;
