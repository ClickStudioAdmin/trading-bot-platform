-- Name each automation set, and snapshot that name on paper carries.

alter table public.paper_rules
    add column name text not null default '';

alter table public.paper_carries
    add column rule_name text;

update public.paper_rules
set name = 'Set ' || (sort_order + 1)::text
where btrim(name) = '';

update public.paper_carries as carries
set rule_name = rules.name
from public.paper_rules as rules
where carries.rule_id = rules.id
  and carries.rule_name is null;
