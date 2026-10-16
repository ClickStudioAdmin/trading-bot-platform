-- Claim budget and venue retry. A queued row waits until retry_after.
-- claim_count is raised in the app each time work starts.

alter table public.backtest_runs
    add column if not exists claim_count integer not null default 0,
    add column if not exists retry_after timestamptz;

alter table public.backtest_runs
    drop constraint if exists backtest_runs_claim_count_check;

alter table public.backtest_runs
    add constraint backtest_runs_claim_count_check
        check (claim_count >= 0);

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
        claimed_at = now(),
        retry_after = null
    where r.id = (
        select q.id
        from public.backtest_runs as q
        where (
            (
                q.status = 'queued'
                and (q.retry_after is null or q.retry_after <= now())
            )
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
