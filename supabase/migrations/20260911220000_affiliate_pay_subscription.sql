-- Plan feature: pay rent from payable affiliate earnings.
-- Member opt-in lives on the profile. Billing applies it in later steps.
-- That debit is still a paid subscription invoice; upline L1–L5 still earn.

alter table public.members
    add column pay_subscription_from_affiliate boolean not null default false;

update public.membership_plans
set
    features = features || '{"affiliate_pay_subscription": true}'::jsonb,
    updated_at = now()
where
    coalesce(features ->> 'affiliate_enroll', 'false') = 'true'
    or lower(name) like '%subscription%';
