-- Platform templates and folders can be flagged for a starter pack.
-- User-owned rows must stay false.

alter table public.automation_templates
    add column starter_pack boolean not null default false;

alter table public.automation_template_sets
    add column starter_pack boolean not null default false;

alter table public.automation_templates
    add constraint automation_templates_starter_pack_platform_chk
    check (visibility = 'platform' or starter_pack = false);

alter table public.automation_template_sets
    add constraint automation_template_sets_starter_pack_platform_chk
    check (visibility = 'platform' or starter_pack = false);

create index automation_templates_starter_pack_idx
    on public.automation_templates (desk_type)
    where starter_pack;

create index automation_template_sets_starter_pack_idx
    on public.automation_template_sets (desk_type)
    where starter_pack;
