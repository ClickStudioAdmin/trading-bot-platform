-- Phase 6: venue-agnostic exchange API connections. Live accounts only.
-- Ciphertext is service-role only. Authenticated may select own metadata.

create table public.exchange_connections (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references public.trading_accounts (id) on delete cascade,
    user_id uuid not null,
    venue text not null check (
        char_length(venue) between 1 and 32
        and venue ~ '^[a-z][a-z0-9_]*$'
    ),
    environment text not null check (
        char_length(environment) between 1 and 32
        and environment ~ '^[a-z][a-z0-9_]*$'
    ),
    label text check (
        label is null
        or char_length(trim(label)) between 1 and 40
    ),
    credentials_ciphertext bytea not null
        check (octet_length(credentials_ciphertext) > 17),
    credentials_nonce bytea not null
        check (octet_length(credentials_nonce) = 12),
    key_fingerprint text not null
        check (char_length(key_fingerprint) between 4 and 16),
    status text not null check (status in ('active', 'invalid')),
    verified_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (account_id, venue, environment)
);

create index exchange_connections_account_idx
    on public.exchange_connections (account_id);

create index exchange_connections_user_idx
    on public.exchange_connections (user_id, created_at desc);

create or replace function public.exchange_connections_require_live_account()
returns trigger
language plpgsql
as $$
declare
    account_mode text;
    account_user uuid;
begin
    select mode, user_id into account_mode, account_user
    from public.trading_accounts
    where id = new.account_id;
    if account_user is null then
        raise exception 'trading account not found';
    end if;
    if account_user is distinct from new.user_id then
        raise exception 'exchange connection user must match the account';
    end if;
    if account_mode is distinct from 'live' then
        raise exception 'exchange connections require a live account';
    end if;
    return new;
end;
$$;

create trigger exchange_connections_require_live_account
    before insert or update on public.exchange_connections
    for each row
    execute procedure public.exchange_connections_require_live_account();

alter table public.exchange_connections enable row level security;

create policy exchange_connections_select_own
    on public.exchange_connections
    for select
    to authenticated
    using (user_id = auth.uid());

revoke all on table public.exchange_connections from anon, authenticated;

grant select (
    id,
    account_id,
    user_id,
    venue,
    environment,
    label,
    key_fingerprint,
    status,
    verified_at,
    created_at,
    updated_at
) on table public.exchange_connections to authenticated;
