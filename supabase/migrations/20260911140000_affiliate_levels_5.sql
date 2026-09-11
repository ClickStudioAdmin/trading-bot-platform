-- Affiliate earn depth hard cap is 5 (was 3).
-- Postgres stores "between 1 and 3" as "((col >= 1) AND (col <= 3))",
-- so drop by known name rather than matching the source text.

alter table public.membership_plans
    add column if not exists affiliate_l4_pct numeric(5, 2) not null default 0
        constraint membership_plans_affiliate_l4_pct_check
        check (affiliate_l4_pct >= 0 and affiliate_l4_pct <= 100),
    add column if not exists affiliate_l5_pct numeric(5, 2) not null default 0
        constraint membership_plans_affiliate_l5_pct_check
        check (affiliate_l5_pct >= 0 and affiliate_l5_pct <= 100);

do $$
declare
    cname text;
begin
    for cname in
        select con.conname
        from pg_constraint con
        where con.conrelid = 'public.membership_plans'::regclass
          and con.contype = 'c'
          and pg_get_constraintdef(con.oid) ilike '%affiliate_l1_pct%'
          and pg_get_constraintdef(con.oid) ilike '%affiliate_l3_pct%'
          and pg_get_constraintdef(con.oid) not ilike '%affiliate_l5_pct%'
    loop
        execute format('alter table public.membership_plans drop constraint %I', cname);
    end loop;
end $$;

alter table public.membership_plans
    drop constraint if exists membership_plans_affiliate_pct_sum_check;

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

alter table public.membership_commissions
    drop constraint if exists membership_commissions_level_check;

alter table public.membership_commissions
    add constraint membership_commissions_level_check
    check (level between 1 and 5);

alter table public.platform_settings
    drop constraint if exists platform_settings_affiliate_max_depth_check;

alter table public.platform_settings
    add constraint platform_settings_affiliate_max_depth_check
    check (affiliate_max_depth between 1 and 5);
