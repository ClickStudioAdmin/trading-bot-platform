alter table public.futures_positions
    drop constraint if exists futures_positions_source_check;
alter table public.futures_positions
    add constraint futures_positions_source_check
        check (source in ('manual', 'engine', 'webhook'));

alter table public.futures_orders
    drop constraint if exists futures_orders_source_check;
alter table public.futures_orders
    add constraint futures_orders_source_check
        check (source in ('manual', 'engine', 'webhook'));

alter table public.futures_working_orders
    drop constraint if exists futures_working_orders_source_check;
alter table public.futures_working_orders
    add constraint futures_working_orders_source_check
        check (source in ('manual', 'engine', 'webhook'));
