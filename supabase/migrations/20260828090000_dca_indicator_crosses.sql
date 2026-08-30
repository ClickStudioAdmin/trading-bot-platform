alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_indicator_compare_check;

alter table public.dca_playbooks
    add constraint dca_playbooks_indicator_compare_check
        check (
            indicator_compare is null
            or indicator_compare in ('gte', 'lte', 'cross_gte', 'cross_lte')
        );
