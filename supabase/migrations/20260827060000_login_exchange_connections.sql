-- Phase 10: exchange connections belong to the login, not a desk.
-- Desks bind a key. The same key may be bound on more than one desk.

with ranked as (
    select
        id,
        user_id,
        venue,
        environment,
        key_fingerprint,
        row_number() over (
            partition by user_id, venue, environment, key_fingerprint
            order by created_at, id
        ) as rn
    from public.exchange_connections
),
keeper as (
    select id, user_id, venue, environment, key_fingerprint
    from ranked
    where rn = 1
),
dup as (
    select ranked.id as old_id, keeper.id as new_id
    from ranked
    inner join keeper
        on keeper.user_id = ranked.user_id
        and keeper.venue = ranked.venue
        and keeper.environment = ranked.environment
        and keeper.key_fingerprint = ranked.key_fingerprint
    where ranked.rn > 1
)
update public.paper_engine_settings as settings
set exchange_connection_id = dup.new_id
from dup
where settings.exchange_connection_id = dup.old_id;

with ranked as (
    select
        id,
        user_id,
        venue,
        environment,
        key_fingerprint,
        row_number() over (
            partition by user_id, venue, environment, key_fingerprint
            order by created_at, id
        ) as rn
    from public.exchange_connections
),
keeper as (
    select id, user_id, venue, environment, key_fingerprint
    from ranked
    where rn = 1
),
dup as (
    select ranked.id as old_id, keeper.id as new_id
    from ranked
    inner join keeper
        on keeper.user_id = ranked.user_id
        and keeper.venue = ranked.venue
        and keeper.environment = ranked.environment
        and keeper.key_fingerprint = ranked.key_fingerprint
    where ranked.rn > 1
)
update public.strategy_settings as settings
set exchange_connection_id = dup.new_id
from dup
where settings.exchange_connection_id = dup.old_id;

delete from public.exchange_connections
where id in (
    select ranked.id
    from (
        select
            id,
            row_number() over (
                partition by user_id, venue, environment, key_fingerprint
                order by created_at, id
            ) as rn
        from public.exchange_connections
    ) as ranked
    where ranked.rn > 1
);

drop trigger if exists exchange_connections_require_live_account
    on public.exchange_connections;
drop function if exists public.exchange_connections_require_live_account();

alter table public.exchange_connections
    drop constraint if exists exchange_connections_account_id_venue_environment_key;

drop index if exists public.exchange_connections_account_idx;

alter table public.exchange_connections
    drop column if exists account_id;

alter table public.exchange_connections
    add constraint exchange_connections_user_venue_env_fingerprint_key
        unique (user_id, venue, environment, key_fingerprint);

revoke all on table public.exchange_connections from anon, authenticated;

grant select (
    id,
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
