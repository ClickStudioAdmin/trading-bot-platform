-- Develop-only: unique affiliate aliases for Johns. Restore trader aliases to John {path}.
-- Idempotent. Do not merge to main until the John demo is cleared.

do $$
declare
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
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'members'
          and column_name = 'affiliate_alias'
    ) then
        raise exception 'John affiliate aliases need members.affiliate_alias';
    end if;

    if not exists (
        select 1
        from public.members
        where email like '%@tbp-john-demo.invalid'
        limit 1
    ) then
        return;
    end if;

    drop table if exists john_demo_named;
    create temporary table john_demo_named (
        user_id uuid primary key,
        alias text not null,
        login_name text not null
    ) on commit drop;

    insert into john_demo_named (user_id, alias, login_name)
    select
        m.user_id,
        firsts[1 + ((n.ord - 1) % array_length(firsts, 1))]
        || ' '
        || lasts[1 + (((n.ord - 1) / array_length(firsts, 1)) % array_length(lasts, 1))],
        coalesce(
            'John ' || substring(m.email from '^john\.(.*)@tbp-john-demo\.invalid$'),
            m.name
        )
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
        from public.members other
        where other.affiliate_alias is not null
          and lower(other.affiliate_alias) = lower(n.alias)
          and other.user_id not in (select user_id from john_demo_named)
      );

    update public.members m
    set
        affiliate_alias = n.alias,
        name = n.login_name,
        updated_at = now()
    from john_demo_named n
    where m.user_id = n.user_id;

    update public.trader_profiles tp
    set
        alias = case
            when exists (
                select 1
                from public.trader_profiles other
                where lower(other.alias) = lower(n.login_name)
                  and other.user_id <> n.user_id
                  and other.user_id not in (select user_id from john_demo_named)
            ) then n.login_name || ' demo'
            else n.login_name
        end,
        updated_at = now()
    from john_demo_named n
    where tp.user_id = n.user_id;

    select count(*) into john_count from john_demo_named;
    if john_count <> 3905 then
        raise exception
            'John affiliate aliases expected 3905 Johns, found %',
            john_count;
    end if;
end
$$;
