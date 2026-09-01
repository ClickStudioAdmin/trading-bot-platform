-- Max value can be a fixed quote amount or a percent of the account book.
-- Percent is resolved to USDT at the start of each cycle (first clip) and
-- stamped on the leg so the ladder does not resize mid-cycle.

alter table public.dca_playbooks
    add column max_value_kind text not null default 'usdt'
        check (max_value_kind in ('usdt', 'percent')),
    add column long_cycle_max_value numeric
        check (long_cycle_max_value is null or long_cycle_max_value > 0),
    add column short_cycle_max_value numeric
        check (short_cycle_max_value is null or short_cycle_max_value > 0);

alter table public.dca_playbooks
    add constraint dca_playbooks_max_value_percent_ck
    check (
        max_value_kind <> 'percent'
        or max_value is null
        or max_value <= 100
    );
