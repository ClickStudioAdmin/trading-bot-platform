-- DCA entry stacks. Null keeps confirm_* / short_confirm_* as one And filter.

alter table public.dca_playbooks
    add column if not exists entry_expr jsonb,
    add column if not exists short_entry_expr jsonb;

comment on column public.dca_playbooks.entry_expr is
    'Entry conditions after the start. Null means confirm_* is the only And filter.';

comment on column public.dca_playbooks.short_entry_expr is
    'Short entry conditions when direction is both. Null means short_confirm_* is the only And filter.';
