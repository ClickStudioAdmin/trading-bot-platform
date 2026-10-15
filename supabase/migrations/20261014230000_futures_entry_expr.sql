-- Perps bots: And/Or entry conditions after the initial trigger.
-- Null keeps confirm_* as one And. The app validates the json shape.

alter table public.futures_automation_rules
    add column if not exists entry_expr jsonb;
