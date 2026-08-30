-- Partial take profit / stop loss qty on Futures positions and working limits.

alter table public.futures_positions
    add column tpsl_mode text check (
        tpsl_mode is null or tpsl_mode in ('full', 'partial')
    ),
    add column tp_qty numeric check (tp_qty is null or tp_qty > 0),
    add column sl_qty numeric check (sl_qty is null or sl_qty > 0);

alter table public.futures_working_orders
    add column tpsl_mode text check (
        tpsl_mode is null or tpsl_mode in ('full', 'partial')
    ),
    add column tp_qty numeric check (tp_qty is null or tp_qty > 0),
    add column sl_qty numeric check (sl_qty is null or sl_qty > 0);
