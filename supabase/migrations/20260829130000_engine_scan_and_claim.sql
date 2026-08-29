-- One public-market scan per loop (across Fly machines).
-- Desk claims use SKIP LOCKED + hot/exclude lists.
-- New desks get a lease row from a trigger instead of a full upsert every cycle.

create table public.engine_scan_leases (
    scan_key text primary key,
    worker_id text,
    leased_until timestamptz not null default timestamptz '1970-01-01',
    updated_at timestamptz not null default now()
);

insert into public.engine_scan_leases (scan_key)
values ('public_market')
on conflict (scan_key) do nothing;

alter table public.engine_scan_leases enable row level security;

grant select, insert, update on table public.engine_scan_leases to service_role;

create or replace function public.ensure_engine_desk_lease()
returns trigger
language plpgsql
as $$
begin
    insert into public.engine_desk_leases (account_id)
    values (new.id)
    on conflict (account_id) do nothing;
    return new;
end;
$$;

drop trigger if exists trading_accounts_engine_desk_lease on public.trading_accounts;
create trigger trading_accounts_engine_desk_lease
    after insert on public.trading_accounts
    for each row
    execute procedure public.ensure_engine_desk_lease();

insert into public.engine_desk_leases (account_id)
select id from public.trading_accounts
on conflict (account_id) do nothing;

create or replace function public.engine_uuid_array(raw jsonb)
returns uuid[]
language sql
immutable
as $$
    select coalesce(
        array_agg(value::uuid),
        '{}'::uuid[]
    )
    from jsonb_array_elements_text(
        case
            when jsonb_typeof(raw) = 'array' then raw
            else '[]'::jsonb
        end
    ) as t(value)
    where value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

create or replace function public.engine_claim_ranked_desks(p jsonb)
returns table (account_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_worker text := trim(coalesce(p->>'worker_id', ''));
    v_limit integer := greatest(1, least(coalesce((p->>'limit')::integer, 4), 50));
    v_ttl integer := greatest(5, coalesce((p->>'ttl_seconds')::integer, 45));
    v_prefer uuid[] := public.engine_uuid_array(p->'prefer_account_ids');
    v_exclude uuid[] := public.engine_uuid_array(p->'exclude_account_ids');
begin
    if coalesce(auth.role(), '') is distinct from 'service_role' then
        raise exception 'not allowed';
    end if;
    if char_length(v_worker) = 0 then
        raise exception 'worker id required';
    end if;

    return query
    with picked as (
        select leases.account_id
        from public.engine_desk_leases as leases
        where leases.leased_until < now()
          and (
              cardinality(v_exclude) = 0
              or leases.account_id <> all (v_exclude)
          )
        order by
            case when leases.account_id = any (v_prefer) then 0 else 1 end,
            leases.leased_until asc,
            leases.account_id asc
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

create or replace function public.engine_try_claim_scan(p jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_worker text := trim(coalesce(p->>'worker_id', ''));
    v_key text := nullif(trim(coalesce(p->>'scan_key', 'public_market')), '');
    v_ttl integer := greatest(5, coalesce((p->>'ttl_seconds')::integer, 18));
    claimed text;
begin
    if coalesce(auth.role(), '') is distinct from 'service_role' then
        raise exception 'not allowed';
    end if;
    if char_length(v_worker) = 0 or v_key is null then
        return false;
    end if;

    insert into public.engine_scan_leases (scan_key)
    values (v_key)
    on conflict (scan_key) do nothing;

    update public.engine_scan_leases
    set
        worker_id = v_worker,
        leased_until = now() + make_interval(secs => v_ttl),
        updated_at = now()
    where scan_key = v_key
      and leased_until < now()
    returning scan_key into claimed;

    return claimed is not null;
end;
$$;

grant execute on function public.engine_uuid_array(jsonb)
    to anon, authenticated, service_role;
grant execute on function public.engine_claim_ranked_desks(jsonb)
    to anon, authenticated, service_role;
grant execute on function public.engine_try_claim_scan(jsonb)
    to anon, authenticated, service_role;

notify pgrst, 'reload schema';
select pg_notification_queue_usage();
