-- Primary pair plus comparable contracts. Long runs are claimed by the engine worker.

alter table public.backtest_runs
    add column parent_run_id uuid references public.backtest_runs (id) on delete cascade,
    add column comparable_symbols jsonb not null default '[]'::jsonb
        check (jsonb_typeof(comparable_symbols) = 'array'),
    add column claimed_at timestamptz;

create index backtest_runs_parent_idx
    on public.backtest_runs (parent_run_id);

create index backtest_runs_queue_idx
    on public.backtest_runs (status, created_at)
    where status in ('queued', 'running');

create or replace function public.backtest_claim_queued_run(p jsonb)
returns setof public.backtest_runs
language plpgsql
security definer
set search_path = public
as $$
declare
    v_stale integer := greatest(5, coalesce((p->>'stale_minutes')::integer, 15));
    v_max_bars integer := coalesce((p->>'max_bars')::integer, 0);
begin
    if coalesce(auth.role(), '') is distinct from 'service_role' then
        raise exception 'not allowed';
    end if;

    return query
    update public.backtest_runs as r
    set
        status = 'running',
        claimed_at = now()
    where r.id = (
        select q.id
        from public.backtest_runs as q
        where (
            q.status = 'queued'
            or (
                q.status = 'running'
                and q.claimed_at is not null
                and q.claimed_at < now() - make_interval(mins => v_stale)
            )
        )
        and (
            v_max_bars <= 0
            or ceil((q.to_ms - q.from_ms)::numeric / greatest(1, public.backtest_interval_ms(q.interval)))
                <= v_max_bars
        )
        order by q.created_at
        limit 1
        for update skip locked
    )
    returning *;
end;
$$;

create or replace function public.backtest_interval_ms(interval_text text)
returns bigint
language sql
immutable
as $$
    select case interval_text
        when '5' then 5 * 60 * 1000
        when '15' then 15 * 60 * 1000
        when '30' then 30 * 60 * 1000
        when '60' then 60 * 60 * 1000
        when '120' then 120 * 60 * 1000
        when '240' then 240 * 60 * 1000
        when '360' then 360 * 60 * 1000
        when '720' then 720 * 60 * 1000
        else 24 * 60 * 60 * 1000
    end;
$$;

revoke all on function public.backtest_claim_queued_run(jsonb) from public, anon, authenticated;
grant execute on function public.backtest_claim_queued_run(jsonb) to service_role;
