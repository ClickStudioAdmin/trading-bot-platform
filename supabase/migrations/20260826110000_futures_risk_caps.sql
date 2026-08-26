-- Buy/Sell risk caps on the Futures strategy. Empty means no cap. Close is uncapped.

alter table public.strategy_settings
    add column max_qty_per_symbol numeric
        check (max_qty_per_symbol is null or max_qty_per_symbol > 0),
    add column max_notional_per_symbol numeric
        check (max_notional_per_symbol is null or max_notional_per_symbol > 0),
    add column max_open_rows integer
        check (max_open_rows is null or max_open_rows > 0);
