-- Admin → Exchanges. Live is public on new desks. Testing is admin-only.
-- One row per integrated exchange, desk type, and mode (paper / demo / live).

create table public.exchange_availability (
    venue text not null,
    desk_type text not null,
    mode text not null,
    live boolean not null default false,
    testing boolean not null default false,
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
        check (mode in ('paper', 'demo', 'live'))
);

alter table public.exchange_availability enable row level security;

revoke all on table public.exchange_availability from anon, authenticated;

-- Seed the current registry: members can already use every supported combo.
insert into public.exchange_availability (venue, desk_type, mode, live, testing)
select venue, desk_type, mode, true, false
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
