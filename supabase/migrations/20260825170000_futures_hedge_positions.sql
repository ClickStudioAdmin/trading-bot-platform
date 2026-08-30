-- Hedge: one open long and one open short per contract on the same book.

drop index if exists public.futures_positions_one_open_per_symbol;

create unique index futures_positions_one_open_per_symbol_side
    on public.futures_positions (account_id, symbol, side)
    where status = 'open';
