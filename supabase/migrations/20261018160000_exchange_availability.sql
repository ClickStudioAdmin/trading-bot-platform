-- Admin → Exchanges. One row per integrated exchange, desk type, and mode.
-- Exactly one of live, testing, or beta. Seed is Live.
-- Version stays after 20261018130000. 20261018120000 is the retrace migration
-- already applied on the development database.

create table public.exchange_availability (
    venue text not null,
    desk_type text not null,
    mode text not null,
    live boolean not null default false,
    testing boolean not null default false,
    beta boolean not null default false,
    updated_at timestamptz not null default now(),
    primary key (venue, desk_type, mode),
    constraint exchange_availability_venue_check
        check (venue ~ '^[a-z][a-z0-9_]{0,31}$'),
    constraint exchange_availability_desk_type_check
        check (desk_type in (
            'cash_and_carry',
            'manual',
            'flex',
            'signal_follower',
            'dca'
        )),
    constraint exchange_availability_mode_check
        check (mode in ('paper', 'demo', 'live')),
    constraint exchange_availability_one_choice
        check (
            (live and not testing and not beta)
            or (testing and not live and not beta)
            or (beta and not live and not testing)
        )
);

alter table public.exchange_availability enable row level security;

revoke all on table public.exchange_availability from anon, authenticated;

-- Seed the current registry: members can already use every supported combo.
insert into public.exchange_availability (venue, desk_type, mode, live, testing, beta)
select venue, desk_type, mode, true, false, false
from (
    values ('bybit'), ('hyperliquid')
) as venues (venue)
cross join (
    values ('paper'), ('demo'), ('live')
) as modes (mode)
cross join (
    values
        ('cash_and_carry'),
        ('manual'),
        ('flex'),
        ('signal_follower'),
        ('dca')
) as types (desk_type)
where not (venue = 'hyperliquid' and desk_type = 'cash_and_carry');
