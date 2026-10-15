-- DCA Both: the short leg can start on a different trigger than the long leg.
-- Null short_start_kind keeps the shared start_kind for rows saved before this.

alter table public.dca_playbooks
    add column if not exists short_start_kind text,
    add column if not exists short_webhook_id uuid references public.futures_webhooks (id) on delete set null;

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_start_kind_check;

alter table public.dca_playbooks
    add constraint dca_playbooks_short_start_kind_check
    check (
        short_start_kind is null
        or short_start_kind in ('immediate', 'price', 'webhook', 'indicator', 'trend')
    );

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_webhook_check;

alter table public.dca_playbooks
    add constraint dca_playbooks_short_webhook_check
    check (
        short_start_kind is distinct from 'webhook'
        or short_webhook_id is not null
    );

create index if not exists dca_playbooks_short_webhook_idx
    on public.dca_playbooks (short_webhook_id);

comment on column public.dca_playbooks.short_start_kind is
    'Short-leg start when direction is both. Null uses start_kind.';

comment on column public.dca_playbooks.short_webhook_id is
    'Signal webhook for the short leg when short_start_kind is webhook.';
