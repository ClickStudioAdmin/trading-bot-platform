-- Beta is a third exclusive choice. Members can create the desk.
-- The desk shows a beta notice. Existing rows stay Live.

alter table public.exchange_availability
    add column if not exists beta boolean not null default false;

alter table public.exchange_availability
    drop constraint if exists exchange_availability_one_choice;

alter table public.exchange_availability
    add constraint exchange_availability_one_choice
    check (
        (live and not testing and not beta)
        or (testing and not live and not beta)
        or (beta and not live and not testing)
    );
