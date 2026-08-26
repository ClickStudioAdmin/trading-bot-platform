-- Qty caps do not work across symbols. Value (max_notional_per_symbol) stays.

alter table public.strategy_settings
    drop column if exists max_qty_per_symbol;
