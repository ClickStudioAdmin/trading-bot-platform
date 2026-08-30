-- PostgREST still cannot match claim_engine_desks(p_limit, p_ttl_seconds, p_worker_id)
-- after granting the three-argument form. One jsonb argument is a stable API match.

create or replace function public.engine_claim_desks(p jsonb)
returns table (account_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_worker text := trim(coalesce(p->>'worker_id', ''));
    v_limit integer := greatest(1, least(coalesce((p->>'limit')::integer, 4), 50));
    v_ttl integer := greatest(5, coalesce((p->>'ttl_seconds')::integer, 45));
begin
    if coalesce(auth.role(), '') is distinct from 'service_role' then
        raise exception 'not allowed';
    end if;
    if char_length(v_worker) = 0 then
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
        limit v_limit
        for update skip locked
    )
    update public.engine_desk_leases as leases
    set
        worker_id = v_worker,
        leased_until = now() + make_interval(secs => v_ttl),
        updated_at = now()
    from picked
    where leases.account_id = picked.account_id
    returning leases.account_id;
end;
$$;

create or replace function public.engine_try_claim_desk(p jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_account uuid := nullif(p->>'account_id', '')::uuid;
    v_worker text := trim(coalesce(p->>'worker_id', ''));
    ttl integer := greatest(5, coalesce((p->>'ttl_seconds')::integer, 20));
    current_worker text;
    current_until timestamptz;
begin
    if coalesce(auth.role(), '') is distinct from 'service_role' then
        raise exception 'not allowed';
    end if;
    if v_account is null or char_length(v_worker) = 0 then
        return 'busy';
    end if;

    insert into public.engine_desk_leases (account_id)
    values (v_account)
    on conflict (account_id) do nothing;

    select worker_id, leased_until
      into current_worker, current_until
    from public.engine_desk_leases
    where account_id = v_account
    for update;

    if current_until >= now()
        and current_worker is distinct from v_worker then
        return 'busy';
    end if;

    update public.engine_desk_leases
    set
        worker_id = v_worker,
        leased_until = now() + make_interval(secs => ttl),
        updated_at = now()
    where account_id = v_account;

    if current_until >= now()
        and current_worker is not distinct from v_worker then
        return 'held';
    end if;
    return 'acquired';
end;
$$;

create or replace function public.engine_release_desk(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_account uuid := nullif(p->>'account_id', '')::uuid;
    v_worker text := trim(coalesce(p->>'worker_id', ''));
begin
    if coalesce(auth.role(), '') is distinct from 'service_role' then
        raise exception 'not allowed';
    end if;
    if v_account is null then
        return;
    end if;
    update public.engine_desk_leases
    set
        worker_id = null,
        leased_until = timestamptz '1970-01-01',
        updated_at = now()
    where account_id = v_account
      and (
          char_length(v_worker) = 0
          or worker_id is not distinct from v_worker
      );
end;
$$;

create or replace function public.engine_take_venue_slot(p jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
    v_connection uuid := nullif(p->>'connection_id', '')::uuid;
    v_gap_ms integer := coalesce((p->>'gap_ms')::integer, 150);
    gap interval := make_interval(secs => greatest(0, v_gap_ms) / 1000.0);
    slot timestamptz;
begin
    if coalesce(auth.role(), '') is distinct from 'service_role' then
        raise exception 'not allowed';
    end if;
    if v_connection is null then
        return now();
    end if;

    insert into public.engine_venue_gates (connection_id, next_allowed_at)
    values (v_connection, now())
    on conflict (connection_id) do nothing;

    update public.engine_venue_gates
    set next_allowed_at = greatest(now(), next_allowed_at) + gap
    where connection_id = v_connection
    returning next_allowed_at - gap into slot;

    return coalesce(slot, now());
end;
$$;

grant execute on function public.engine_claim_desks(jsonb)
    to anon, authenticated, service_role;
grant execute on function public.engine_try_claim_desk(jsonb)
    to anon, authenticated, service_role;
grant execute on function public.engine_release_desk(jsonb)
    to anon, authenticated, service_role;
grant execute on function public.engine_take_venue_slot(jsonb)
    to anon, authenticated, service_role;

notify pgrst, 'reload schema';
select pg_notification_queue_usage();
