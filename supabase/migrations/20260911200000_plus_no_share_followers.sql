-- Plans that cannot share have no follower cap to show.

update public.membership_plans
set
    caps = caps || '{"max_followers_accepted": 0}'::jsonb,
    updated_at = now()
where coalesce((features->>'copy_share')::boolean, false) = false
  and coalesce((features->>'copy_catalogue')::boolean, false) = false;
