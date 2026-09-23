-- Contracts this exchange connection cannot open until the account signs
-- Bybit's agreement for that symbol. Cleared when the bot is saved.

create table public.exchange_agreement_blocks (
    connection_id uuid not null references public.exchange_connections (id) on delete cascade,
    symbol text not null check (
        char_length(symbol) between 4 and 32
        and symbol ~ '^[A-Z0-9]+$'
    ),
    created_at timestamptz not null default now(),
    primary key (connection_id, symbol)
);

comment on table public.exchange_agreement_blocks is
    'Per-connection symbols Bybit refused for an unsigned agreement. Opening orders stay off until the row is cleared.';

alter table public.exchange_agreement_blocks enable row level security;

create policy exchange_agreement_blocks_select_own
    on public.exchange_agreement_blocks
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.exchange_connections
            where exchange_connections.id = exchange_agreement_blocks.connection_id
                and exchange_connections.user_id = auth.uid()
        )
    );

revoke all on table public.exchange_agreement_blocks from anon, authenticated;

grant select on table public.exchange_agreement_blocks to authenticated;
