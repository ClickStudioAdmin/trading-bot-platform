-- Affiliate USDT withdraws use listed billing chains, not a separate network list.
alter table public.membership_billing_chains
    add column if not exists affiliate_payouts boolean not null default false;

update public.membership_billing_chains
set affiliate_payouts = true
where environment = 'development';
