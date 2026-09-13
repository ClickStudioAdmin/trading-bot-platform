-- Polish the develop-only John tree: real-looking aliases and paid Pro / Premium.
-- Idempotent. Do not merge to main until the John demo is cleared.

do $$
declare
    pro_id uuid;
    premium_id uuid;
    paid_plan uuid;
    firsts text[] := array[
        'Ava', 'Noah', 'Mia', 'Liam', 'Zoe', 'Ethan', 'Luna', 'Owen', 'Ella', 'Mason',
        'Ivy', 'Jack', 'Ruby', 'Leo', 'Nora', 'Finn', 'Chloe', 'Kai', 'Hazel', 'Cole',
        'Stella', 'Miles', 'Lily', 'Ryan', 'Grace', 'Adam', 'Quinn', 'Luke', 'Paige', 'Nate',
        'Sofia', 'Dean', 'Clara', 'Seth', 'Hugo', 'Isla', 'Jude', 'Maya', 'Reid', 'Elena',
        'Troy', 'Violet', 'Cade', 'June', 'Blake', 'Sienna', 'Rhys', 'Daisy', 'Colin', 'Pia',
        'Grant', 'Tessa', 'Shane', 'Willa', 'Brent', 'Esme', 'Clark', 'Skye', 'Holt', 'Maren',
        'Beau', 'Talia', 'Drew', 'Nia', 'Vince', 'Lila', 'Cory', 'Gwen', 'Felix', 'Thea',
        'Reed', 'Jonah', 'Pax', 'Indie', 'Mara', 'Colt', 'Nyah', 'Wade', 'Remy', 'Otis'
    ];
    lasts text[] := array[
        'Walker', 'Chen', 'Patel', 'Brooks', 'Alvarez', 'Kim', 'Singh', 'Walsh', 'Nguyen', 'Price',
        'Ortiz', 'Shah', 'Bennett', 'Cruz', 'Ford', 'Hayes', 'Khan', 'Lopez', 'Moore', 'Reed',
        'Scott', 'Turner', 'Young', 'Adams', 'Baker', 'Davis', 'Evans', 'Green', 'Hall', 'James',
        'Lewis', 'Martin', 'Nelson', 'Perez', 'Quinn', 'Rivera', 'Stone', 'Taylor', 'Vargas', 'White',
        'Xu', 'Flores', 'Garcia', 'Hernandez', 'Jackson', 'Murphy', 'Cooper', 'Bailey', 'Kelly', 'Morgan'
    ];
    john_count int;
begin
    if not exists (
        select 1
        from public.members
        where email like '%@tbp-john-demo.invalid'
        limit 1
    ) then
        return;
    end if;

    select id into pro_id from public.membership_plans where slug = 'pro';
    select id
    into premium_id
    from public.membership_plans
    where slug = 'premium' or lower(name) = 'premium'
    order by case when slug = 'premium' then 0 else 1 end
    limit 1;
    paid_plan := coalesce(premium_id, pro_id);
    if pro_id is null and paid_plan is null then
        raise exception 'John demo polish needs a Pro or Premium plan';
    end if;
    pro_id := coalesce(pro_id, paid_plan);
    premium_id := coalesce(premium_id, pro_id);

    update public.members m
    set
        platform_member = true,
        plan_id = case
            when abs(hashtext(m.email)) % 2 = 0 then premium_id
            else pro_id
        end,
        last_enroll_plan_id = case
            when abs(hashtext(m.email)) % 2 = 0 then premium_id
            else pro_id
        end,
        subscription_status = 'active'
    where m.email like '%@tbp-john-demo.invalid';

    update public.membership_referrals r
    set first_paid_at = coalesce(r.first_paid_at, r.attributed_at)
    where r.user_id in (
        select user_id
        from public.members
        where email like '%@tbp-john-demo.invalid'
    );

    drop table if exists john_demo_named;
    create temporary table john_demo_named (
        user_id uuid primary key,
        alias text not null
    ) on commit drop;

    insert into john_demo_named (user_id, alias)
    select
        m.user_id,
        firsts[1 + ((n.ord - 1) % array_length(firsts, 1))]
        || ' '
        || lasts[1 + (((n.ord - 1) / array_length(firsts, 1)) % array_length(lasts, 1))]
    from (
        select
            user_id,
            row_number() over (order by email) as ord
        from public.members
        where email like '%@tbp-john-demo.invalid'
    ) n
    join public.members m on m.user_id = n.user_id;

    update john_demo_named n
    set alias = n.alias || ' ' || numbered.ord::text
    from (
        select
            user_id,
            row_number() over (order by email) as ord
        from public.members
        where email like '%@tbp-john-demo.invalid'
    ) numbered
    where n.user_id = numbered.user_id
      and exists (
        select 1
        from public.trader_profiles other
        where lower(other.alias) = lower(n.alias)
          and other.user_id not in (select user_id from john_demo_named)
      );

    update public.members m
    set name = n.alias
    from john_demo_named n
    where m.user_id = n.user_id;

    update public.trader_profiles tp
    set
        alias = n.alias,
        updated_at = now()
    from john_demo_named n
    where tp.user_id = n.user_id;

    insert into public.trader_profiles (user_id, alias, bio)
    select
        n.user_id,
        n.alias,
        'John affiliate demo. Safe to delete.'
    from john_demo_named n
    where not exists (
        select 1 from public.trader_profiles tp where tp.user_id = n.user_id
    );

    select count(*) into john_count from john_demo_named;
    if john_count <> 3905 then
        raise exception
            'John demo polish expected 3905 Johns, found %',
            john_count;
    end if;
end
$$;
