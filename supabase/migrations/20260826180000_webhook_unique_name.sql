-- Phase 9: webhook names are unique per book (case-insensitive).

update public.futures_webhooks as hook
set name = left(trim(hook.name), 28) || '-' || substr(replace(hook.id::text, '-', ''), 1, 11)
from (
    select
        id,
        row_number() over (
            partition by account_id, lower(trim(name))
            order by created_at, id
        ) as n
    from public.futures_webhooks
) as ranked
where hook.id = ranked.id
    and ranked.n > 1;

create unique index if not exists futures_webhooks_account_name_idx
    on public.futures_webhooks (account_id, lower(name));
