-- Snapshot the layer that opened an engine carry, and store per-trade exits.

alter table public.paper_carries
    add column entry_min_net_apr numeric,
    add column entry_min_dte numeric,
    add column entry_max_dte numeric,
    add column entry_min_capacity_usdt numeric,
    add column close_max_dte numeric,
    add column close_min_net_apr numeric,
    add column take_profit_pct numeric,
    add column stop_loss_pct numeric;

update public.paper_carries as carries
set
    entry_min_net_apr = rules.min_net_apr,
    entry_min_dte = rules.min_dte,
    entry_max_dte = rules.max_dte,
    entry_min_capacity_usdt = rules.min_capacity_usdt,
    close_max_dte = rules.close_max_dte,
    close_min_net_apr = rules.close_min_net_apr,
    take_profit_pct = rules.take_profit_pct,
    stop_loss_pct = rules.stop_loss_pct
from public.paper_rules as rules
where carries.rule_id = rules.id
  and carries.source = 'engine';
