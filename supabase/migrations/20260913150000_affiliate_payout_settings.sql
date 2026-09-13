-- Saved USDT payout address / chain and optional auto-payout threshold.
create table public.membership_affiliate_payout_settings (
    user_id uuid primary key references public.members (user_id) on delete cascade,
    network text not null,
    address text not null,
    auto_payout boolean not null default false,
    auto_payout_usd numeric(12, 2)
        check (auto_payout_usd is null or auto_payout_usd >= 0.01),
    updated_at timestamptz not null default now()
);

alter table public.membership_affiliate_payout_settings enable row level security;

revoke all on table public.membership_affiliate_payout_settings
    from anon, authenticated;
