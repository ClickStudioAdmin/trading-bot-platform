-- Limit take profit / stop loss: trigger can rest a limit instead of a market close.

alter table public.futures_positions
    add column tp_order_type text check (
        tp_order_type is null or tp_order_type in ('market', 'limit')
    ),
    add column sl_order_type text check (
        sl_order_type is null or sl_order_type in ('market', 'limit')
    ),
    add column tp_limit_price numeric check (
        tp_limit_price is null or tp_limit_price > 0
    ),
    add column sl_limit_price numeric check (
        sl_limit_price is null or sl_limit_price > 0
    );

alter table public.futures_working_orders
    add column tp_order_type text check (
        tp_order_type is null or tp_order_type in ('market', 'limit')
    ),
    add column sl_order_type text check (
        sl_order_type is null or sl_order_type in ('market', 'limit')
    ),
    add column tp_limit_price numeric check (
        tp_limit_price is null or tp_limit_price > 0
    ),
    add column sl_limit_price numeric check (
        sl_limit_price is null or sl_limit_price > 0
    );
