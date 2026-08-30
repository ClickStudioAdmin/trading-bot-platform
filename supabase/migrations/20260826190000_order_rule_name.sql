-- Filled clips and working limits store the automation or webhook name
-- that placed them, matching futures_positions.rule_name.

alter table public.futures_orders
    add column if not exists rule_name text;

alter table public.futures_working_orders
    add column if not exists rule_name text;
