alter table public.membership_affiliate_campaigns
    add column if not exists archived_at timestamptz;

alter table public.membership_affiliate_links
    add column if not exists archived_at timestamptz;

drop index if exists public.membership_affiliate_campaigns_user_name_idx;

create unique index if not exists membership_affiliate_campaigns_user_name_active_idx
    on public.membership_affiliate_campaigns (user_id, lower(trim(name)))
    where archived_at is null;

create index if not exists membership_affiliate_campaigns_user_active_idx
    on public.membership_affiliate_campaigns (user_id, created_at desc)
    where archived_at is null;

create index if not exists membership_affiliate_links_user_active_idx
    on public.membership_affiliate_links (user_id, created_at desc)
    where archived_at is null;
