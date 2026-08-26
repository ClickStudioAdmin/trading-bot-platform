-- Phase 9: named webhooks. Order = TV sends size. Signal = arm / exit only.

create table public.futures_webhooks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    account_id uuid not null references public.trading_accounts (id) on delete cascade,
    name text not null default 'TradingView'
        check (char_length(trim(name)) between 1 and 40),
    kind text not null default 'order'
        check (kind in ('order', 'signal')),
    webhook_token_hash text not null
        check (
            char_length(webhook_token_hash) = 64
            and webhook_token_hash ~ '^[0-9a-f]+$'
        ),
    webhook_token_ciphertext bytea not null,
    webhook_token_nonce bytea not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index futures_webhooks_token_hash_idx
    on public.futures_webhooks (webhook_token_hash);

create index futures_webhooks_account_idx
    on public.futures_webhooks (account_id, created_at);

create or replace function public.futures_webhooks_match_account_user()
returns trigger
language plpgsql
as $$
declare
    account_user uuid;
begin
    select user_id into account_user
    from public.trading_accounts
    where id = new.account_id;
    if account_user is null then
        raise exception 'trading account not found';
    end if;
    if account_user is distinct from new.user_id then
        raise exception 'webhook user must match the account';
    end if;
    return new;
end;
$$;

create trigger futures_webhooks_match_account_user
    before insert or update on public.futures_webhooks
    for each row
    execute procedure public.futures_webhooks_match_account_user();

alter table public.futures_webhooks enable row level security;

create policy futures_webhooks_select_own
    on public.futures_webhooks
    for select
    to authenticated
    using (user_id = auth.uid());

revoke all on table public.futures_webhooks from anon, authenticated;
grant select on table public.futures_webhooks to authenticated;

insert into public.futures_webhooks (
    user_id,
    account_id,
    name,
    kind,
    webhook_token_hash,
    webhook_token_ciphertext,
    webhook_token_nonce
)
select
    user_id,
    account_id,
    'TradingView',
    'order',
    webhook_token_hash,
    webhook_token_ciphertext,
    webhook_token_nonce
from public.strategy_settings
where webhook_token_hash is not null
    and webhook_token_ciphertext is not null
    and webhook_token_nonce is not null;
