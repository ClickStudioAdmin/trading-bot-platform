-- Pending-close: blotter rows stay visible as closing / cancelling until the venue acks.

alter table public.futures_positions
    drop constraint if exists futures_positions_status_check;

alter table public.futures_positions
    add constraint futures_positions_status_check
        check (status in ('open', 'closing', 'closed'));

alter table public.futures_positions
    drop constraint if exists futures_positions_check;

alter table public.futures_positions
    add constraint futures_positions_state_check
    check (
        (
            status in ('open', 'closing')
            and closed_at is null
        )
        or (
            status = 'closed'
            and closed_at is not null
        )
    );

drop index if exists public.futures_positions_one_open_per_symbol_side;

create unique index futures_positions_one_open_per_symbol_side
    on public.futures_positions (account_id, symbol, side)
    where status in ('open', 'closing');

alter table public.futures_working_orders
    drop constraint if exists futures_working_orders_status_check;

alter table public.futures_working_orders
    add constraint futures_working_orders_status_check
        check (status in ('open', 'cancelling', 'filled', 'cancelled', 'rejected'));

alter table public.futures_working_orders
    drop constraint if exists futures_working_orders_check;

alter table public.futures_working_orders
    add constraint futures_working_orders_state_check
    check (
        (
            status in ('open', 'cancelling')
            and closed_at is null
            and remaining_qty > 0
        )
        or (
            status not in ('open', 'cancelling')
            and closed_at is not null
        )
    );

drop index if exists public.futures_working_orders_open_idx;

create index futures_working_orders_open_idx
    on public.futures_working_orders (account_id)
    where status in ('open', 'cancelling');
