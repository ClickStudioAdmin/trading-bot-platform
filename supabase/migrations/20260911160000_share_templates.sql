-- Share Templates is on for every existing plan.

update public.membership_plans
set
    features = features || '{"extras_share_templates": true}'::jsonb,
    updated_at = now();
