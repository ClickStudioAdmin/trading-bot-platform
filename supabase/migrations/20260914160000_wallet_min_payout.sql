-- Main Wallet USDT withdraw minimum, separate from affiliate min payout.
alter table public.platform_settings
    add column if not exists wallet_min_payout_usd numeric(12, 2) not null default 100
        check (wallet_min_payout_usd >= 0);
