-- Venue fill metadata on blotter orders. Paper rows leave these null.

alter table public.paper_orders
    add column if not exists venue text,
    add column if not exists environment text,
    add column if not exists spot_order_id text,
    add column if not exists future_order_id text,
    add column if not exists fill_qty numeric,
    add column if not exists fill_spot_price numeric,
    add column if not exists fill_future_price numeric;
