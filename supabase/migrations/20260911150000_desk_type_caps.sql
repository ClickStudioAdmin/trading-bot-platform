-- Desk types are numeric caps, not on/off ticks.
-- Enabled seed flags become unlimited; disabled flags become 0.

update public.membership_plans
set
    caps = caps || jsonb_build_object(
        'max_desk_cash_and_carry',
        case when features->>'desk_cash_and_carry' = 'true' then null else 0 end,
        'max_desk_perps',
        case when features->>'desk_perps' = 'true' then null else 0 end,
        'max_desk_perps_bots',
        case when features->>'desk_perps_bots' = 'true' then null else 0 end,
        'max_desk_signal_follower',
        case when features->>'desk_signal_follower' = 'true' then null else 0 end,
        'max_desk_dca',
        case when features->>'desk_dca' = 'true' then null else 0 end,
        'max_desk_scale_in',
        case when features->>'desk_scale_in' = 'true' then null else 0 end
    ),
    updated_at = now();
