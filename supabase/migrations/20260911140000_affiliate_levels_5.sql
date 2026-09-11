-- Affiliate earn depth hard cap is 5 (was 3).

alter table public.membership_plans
    add column affiliate_l4_pct numeric(5, 2) not null default 0
        check (affiliate_l4_pct >= 0 and affiliate_l4_pct <= 100),
    add column affiliate_l5_pct numeric(5, 2) not null default 0
        check (affiliate_l5_pct >= 0 and affiliate_l5_pct <= 100);

do $$
declare
    cname text;
begin
    select con.conname
    into cname
    from pg_constraint con
    where con.conrelid = 'public.membership_plans'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%affiliate_l1_pct + affiliate_l2_pct + affiliate_l3_pct%';
    if cname is not null then
        execute format('alter table public.membership_plans drop constraint %I', cname);
    end if;
end $$;

alter table public.membership_plans
    add constraint membership_plans_affiliate_pct_sum_check
    check (
        affiliate_l1_pct
        + affiliate_l2_pct
        + affiliate_l3_pct
        + affiliate_l4_pct
        + affiliate_l5_pct
        <= 100
    );

do $$
declare
    cname text;
begin
    select con.conname
    into cname
    from pg_constraint con
    where con.conrelid = 'public.membership_commissions'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%level between 1 and 3%';
    if cname is not null then
        execute format('alter table public.membership_commissions drop constraint %I', cname);
    end if;
end $$;

alter table public.membership_commissions
    add constraint membership_commissions_level_check
    check (level between 1 and 5);

do $$
declare
    cname text;
begin
    select con.conname
    into cname
    from pg_constraint con
    where con.conrelid = 'public.platform_settings'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%affiliate_max_depth between 1 and 3%';
    if cname is not null then
        execute format('alter table public.platform_settings drop constraint %I', cname);
    end if;
end $$;

alter table public.platform_settings
    add constraint platform_settings_affiliate_max_depth_check
    check (affiliate_max_depth between 1 and 5);
