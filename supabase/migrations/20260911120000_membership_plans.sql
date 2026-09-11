-- Membership plans, billing ledgers, and affiliate tables (roadmap 5, steps 2–3).
-- No Stripe SDK in this pass. Existing members land on seed Free.

create table public.membership_plans (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique
        check (char_length(slug) between 1 and 40),
    name text not null
        check (char_length(trim(name)) between 1 and 40),
    sort_order integer not null default 0
        check (sort_order >= 0 and sort_order <= 9999),
    public boolean not null default true,
    archived_at timestamptz,
    is_default boolean not null default false,
    price_usd numeric(12, 2) not null default 0
        check (price_usd >= 0),
    stripe_price_id text,
    affiliate_l1_pct numeric(5, 2) not null default 0
        check (affiliate_l1_pct >= 0 and affiliate_l1_pct <= 100),
    affiliate_l2_pct numeric(5, 2) not null default 0
        check (affiliate_l2_pct >= 0 and affiliate_l2_pct <= 100),
    affiliate_l3_pct numeric(5, 2) not null default 0
        check (affiliate_l3_pct >= 0 and affiliate_l3_pct <= 100),
    features jsonb not null default '{}'::jsonb,
    caps jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (
        affiliate_l1_pct + affiliate_l2_pct + affiliate_l3_pct <= 100
    )
);

create unique index membership_plans_default_uidx
    on public.membership_plans (is_default)
    where is_default;

create index membership_plans_sort_idx
    on public.membership_plans (sort_order, name);

insert into public.membership_plans (
    id,
    slug,
    name,
    sort_order,
    public,
    is_default,
    price_usd,
    affiliate_l1_pct,
    affiliate_l2_pct,
    affiliate_l3_pct,
    features,
    caps
)
values
    (
        '00000000-0000-4000-8000-000000000001',
        'free',
        'Free',
        0,
        true,
        true,
        0,
        0,
        0,
        0,
        '{
            "desk_cash_and_carry": true,
            "desk_perps": true,
            "desk_perps_bots": true,
            "desk_signal_follower": true,
            "desk_dca": true,
            "desk_scale_in": false,
            "mode_paper": true,
            "mode_live": false,
            "venue_non_bybit": false,
            "copy_follow": false,
            "copy_share": false,
            "copy_catalogue": false,
            "research_chart": true,
            "research_backtest": false,
            "signals_inbound_webhooks": false,
            "extras_advanced_dca": true,
            "extras_templates": false,
            "extras_starter_pack": true,
            "affiliate_enroll": false
        }'::jsonb,
        '{
            "max_desks": 2,
            "max_live_desks": 0,
            "max_paper_desks": 2,
            "max_exchange_connections": 1,
            "max_bots_per_desk": 3,
            "max_inbound_webhooks": 0,
            "max_copy_follows": 0,
            "max_followers_accepted": 0,
            "max_stored_backtests": 0,
            "max_backtest_bars": null,
            "affiliate_max_depth": null
        }'::jsonb
    ),
    (
        '00000000-0000-4000-8000-000000000002',
        'plus',
        'Plus',
        1,
        true,
        false,
        29,
        10,
        0,
        0,
        '{
            "desk_cash_and_carry": true,
            "desk_perps": true,
            "desk_perps_bots": true,
            "desk_signal_follower": true,
            "desk_dca": true,
            "desk_scale_in": false,
            "mode_paper": true,
            "mode_live": true,
            "venue_non_bybit": true,
            "copy_follow": false,
            "copy_share": false,
            "copy_catalogue": false,
            "research_chart": true,
            "research_backtest": false,
            "signals_inbound_webhooks": true,
            "extras_advanced_dca": true,
            "extras_templates": true,
            "extras_starter_pack": true,
            "affiliate_enroll": false
        }'::jsonb,
        '{
            "max_desks": 4,
            "max_live_desks": 2,
            "max_paper_desks": 4,
            "max_exchange_connections": 3,
            "max_bots_per_desk": 8,
            "max_inbound_webhooks": 8,
            "max_copy_follows": 0,
            "max_followers_accepted": 0,
            "max_stored_backtests": 3,
            "max_backtest_bars": null,
            "affiliate_max_depth": null
        }'::jsonb
    ),
    (
        '00000000-0000-4000-8000-000000000003',
        'pro',
        'Pro',
        2,
        true,
        false,
        79,
        20,
        5,
        0,
        '{
            "desk_cash_and_carry": true,
            "desk_perps": true,
            "desk_perps_bots": true,
            "desk_signal_follower": true,
            "desk_dca": true,
            "desk_scale_in": false,
            "mode_paper": true,
            "mode_live": true,
            "venue_non_bybit": true,
            "copy_follow": true,
            "copy_share": true,
            "copy_catalogue": true,
            "research_chart": true,
            "research_backtest": true,
            "signals_inbound_webhooks": true,
            "extras_advanced_dca": true,
            "extras_templates": true,
            "extras_starter_pack": true,
            "affiliate_enroll": true
        }'::jsonb,
        '{
            "max_desks": 10,
            "max_live_desks": 5,
            "max_paper_desks": 10,
            "max_exchange_connections": 8,
            "max_bots_per_desk": 20,
            "max_inbound_webhooks": 20,
            "max_copy_follows": 5,
            "max_followers_accepted": 50,
            "max_stored_backtests": 20,
            "max_backtest_bars": null,
            "affiliate_max_depth": 2
        }'::jsonb
    );

