-- Import / Export Templates: Plus and Pro.

update public.membership_plans
set
    features = features || '{"extras_import_export_templates": true}'::jsonb,
    updated_at = now()
where id in (
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003'
);
