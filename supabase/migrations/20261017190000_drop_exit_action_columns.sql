-- Drop the exit-action columns applied by 20261017180000.
-- That version stays in the migration history. This file removes the columns
-- until the exit-action work is merged again.

alter table public.dca_playbooks
    drop column if exists exit_actions,
    drop column if exists short_exit_actions;

alter table public.futures_automation_rules
    drop column if exists exit_actions;

alter table public.futures_positions
    drop column if exists exit_runtime;
