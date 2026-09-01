-- Stamp venue or paper leverage on each futures position so Performance can
-- show exchange-style ROE (P&L ÷ initial margin) next to on-notional return.

alter table public.futures_positions
    add column leverage numeric
        check (leverage is null or leverage > 0);

alter table public.strategy_settings
    add column paper_leverage numeric
        check (paper_leverage is null or paper_leverage > 0);
