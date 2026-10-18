-- Live and Testing are exclusive. A row that had both stays Live.
-- A row with neither becomes Live, matching the original seed.

update public.exchange_availability
set testing = false,
    updated_at = now()
where live and testing;

update public.exchange_availability
set live = true,
    updated_at = now()
where not live and not testing;

alter table public.exchange_availability
    drop constraint if exists exchange_availability_one_choice;

alter table public.exchange_availability
    add constraint exchange_availability_one_choice
    check ((live and not testing) or (testing and not live));
