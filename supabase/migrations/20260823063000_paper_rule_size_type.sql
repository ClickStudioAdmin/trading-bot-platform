-- Fixed vs dynamic paper size. Dynamic clips to book value and uses min size.

alter table public.paper_rules
    add column size_type text not null default 'fixed'
    check (size_type in ('fixed', 'dynamic')),
    add column min_size_usdt numeric
    check (min_size_usdt is null or min_size_usdt > 0);

alter table public.paper_carries
    add column entry_size_type text
    check (entry_size_type is null or entry_size_type in ('fixed', 'dynamic')),
    add column entry_min_size_usdt numeric;

update public.paper_carries as carries
set
    entry_size_type = rules.size_type,
    entry_min_size_usdt = rules.min_size_usdt
from public.paper_rules as rules
where carries.rule_id = rules.id
  and carries.source = 'engine';
