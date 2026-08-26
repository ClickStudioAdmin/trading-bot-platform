-- Trigger-only webhooks can be the entry condition on a Futures automation.

alter table public.futures_automation_rules
    add column entry_source text not null default 'price'
        check (entry_source in ('price', 'webhook')),
    add column webhook_id uuid
        references public.futures_webhooks (id) on delete restrict;

alter table public.futures_automation_rules
    add constraint futures_automation_rules_entry_source_check check (
        (
            entry_source = 'price'
            and webhook_id is null
        )
        or (
            entry_source = 'webhook'
            and webhook_id is not null
        )
    );

create index futures_automation_rules_webhook_idx
    on public.futures_automation_rules (webhook_id)
    where webhook_id is not null;
