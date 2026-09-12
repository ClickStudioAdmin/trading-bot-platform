-- Stripe subscription id on the login. Customer id already exists.

alter table public.members
    add column stripe_subscription_id text;

create unique index members_stripe_customer_uidx
    on public.members (stripe_customer_id)
    where stripe_customer_id is not null;
