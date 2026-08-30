-- Perps bot exits match the ticket. Backtests may replay DCA.

alter table public.futures_automation_rules
    add column if not exists take_profit numeric
        check (take_profit is null or take_profit > 0),
    add column if not exists stop_loss numeric
        check (stop_loss is null or stop_loss > 0),
    add column if not exists tp_trigger text
        check (tp_trigger is null or tp_trigger in ('last', 'mark', 'index')),
    add column if not exists sl_trigger text
        check (sl_trigger is null or sl_trigger in ('last', 'mark', 'index')),
    add column if not exists tpsl_mode text
        check (tpsl_mode is null or tpsl_mode in ('full', 'partial')),
    add column if not exists tp_qty numeric
        check (tp_qty is null or tp_qty > 0),
    add column if not exists sl_qty numeric
        check (sl_qty is null or sl_qty > 0),
    add column if not exists tp_order_type text
        check (tp_order_type is null or tp_order_type in ('market', 'limit')),
    add column if not exists sl_order_type text
        check (sl_order_type is null or sl_order_type in ('market', 'limit')),
    add column if not exists tp_limit_price numeric
        check (tp_limit_price is null or tp_limit_price > 0),
    add column if not exists sl_limit_price numeric
        check (sl_limit_price is null or sl_limit_price > 0),
    add column if not exists trailing_stop numeric
        check (trailing_stop is null or trailing_stop > 0),
    add column if not exists trailing_active numeric
        check (trailing_active is null or trailing_active > 0);

alter table public.backtest_runs
    drop constraint if exists backtest_runs_desk_type_check;

alter table public.backtest_runs
    add constraint backtest_runs_desk_type_check
    check (desk_type in ('perps', 'dca'));
