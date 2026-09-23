-- DCA stores the playbook id in futures_positions.rule_id. That id is not a
-- futures_automation_rules row, so the foreign key rejected the insert after
-- Bybit had already filled the order.

alter table public.futures_positions
    drop constraint if exists futures_positions_rule_id_fkey;
