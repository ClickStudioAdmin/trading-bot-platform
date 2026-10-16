-- Owner close hides the source desk. Copy desks keep pointing at it until
-- the six-month retention job deletes them, then the parent row.

alter table public.trading_accounts
    add column closed_at timestamptz;

create index trading_accounts_closed_at_idx
    on public.trading_accounts (closed_at)
    where closed_at is not null;

comment on column public.trading_accounts.closed_at is
    'Set when the owner closes a source desk. Hidden from that login. Copy desks stay until retention.';

-- Closed desks, and copy desks of a closed source, are not claimed.
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
          and not exists (
              select 1
              from public.trading_accounts as desks
              left join public.trading_accounts as parent
                  on parent.id = desks.copy_of_account_id
              where desks.id = leases.account_id
                and (
                    desks.closed_at is not null
                    or parent.closed_at is not null
                )
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

notify pgrst, 'reload schema';
select pg_notification_queue_usage();
