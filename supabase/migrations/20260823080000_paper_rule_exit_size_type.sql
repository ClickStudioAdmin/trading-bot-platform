-- Exit order type: fixed flattens the row; dynamic clips out as book allows.

alter table public.paper_rules
    add column exit_size_type text not null default 'dynamic'
    check (exit_size_type in ('fixed', 'dynamic'));

alter table public.paper_carries
    add column exit_size_type text
    check (exit_size_type is null or exit_size_type in ('fixed', 'dynamic'));

update public.paper_carries as carries
set exit_size_type = rules.exit_size_type
from public.paper_rules as rules
where carries.rule_id = rules.id
  and carries.source = 'engine';
