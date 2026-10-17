-- Exit action lists. Null keeps the classic take-profit, stop, trailing, and hard-exit columns.
-- When a list is set, the worker runs that list and skips those columns.
-- exit_runtime stores arm state (armed time, peak, condition edge) on the open position.

alter table public.dca_playbooks
    add column if not exists exit_actions jsonb,
    add column if not exists short_exit_actions jsonb;

alter table public.futures_automation_rules
    add column if not exists exit_actions jsonb;

alter table public.futures_positions
    add column if not exists exit_runtime jsonb;

comment on column public.dca_playbooks.exit_actions is
    'Long exit action list. Null keeps the classic exit columns.';

comment on column public.dca_playbooks.short_exit_actions is
    'Short exit action list when direction is both. Null keeps the short classic columns.';

comment on column public.futures_automation_rules.exit_actions is
    'Long exit action list. Short actions for direction both live on short_entry.actions. Null keeps the classic exit columns.';

comment on column public.futures_positions.exit_runtime is
    'Arm state for an exit action list: armed time, trailing peak, and the last condition edge.';
