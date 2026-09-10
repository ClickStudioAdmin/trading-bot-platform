-- Row Close persists closing so the blotter can hold Closing until flatten fills.

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_long_status_check,
    drop constraint if exists dca_playbooks_short_status_check;

alter table public.dca_playbooks
    add constraint dca_playbooks_long_status_check
        check (long_status in ('idle', 'armed', 'stop_adding', 'closing')),
    add constraint dca_playbooks_short_status_check
        check (short_status in ('idle', 'armed', 'stop_adding', 'closing'));
