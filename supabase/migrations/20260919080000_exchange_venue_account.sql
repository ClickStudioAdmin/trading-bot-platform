-- Store the venue account identity (Bybit UID / Hyperliquid address) and
-- reject a second key on the same login + venue + environment + account.
-- Existing rows stay null until the key is checked or replaced.

alter table public.exchange_connections
    add column if not exists venue_account_id text
        check (
            venue_account_id is null
            or char_length(trim(venue_account_id)) between 4 and 64
        );

comment on column public.exchange_connections.venue_account_id is
    'Venue account identity: Bybit userID, or Hyperliquid account address (lowercase). Distinct from key_fingerprint (last 4 of the key).';

create unique index if not exists exchange_connections_login_venue_account_uidx
    on public.exchange_connections (user_id, venue, environment, venue_account_id)
    where venue_account_id is not null;

revoke all on table public.exchange_connections from anon, authenticated;

grant select (
    id,
    user_id,
    venue,
    environment,
    label,
    key_fingerprint,
    venue_account_id,
    status,
    verified_at,
    created_at,
    updated_at
) on table public.exchange_connections to authenticated;
