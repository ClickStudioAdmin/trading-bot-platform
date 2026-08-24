-- Per-set automation mode: active (enter and exit), reduce_only (exit only),
-- or disabled (neither). Account-level reduce_only still overrides Active sets.

alter table public.paper_rules
    add column mode text not null default 'active'
        check (mode in ('active', 'reduce_only', 'disabled'));
