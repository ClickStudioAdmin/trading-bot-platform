-- Attach results to Bot templates: Plus and Pro.

update public.membership_plans
set
    features = features || '{"research_backtest_attach_templates": true}'::jsonb,
    updated_at = now()
where id in (
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003'
);
