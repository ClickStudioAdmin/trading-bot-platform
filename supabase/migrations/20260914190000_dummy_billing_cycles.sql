-- Develop-only: give John demo rows (and any login with no period_end) a
-- period_end inside the rest of this calendar month so Billing / upgrade
-- prorate can be tested. Do not merge to main until the John demo is cleared.

do $$
declare
    cycle_start timestamptz := date_trunc('day', timezone('utc', now())) + interval '1 day';
    cycle_end timestamptz := date_trunc('month', timezone('utc', now())) + interval '1 month';
    span_seconds int;
begin
    if not exists (
        select 1
        from public.members
        where email like '%@tbp-john-demo.invalid'
        limit 1
    ) and not exists (
        select 1
        from public.members
        where period_end is null
        limit 1
    ) then
        return;
    end if;

    if cycle_start >= cycle_end then
        cycle_end := cycle_start + interval '14 days';
    end if;
    span_seconds := greatest(
        1,
        floor(extract(epoch from (cycle_end - cycle_start)))::int
    );

    update public.members m
    set
        period_end = cycle_start + make_interval(
            secs => (
                abs(
                    (
                        'x' || substr(md5('tbp-cycle:' || m.user_id::text), 1, 8)
                    )::bit(32)::bigint
                ) % span_seconds
            )
        ),
        updated_at = timezone('utc', now())
    where m.email like '%@tbp-john-demo.invalid'
       or m.period_end is null;
end $$;
