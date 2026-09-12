-- Optional: when collection method is Crypto, debit USD credit first.
-- Billing applies it when the credit tick ships (step 5).
-- Existing Crypto credit members keep the deduct-on behaviour.

alter table public.members
    add column pay_subscription_from_credit boolean not null default false;

update public.members
set pay_subscription_from_credit = true
where billing_method = 'wallet';
