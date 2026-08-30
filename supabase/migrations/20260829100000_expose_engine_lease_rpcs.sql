-- PostgREST builds its schema cache as the authenticator/anon role.
-- Functions granted only to service_role never appear, so Fly gets
-- "Could not find the function public.claim_engine_desks(...) in the schema cache".
-- Grant execute to the API roles, then reject non-service callers inside the function.

create or replace function public.claim_engine_desks(
    p_worker_id text,
    p_limit integer,
    p_ttl_seconds integer
)
returns table (account_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
    if coalesce(auth.role(), '') is distinct from 'service_role' then
        raise exception 'not allowed';
    end if;
    if p_worker_id is null or char_length(trim(p_worker_id)) = 0 then
        raise exception 'worker id required';
    end if;

    insert into public.engine_desk_leases (account_id)
    select id from public.trading_accounts
    on conflict (account_id) do nothing;

    return query
    with picked as (
        select leases.account_id
        from public.engine_desk_leases as leases
        where leases.leased_until < now()
        order by leases.leased_until asc, leases.account_id asc
        limit greatest(1, least(coalesce(p_limit, 4), 50))
        for update skip locked
    )
    update public.engine_desk_leases as leases
    set
        worker_id = trim(p_worker_id),
        leased_until = now()
            + make_interval(secs => greatest(5, coalesce(p_ttl_seconds, 45))),
        updated_at = now()
    from picked
    where leases.account_id = picked.account_id
    returning leases.account_id;
end;
$$;

create or replace function public.try_claim_engine_desk(
    p_account_id uuid,
    p_worker_id text,
    p_ttl_seconds integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    ttl integer := greatest(5, coalesce(p_ttl_seconds, 20));
    current_worker text;
    current_until timestamptz;
begin
    if coalesce(auth.role(), '') is distinct from 'service_role' then
        raise exception 'not allowed';
    end if;
    if p_account_id is null
        or p_worker_id is null
        or char_length(trim(p_worker_id)) = 0 then
        return 'busy';
    end if;

    insert into public.engine_desk_leases (account_id)
    values (p_account_id)
    on conflict (account_id) do nothing;

    select worker_id, leased_until
      into current_worker, current_until
    from public.engine_desk_leases
    where account_id = p_account_id
    for update;

    if current_until >= now()
        and current_worker is distinct from trim(p_worker_id) then
        return 'busy';
    end if;

    update public.engine_desk_leases
    set
        worker_id = trim(p_worker_id),
        leased_until = now() + make_interval(secs => ttl),
        updated_at = now()
    where account_id = p_account_id;

    if current_until >= now()
        and current_worker is not distinct from trim(p_worker_id) then
        return 'held';
    end if;
    return 'acquired';
end;
$$;

create or replace function public.release_engine_desk(
    p_account_id uuid,
    p_worker_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if coalesce(auth.role(), '') is distinct from 'service_role' then
        raise exception 'not allowed';
    end if;
    update public.engine_desk_leases
    set
        worker_id = null,
        leased_until = timestamptz '1970-01-01',
        updated_at = now()
    where account_id = p_account_id
      and (
          p_worker_id is null
          or worker_id is not distinct from trim(p_worker_id)
      );
end;
$$;

create or replace function public.take_engine_venue_slot(
    p_connection_id uuid,
    p_gap_ms integer
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
    gap interval := make_interval(secs => greatest(0, coalesce(p_gap_ms, 150)) / 1000.0);
    slot timestamptz;
begin
    if coalesce(auth.role(), '') is distinct from 'service_role' then
        raise exception 'not allowed';
    end if;
    if p_connection_id is null then
        return now();
    end if;

    insert into public.engine_venue_gates (connection_id, next_allowed_at)
    values (p_connection_id, now())
    on conflict (connection_id) do nothing;

    update public.engine_venue_gates
    set next_allowed_at = greatest(now(), next_allowed_at) + gap
    where connection_id = p_connection_id
    returning next_allowed_at - gap into slot;

    return coalesce(slot, now());
end;
$$;

grant execute on function public.claim_engine_desks(text, integer, integer)
    to anon, authenticated, service_role;
grant execute on function public.try_claim_engine_desk(uuid, text, integer)
    to anon, authenticated, service_role;
grant execute on function public.release_engine_desk(uuid, text)
    to anon, authenticated, service_role;
grant execute on function public.take_engine_venue_slot(uuid, integer)
    to anon, authenticated, service_role;

notify pgrst, 'reload schema';
select pg_notification_queue_usage();
