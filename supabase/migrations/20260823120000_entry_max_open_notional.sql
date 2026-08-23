-- Snapshot Max Position Size on carries and paper orders so the order
-- card can show the cap that was armed at fill time.

alter table public.paper_carries
    add column entry_max_open_notional_usdt numeric check (
        entry_max_open_notional_usdt is null
        or entry_max_open_notional_usdt > 0
    );

alter table public.paper_orders
    add column entry_max_open_notional_usdt numeric check (
        entry_max_open_notional_usdt is null
        or entry_max_open_notional_usdt > 0
    );

update public.paper_carries as carries
set entry_max_open_notional_usdt = rules.max_open_notional_usdt
from public.paper_rules as rules
where carries.rule_id = rules.id
  and carries.entry_max_open_notional_usdt is null;

update public.paper_orders as orders
set entry_max_open_notional_usdt = carries.entry_max_open_notional_usdt
from public.paper_carries as carries
where orders.carry_id = carries.id
  and orders.entry_max_open_notional_usdt is null;
