-- Hyperliquid blotter stores coins (BTC, ETH, OP). Bybit stays BTCUSDT.
-- Length 4 was Bybit-only and rejected BTC.

alter table public.futures_positions
    drop constraint if exists futures_positions_symbol_check;
alter table public.futures_positions
    add constraint futures_positions_symbol_check
        check (
            char_length(symbol) between 2 and 32
            and symbol ~ '^[A-Z0-9]+$'
        );

alter table public.futures_working_orders
    drop constraint if exists futures_working_orders_symbol_check;
alter table public.futures_working_orders
    add constraint futures_working_orders_symbol_check
        check (
            char_length(symbol) between 2 and 32
            and symbol ~ '^[A-Z0-9]+$'
        );

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_symbol_check;
alter table public.futures_automation_rules
    add constraint futures_automation_rules_symbol_check
        check (
            char_length(symbol) between 2 and 32
            and symbol ~ '^[A-Z0-9]+$'
        );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_symbol_check;
alter table public.dca_playbooks
    add constraint dca_playbooks_symbol_check
        check (
            char_length(symbol) between 2 and 32
            and symbol ~ '^[A-Z0-9]+$'
        );
