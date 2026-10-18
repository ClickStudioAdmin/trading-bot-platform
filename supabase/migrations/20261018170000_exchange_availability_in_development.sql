-- In Development is a fourth exclusive choice. It stays off new desks.
-- Existing rows keep Live, Testing, or Beta.

alter table public.exchange_availability
    add column if not exists in_development boolean not null default false;

alter table public.exchange_availability
    drop constraint if exists exchange_availability_one_choice;

alter table public.exchange_availability
    add constraint exchange_availability_one_choice
    check (
        (in_development and not testing and not beta and not live)
        or (testing and not in_development and not beta and not live)
        or (beta and not in_development and not testing and not live)
        or (live and not in_development and not testing and not beta)
    );
