-- Affiliate-only logins (no platform membership) and program default L1–L5 rates.
alter table public.members
    add column if not exists platform_member boolean not null default true;

alter table public.platform_settings
    add column if not exists affiliate_default_l1_pct numeric(5, 2) not null default 0,
    add column if not exists affiliate_default_l2_pct numeric(5, 2) not null default 0,
    add column if not exists affiliate_default_l3_pct numeric(5, 2) not null default 0,
    add column if not exists affiliate_default_l4_pct numeric(5, 2) not null default 0,
    add column if not exists affiliate_default_l5_pct numeric(5, 2) not null default 0;

alter table public.platform_settings
    drop constraint if exists platform_settings_affiliate_default_rates_bounds;

alter table public.platform_settings
    add constraint platform_settings_affiliate_default_rates_bounds check (
        affiliate_default_l1_pct >= 0
        and affiliate_default_l1_pct <= 100
        and affiliate_default_l2_pct >= 0
        and affiliate_default_l2_pct <= 100
        and affiliate_default_l3_pct >= 0
        and affiliate_default_l3_pct <= 100
        and affiliate_default_l4_pct >= 0
        and affiliate_default_l4_pct <= 100
        and affiliate_default_l5_pct >= 0
        and affiliate_default_l5_pct <= 100
        and affiliate_default_l1_pct
            + affiliate_default_l2_pct
            + affiliate_default_l3_pct
            + affiliate_default_l4_pct
            + affiliate_default_l5_pct
            <= 100
    );

-- Program-default commissions stamp rates only; no plan row.
alter table public.membership_commissions
    alter column rate_plan_id drop not null;
