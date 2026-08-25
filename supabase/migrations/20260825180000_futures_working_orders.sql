-- Resting Futures limits. Fills stay append-only on futures_orders.
-- Working rows may update status and filled qty.

create table public.futures_working_orders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    account_id uuid not null references public.trading_accounts (id),
    position_id uuid references public.futures_positions (id),
    symbol text not null check (
        char_length(symbol) between 4 and 32
        and symbol ~ '^[A-Z0-9]+$'
    ),
    action text not null check (action in ('buy', 'sell')),
    side text not null check (side in ('long', 'short')),
    qty numeric not null check (qty > 0),
    filled_qty numeric not null default 0 check (filled_qty >= 0),
    remaining_qty numeric not null check (remaining_qty >= 0),
    limit_price numeric not null check (limit_price > 0),
    status text not null default 'open' check (
        status in ('open', 'filled', 'cancelled', 'rejected')
    ),
    source text not null check (source in ('manual')),
    venue text,
    environment text,
    venue_order_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    closed_at timestamptz,
    check (
        (
            status = 'open'
            and closed_at is null
            and remaining_qty > 0
        )
        or (
            status <> 'open'
            and closed_at is not null
        )
    )
);

create index futures_working_orders_account_status_idx
    on public.futures_working_orders (account_id, status, created_at desc);

create index futures_working_orders_open_idx
    on public.futures_working_orders (account_id)
    where status = 'open';

create unique index futures_working_orders_venue_order_idx
    on public.futures_working_orders (account_id, venue_order_id)
    where venue_order_id is not null;

alter table public.futures_working_orders enable row level security;

create policy futures_working_orders_select_own
    on public.futures_working_orders
    for select
    to authenticated
    using (user_id = auth.uid());

create policy futures_working_orders_insert_own
    on public.futures_working_orders
    for insert
    to authenticated
    with check (user_id = auth.uid());

create policy futures_working_orders_update_own
    on public.futures_working_orders
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

grant select, insert, update on table public.futures_working_orders
    to authenticated;
revoke delete on table public.futures_working_orders from anon, authenticated;