alter table public.members
    add column plan_id uuid references public.membership_plans (id) on delete restrict,
    add column last_enroll_plan_id uuid references public.membership_plans (id) on delete restrict,
    add column billing_method text
        check (billing_method is null or billing_method in ('stripe', 'wallet')),
    add column stripe_customer_id text,
    add column subscription_status text not null default 'none'
        check (subscription_status in ('none', 'active', 'past_due', 'canceled', 'comp')),
    add column period_end timestamptz,
    add column grace_until timestamptz;

update public.members
set plan_id = '00000000-0000-4000-8000-000000000001'
where plan_id is null;

alter table public.members
    alter column plan_id set not null;

create index members_plan_id_idx on public.members (plan_id);

create function public.membership_assign_default_plan()
returns trigger
language plpgsql
as $$
begin
    if new.plan_id is null then
        select id into new.plan_id
        from public.membership_plans
        where is_default
        limit 1;
    end if;
    return new;
end;
$$;

create trigger members_assign_default_plan
    before insert on public.members
    for each row
    execute procedure public.membership_assign_default_plan();

create function public.membership_plan_in_use(p_id uuid)
returns boolean
language sql
stable
as $$
    select
        exists (
            select 1 from public.membership_plans
            where id = p_id and is_default
        )
        or exists (select 1 from public.members where plan_id = p_id)
        or exists (select 1 from public.members where last_enroll_plan_id = p_id);
$$;

create function public.membership_prevent_plan_delete()
returns trigger
language plpgsql
as $$
begin
    if public.membership_plan_in_use(old.id) then
        raise exception 'Plan cannot be deleted once a member is signed up for it. Archive it instead.';
    end if;
    return old;
end;
$$;

create trigger membership_plans_prevent_delete
    before delete on public.membership_plans
    for each row
    execute procedure public.membership_prevent_plan_delete();

create table public.membership_invoices (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.members (user_id) on delete restrict,
    plan_id uuid not null references public.membership_plans (id) on delete restrict,
    method text not null check (method in ('stripe', 'wallet', 'comp')),
    external_id text,
    amount_usd numeric(12, 2) not null check (amount_usd >= 0),
    status text not null check (status in ('paid', 'refunded', 'void')),
    period_start timestamptz,
    period_end timestamptz,
    created_at timestamptz not null default now()
);

create unique index membership_invoices_external_uidx
    on public.membership_invoices (method, external_id)
    where external_id is not null;

create index membership_invoices_user_idx
    on public.membership_invoices (user_id, created_at desc);

create table public.membership_wallet_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.members (user_id) on delete restrict,
    kind text not null
        check (kind in ('deposit', 'debit_rent', 'commission', 'withdraw', 'adjust')),
    amount_usd numeric(12, 2) not null check (amount_usd <> 0),
    external_id text,
    memo text,
    created_at timestamptz not null default now()
);

create index membership_wallet_user_idx
    on public.membership_wallet_entries (user_id, created_at);

create table public.membership_referral_codes (
    user_id uuid primary key references public.members (user_id) on delete cascade,
    code text not null unique
        check (char_length(trim(code)) between 4 and 32),
    created_at timestamptz not null default now()
);

