-- Plan visibility: public catalog, private assign-only, or unpublished draft.
-- preview lets a draft appear on /account/plans for admin preview.

alter table public.membership_plans
    add column visibility text not null default 'public'
        check (visibility in ('public', 'private', 'draft')),
    add column preview boolean not null default false;

update public.membership_plans
set visibility = case when public then 'public' else 'private' end;

comment on column public.membership_plans.visibility is
    'public = upgrade catalog; private = assign to chosen members; draft = unpublished.';
comment on column public.membership_plans.preview is
    'When visibility is draft, include the plan on /account/plans for preview.';
