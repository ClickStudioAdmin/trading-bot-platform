create table public.membership_affiliate_campaigns (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.members (user_id) on delete cascade,
    name text not null
        check (char_length(trim(name)) between 1 and 40),
    created_at timestamptz not null default now()
);

create unique index membership_affiliate_campaigns_user_name_idx
    on public.membership_affiliate_campaigns (user_id, lower(trim(name)));

create index membership_affiliate_campaigns_user_idx
    on public.membership_affiliate_campaigns (user_id, created_at desc);

create table public.membership_affiliate_links (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.members (user_id) on delete cascade,
    campaign_id uuid references public.membership_affiliate_campaigns (id) on delete set null,
    slug text not null
        check (char_length(slug) between 6 and 16),
    name text not null
        check (char_length(trim(name)) between 1 and 40),
    landing text not null
        check (landing in ('home', 'affiliates')),
    created_at timestamptz not null default now()
);

create unique index membership_affiliate_links_slug_lower_idx
    on public.membership_affiliate_links (lower(slug));

create index membership_affiliate_links_user_idx
    on public.membership_affiliate_links (user_id, created_at desc);

alter table public.membership_referrals
    add column if not exists campaign_id uuid
        references public.membership_affiliate_campaigns (id) on delete set null,
    add column if not exists link_id uuid
        references public.membership_affiliate_links (id) on delete set null;

create index if not exists membership_referrals_campaign_idx
    on public.membership_referrals (campaign_id);

create index if not exists membership_referrals_link_idx
    on public.membership_referrals (link_id);

alter table public.membership_commissions
    add column if not exists campaign_id uuid
        references public.membership_affiliate_campaigns (id) on delete set null,
    add column if not exists link_id uuid
        references public.membership_affiliate_links (id) on delete set null;

create index if not exists membership_commissions_campaign_idx
    on public.membership_commissions (earner_user_id, campaign_id);

alter table public.membership_affiliate_campaigns enable row level security;
alter table public.membership_affiliate_links enable row level security;

revoke all on table public.membership_affiliate_campaigns from anon, authenticated;
revoke all on table public.membership_affiliate_links from anon, authenticated;