create unique index membership_referral_codes_lower_idx
    on public.membership_referral_codes (lower(code));

create table public.membership_referrals (
    user_id uuid primary key references public.members (user_id) on delete restrict,
    referrer_user_id uuid not null references public.members (user_id) on delete restrict,
    code text not null,
    attributed_at timestamptz not null default now(),
    first_paid_at timestamptz,
    check (user_id <> referrer_user_id)
);

create index membership_referrals_referrer_idx
    on public.membership_referrals (referrer_user_id);

create table public.membership_commissions (
    id uuid primary key default gen_random_uuid(),
    earner_user_id uuid not null references public.members (user_id) on delete restrict,
    source_user_id uuid not null references public.members (user_id) on delete restrict,
    invoice_id uuid not null references public.membership_invoices (id) on delete restrict,
    rate_plan_id uuid not null references public.membership_plans (id) on delete restrict,
    level integer not null check (level between 1 and 3),
    rate_pct numeric(5, 2) not null check (rate_pct >= 0 and rate_pct <= 100),
    amount_usd numeric(12, 2) not null check (amount_usd >= 0),
    status text not null
        check (status in ('pending', 'payable', 'paid', 'void')),
    hold_until timestamptz not null,
    created_at timestamptz not null default now(),
    unique (invoice_id, earner_user_id, level)
);

create index membership_commissions_earner_idx
    on public.membership_commissions (earner_user_id, status, hold_until);

create table public.membership_payouts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.members (user_id) on delete restrict,
    method text not null
        check (method in ('export', 'stripe_connect', 'usdt')),
    amount_usd numeric(12, 2) not null check (amount_usd > 0),
    status text not null
        check (status in ('requested', 'approved', 'rejected', 'paid')),
    network text,
    address text,
    external_id text,
    created_at timestamptz not null default now(),
    paid_at timestamptz
);

create index membership_payouts_user_idx
    on public.membership_payouts (user_id, created_at desc);

create table public.membership_payout_items (
    payout_id uuid not null references public.membership_payouts (id) on delete restrict,
    commission_id uuid not null references public.membership_commissions (id) on delete restrict,
    primary key (payout_id, commission_id)
);

alter table public.platform_settings
    add column affiliate_max_depth integer not null default 2
        check (affiliate_max_depth between 1 and 3),
    add column affiliate_hold_days integer not null default 30
        check (affiliate_hold_days >= 0),
    add column affiliate_min_payout_usd numeric(12, 2) not null default 50
        check (affiliate_min_payout_usd >= 0),
    add column affiliate_payout_coin text not null default 'USDT',
    add column affiliate_usdt_networks text[] not null
        default array['ethereum', 'arbitrum', 'base', 'polygon']::text[],
    add column downgrade_grace_days integer not null default 7
        check (downgrade_grace_days >= 0);

alter table public.membership_plans enable row level security;
alter table public.membership_invoices enable row level security;
alter table public.membership_wallet_entries enable row level security;
alter table public.membership_referral_codes enable row level security;
alter table public.membership_referrals enable row level security;
alter table public.membership_commissions enable row level security;
alter table public.membership_payouts enable row level security;
alter table public.membership_payout_items enable row level security;

create policy membership_plans_select
    on public.membership_plans
    for select
    to authenticated
    using (true);

revoke all on table public.membership_plans from anon, authenticated;
revoke all on table public.membership_invoices from anon, authenticated;
revoke all on table public.membership_wallet_entries from anon, authenticated;
revoke all on table public.membership_referral_codes from anon, authenticated;
revoke all on table public.membership_referrals from anon, authenticated;
revoke all on table public.membership_commissions from anon, authenticated;
revoke all on table public.membership_payouts from anon, authenticated;
revoke all on table public.membership_payout_items from anon, authenticated;

grant select on table public.membership_plans to authenticated;

create or replace function public.membership_plan_in_use(p_id uuid)
returns boolean
language sql
stable
as $$
    select
        exists (
            select 1 from public.membership_plans
            where id = p_id and is_default
        )
        or exists (select 1 from public.members where plan_id = p_id)
        or exists (select 1 from public.members where last_enroll_plan_id = p_id)
        or exists (select 1 from public.membership_invoices where plan_id = p_id)
        or exists (
            select 1 from public.membership_commissions where rate_plan_id = p_id
        );
$$;
