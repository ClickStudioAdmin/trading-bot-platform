-- A row means this Bybit account may try that agreement group.
-- Stock and metal contracts share tradfi. Crude oil is oil.
-- Missing row keeps those contracts disabled in the picker.

create table public.exchange_agreement_clears (
    connection_id uuid not null references public.exchange_connections (id) on delete cascade,
    kind text not null check (kind in ('tradfi', 'oil')),
    created_at timestamptz not null default now(),
    primary key (connection_id, kind)
);

comment on table public.exchange_agreement_clears is
    'Bybit agreement groups this connection may trade. Cleared when Bybit still requires the signature.';

alter table public.exchange_agreement_clears enable row level security;

create policy exchange_agreement_clears_select_own
    on public.exchange_agreement_clears
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.exchange_connections
            where exchange_connections.id = exchange_agreement_clears.connection_id
                and exchange_connections.user_id = auth.uid()
        )
    );

revoke all on table public.exchange_agreement_clears from anon, authenticated;

grant select on table public.exchange_agreement_clears to authenticated;
