-- Hard Exit conditions after the first row. Null keeps the single exit_if_* / exit_hard exit.

alter table public.dca_playbooks
    add column if not exists exit_expr jsonb,
    add column if not exists short_exit_expr jsonb;

alter table public.futures_automation_rules
    add column if not exists exit_expr jsonb;

comment on column public.dca_playbooks.exit_expr is
    'Hard Exit conditions after the first row. Null keeps the single exit_if_* / exit_hard exit.';

comment on column public.dca_playbooks.short_exit_expr is
    'Short-leg Hard Exit conditions after the first row. Null keeps the single short exit.';

comment on column public.futures_automation_rules.exit_expr is
    'Hard Exit conditions after the first row. Null keeps the single exit_if_* / exit_hard exit.';
