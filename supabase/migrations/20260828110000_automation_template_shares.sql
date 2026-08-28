-- Member-to-member template and set shares. Email is resolved to user_id in
-- server actions. Recipient access is by user_id, not email.

create table public.automation_template_shares (
    id uuid primary key default gen_random_uuid(),
    template_id uuid not null
        references public.automation_templates (id) on delete cascade,
    from_user_id uuid not null
        references public.members (user_id) on delete cascade,
    to_user_id uuid not null
        references public.members (user_id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (template_id, to_user_id),
    check (from_user_id <> to_user_id)
);

create index automation_template_shares_to_idx
    on public.automation_template_shares (to_user_id);

create index automation_template_shares_from_idx
    on public.automation_template_shares (from_user_id);

create table public.automation_template_set_shares (
    id uuid primary key default gen_random_uuid(),
    set_id uuid not null
        references public.automation_template_sets (id) on delete cascade,
    from_user_id uuid not null
        references public.members (user_id) on delete cascade,
    to_user_id uuid not null
        references public.members (user_id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (set_id, to_user_id),
    check (from_user_id <> to_user_id)
);

create index automation_template_set_shares_to_idx
    on public.automation_template_set_shares (to_user_id);

create index automation_template_set_shares_from_idx
    on public.automation_template_set_shares (from_user_id);

create or replace function public.automation_template_share_guard()
returns trigger
language plpgsql
as $$
declare
    tpl public.automation_templates%rowtype;
begin
    select * into tpl
    from public.automation_templates
    where id = new.template_id;
    if tpl.id is null then
        raise exception 'template share is missing a template';
    end if;
    if tpl.visibility = 'platform' then
        raise exception 'platform templates are already visible to every member';
    end if;
    return new;
end;
$$;

create trigger automation_template_share_guard
    before insert or update on public.automation_template_shares
    for each row
    execute procedure public.automation_template_share_guard();

create or replace function public.automation_template_set_share_guard()
returns trigger
language plpgsql
as $$
declare
    set_row public.automation_template_sets%rowtype;
begin
    select * into set_row
    from public.automation_template_sets
    where id = new.set_id;
    if set_row.id is null then
        raise exception 'template set share is missing a set';
    end if;
    if set_row.visibility = 'platform' then
        raise exception 'platform sets are already visible to every member';
    end if;
    return new;
end;
$$;

create trigger automation_template_set_share_guard
    before insert or update on public.automation_template_set_shares
    for each row
    execute procedure public.automation_template_set_share_guard();

alter table public.automation_template_shares enable row level security;
alter table public.automation_template_set_shares enable row level security;

create policy automation_template_shares_select_own
    on public.automation_template_shares
    for select
    to authenticated
    using (from_user_id = auth.uid() or to_user_id = auth.uid());

create policy automation_template_set_shares_select_own
    on public.automation_template_set_shares
    for select
    to authenticated
    using (from_user_id = auth.uid() or to_user_id = auth.uid());

revoke all on table public.automation_template_shares from anon, authenticated;
revoke all on table public.automation_template_set_shares from anon, authenticated;

grant select on table public.automation_template_shares to authenticated;
grant select on table public.automation_template_set_shares to authenticated;
