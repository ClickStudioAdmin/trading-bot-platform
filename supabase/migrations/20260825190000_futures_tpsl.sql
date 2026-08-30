-- Take profit / stop loss on Futures positions and working limits.

alter table public.futures_positions
    add column take_profit numeric check (take_profit is null or take_profit > 0),
    add column stop_loss numeric check (stop_loss is null or stop_loss > 0),
    add column tp_trigger text check (
        tp_trigger is null or tp_trigger in ('last', 'mark', 'index')
    ),
    add column sl_trigger text check (
        sl_trigger is null or sl_trigger in ('last', 'mark', 'index')
    );

alter table public.futures_working_orders
    add column take_profit numeric check (take_profit is null or take_profit > 0),
    add column stop_loss numeric check (stop_loss is null or stop_loss > 0),
    add column tp_trigger text check (
        tp_trigger is null or tp_trigger in ('last', 'mark', 'index')
    ),
    add column sl_trigger text check (
        sl_trigger is null or sl_trigger in ('last', 'mark', 'index')
    );
