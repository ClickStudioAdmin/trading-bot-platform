-- Per-feature free trials on a plan, and the member clock for each one.
-- A later visit does not restart a clock. Service-role writes the clock.

alter table public.membership_plans
    add column if not exists trials jsonb not null default '{}'::jsonb;

create table public.member_feature_trials (
    user_id uuid not null references public.members (user_id) on delete cascade,
    trial_key text not null
        check (char_length(trial_key) between 1 and 64),
    started_at timestamptz not null,
    ends_at timestamptz not null,
    primary key (user_id, trial_key),
    check (ends_at > started_at)
);

create index member_feature_trials_user_idx
    on public.member_feature_trials (user_id);

alter table public.member_feature_trials enable row level security;

revoke all on table public.member_feature_trials from anon, authenticated;
