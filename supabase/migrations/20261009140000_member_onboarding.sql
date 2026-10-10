-- First-run setup and the optional platform tour.
-- The app session check sits in TypeScript; TBP has no Supabase Auth JWT.
-- Draft JSON never stores API secrets.

create table public.member_onboarding (
    user_id uuid primary key references public.members (user_id) on delete cascade,
    status text not null default 'pending',
    draft jsonb,
    created_account_ids uuid[] not null default '{}',
    applied_template_keys text[] not null default '{}',
    tour text,
    tour_step integer not null default 0,
    updated_at timestamptz not null default now(),
    constraint member_onboarding_status_chk
        check (status in ('pending', 'finishing', 'skipped', 'completed')),
    constraint member_onboarding_tour_chk
        check (tour is null or tour in ('declined', 'in_progress', 'completed', 'skipped')),
    constraint member_onboarding_tour_step_chk
        check (tour_step >= 0 and tour_step <= 20),
    constraint member_onboarding_draft_object
        check (draft is null or jsonb_typeof(draft) = 'object'),
    constraint member_onboarding_draft_size
        check (draft is null or octet_length(draft::text) <= 32000),
    constraint member_onboarding_applied_size
        check (coalesce(cardinality(applied_template_keys), 0) <= 200),
    constraint member_onboarding_created_size
        check (coalesce(cardinality(created_account_ids), 0) <= 20)
);

alter table public.member_onboarding enable row level security;

revoke all on table public.member_onboarding from anon, authenticated;
