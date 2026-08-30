-- Signal webhooks can be the entry condition on a Futures automation.
-- Do not put an inline CHECK on entry_source: Postgres names that
-- futures_automation_rules_entry_source_check and the pairing constraint
-- would collide.

alter table public.futures_automation_rules
    add column if not exists entry_source text not null default 'price';

alter table public.futures_automation_rules
    add column if not exists webhook_id uuid
        references public.futures_webhooks (id) on delete restrict;

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_entry_source_check;

alter table public.futures_automation_rules
    add constraint futures_automation_rules_entry_source_check check (
        entry_source in ('price', 'webhook')
        and (
            (
                entry_source = 'price'
                and webhook_id is null
            )
            or (
                entry_source = 'webhook'
                and webhook_id is not null
            )
        )
    );

create index if not exists futures_automation_rules_webhook_idx
    on public.futures_automation_rules (webhook_id)
    where webhook_id is not null;
