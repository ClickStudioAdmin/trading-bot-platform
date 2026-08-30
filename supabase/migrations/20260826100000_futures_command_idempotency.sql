-- Optional command idempotency. Manual clicks omit the key.
-- Automations can send one later; Bybit gets it as orderLinkId.

alter table public.futures_working_orders
    add column idempotency_key text
        check (
            idempotency_key is null
            or char_length(idempotency_key) between 1 and 36
        );

alter table public.futures_orders
    add column idempotency_key text
        check (
            idempotency_key is null
            or char_length(idempotency_key) between 1 and 36
        );

create unique index futures_working_orders_idempotency_idx
    on public.futures_working_orders (account_id, idempotency_key)
    where idempotency_key is not null;

create unique index futures_orders_idempotency_idx
    on public.futures_orders (account_id, idempotency_key)
    where idempotency_key is not null;

create table public.futures_command_receipts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    account_id uuid not null references public.trading_accounts (id),
    idempotency_key text not null check (
        char_length(idempotency_key) between 1 and 36
    ),
    flash text not null,
    working_id uuid,
    position_id uuid,
    created_at timestamptz not null default now(),
    unique (account_id, idempotency_key)
);

create index futures_command_receipts_account_idx
    on public.futures_command_receipts (account_id, created_at desc);

alter table public.futures_command_receipts enable row level security;

create policy futures_command_receipts_select_own
    on public.futures_command_receipts
    for select
    to authenticated
    using (user_id = auth.uid());

grant select on table public.futures_command_receipts to authenticated;
revoke insert, update, delete on table public.futures_command_receipts
    from anon, authenticated;
