-- Max Bots is a login-wide cap, not a per-desk cap.

update public.membership_plans
set
    caps = (caps - 'max_bots_per_desk') || jsonb_build_object(
        'max_bots',
        caps->'max_bots_per_desk'
    ),
    updated_at = now()
where caps ? 'max_bots_per_desk';
