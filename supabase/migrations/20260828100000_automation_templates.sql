-- Login-scoped automation templates and template sets.
-- Member writes go through service-role server actions. RLS is defence in depth.

create table public.automation_templates (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.members (user_id) on delete cascade,
    visibility text not null
        check (visibility in ('user', 'platform')),
    desk_type text not null
        check (desk_type in ('dca', 'perps', 'cash_and_carry')),
    name text not null
        check (char_length(trim(name)) between 1 and 80),
    description text
        check (description is null or char_length(description) <= 500),
    recipe jsonb not null
        check (jsonb_typeof(recipe) = 'object'),
    recipe_version integer not null
        check (recipe_version >= 1),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (
        (visibility = 'platform' and user_id is null)
        or (visibility = 'user' and user_id is not null)
    )
);

create unique index automation_templates_user_name_idx
    on public.automation_templates (user_id, lower(name), desk_type)
    where visibility = 'user';

create unique index automation_templates_platform_name_idx
    on public.automation_templates (lower(name), desk_type)
    where visibility = 'platform';

create index automation_templates_user_idx
    on public.automation_templates (user_id, desk_type);

create table public.automation_template_sets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.members (user_id) on delete cascade,
    visibility text not null
        check (visibility in ('user', 'platform')),
    desk_type text not null
        check (desk_type in ('dca', 'perps', 'cash_and_carry')),
    name text not null
        check (char_length(trim(name)) between 1 and 80),
    description text
        check (description is null or char_length(description) <= 500),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (
        (visibility = 'platform' and user_id is null)
        or (visibility = 'user' and user_id is not null)
    )
);

create unique index automation_template_sets_user_name_idx
    on public.automation_template_sets (user_id, lower(name), desk_type)
    where visibility = 'user';

create unique index automation_template_sets_platform_name_idx
    on public.automation_template_sets (lower(name), desk_type)
    where visibility = 'platform';

create table public.automation_template_set_items (
    set_id uuid not null
        references public.automation_template_sets (id) on delete cascade,
    template_id uuid not null
        references public.automation_templates (id) on delete cascade,
    sort_order integer not null default 0,
    primary key (set_id, template_id)
);

create index automation_template_set_items_template_idx
    on public.automation_template_set_items (template_id);

create or replace function public.automation_template_set_item_guard()
returns trigger
language plpgsql
as $$
declare
    set_row public.automation_template_sets%rowtype;
    tpl public.automation_templates%rowtype;
begin
    select * into set_row
    from public.automation_template_sets
    where id = new.set_id;
    select * into tpl
    from public.automation_templates
    where id = new.template_id;
    if set_row.id is null or tpl.id is null then
        raise exception 'template set item is missing a set or template';
    end if;
    if set_row.desk_type is distinct from tpl.desk_type then
        raise exception 'template set items must match the set desk type';
    end if;
    if set_row.visibility = 'platform' and tpl.visibility <> 'platform' then
        raise exception 'platform sets may only contain platform templates';
    end if;
    return new;
end;
$$;

create trigger automation_template_set_item_guard
    before insert or update on public.automation_template_set_items
    for each row
    execute procedure public.automation_template_set_item_guard();

alter table public.automation_templates enable row level security;
alter table public.automation_template_sets enable row level security;
alter table public.automation_template_set_items enable row level security;

create policy automation_templates_select_visible
    on public.automation_templates
    for select
    to authenticated
    using (visibility = 'platform' or user_id = auth.uid());

create policy automation_template_sets_select_visible
    on public.automation_template_sets
    for select
    to authenticated
    using (visibility = 'platform' or user_id = auth.uid());

create policy automation_template_set_items_select_visible
    on public.automation_template_set_items
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.automation_template_sets s
            where s.id = set_id
              and (s.visibility = 'platform' or s.user_id = auth.uid())
        )
    );

revoke all on table public.automation_templates from anon, authenticated;
revoke all on table public.automation_template_sets from anon, authenticated;
revoke all on table public.automation_template_set_items from anon, authenticated;

grant select on table public.automation_templates to authenticated;
grant select on table public.automation_template_sets to authenticated;
grant select on table public.automation_template_set_items to authenticated;
