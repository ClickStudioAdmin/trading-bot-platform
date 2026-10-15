-- Hard Exit price cross and signal webhook. Null keeps exit_if_*.

alter table public.dca_playbooks
    add column if not exists exit_hard jsonb,
    add column if not exists short_exit_hard jsonb;

alter table public.futures_automation_rules
    add column if not exists exit_hard jsonb;

comment on column public.dca_playbooks.exit_hard is
    'Price cross or signal webhook Hard Exit. Null keeps exit_if_*.';

comment on column public.dca_playbooks.short_exit_hard is
    'Short-leg price cross or signal webhook Hard Exit. Null keeps short_exit_if_*.';

comment on column public.futures_automation_rules.exit_hard is
    'Price cross or signal webhook Hard Exit. Null keeps exit_if_*.';
