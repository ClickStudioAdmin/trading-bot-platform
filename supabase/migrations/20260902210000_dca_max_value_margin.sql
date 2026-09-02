-- Max value can also be a percent of available margin
-- (available book × leverage). Both percent kinds stay capped at 100.

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_max_value_kind_check;

alter table public.dca_playbooks
    add constraint dca_playbooks_max_value_kind_check
    check (max_value_kind in ('usdt', 'percent', 'margin'));

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_max_value_percent_ck;

alter table public.dca_playbooks
    add constraint dca_playbooks_max_value_percent_ck
    check (
        max_value_kind not in ('percent', 'margin')
        or max_value is null
        or max_value <= 100
    );
