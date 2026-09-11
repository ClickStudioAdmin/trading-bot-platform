-- Plus includes every copy-trading feature (follow, share, catalogue).
-- Caps match the Pro seed so Plus can actually follow and accept followers.

update public.membership_plans
set
    features = features || '{
        "copy_follow": true,
        "copy_share": true,
        "copy_catalogue": true
    }'::jsonb,
    caps = caps || '{
        "max_copy_follows": 5,
        "max_followers_accepted": 50
    }'::jsonb,
    updated_at = now()
where id = '00000000-0000-4000-8000-000000000002';
