-- Cash-and-carry (and later strategies) attach one account connection.
-- Restrict delete so a bound key cannot be removed until the strategy detaches.

alter table public.paper_engine_settings
    add column exchange_connection_id uuid
        references public.exchange_connections (id) on delete restrict;

create index paper_engine_settings_exchange_connection_idx
    on public.paper_engine_settings (exchange_connection_id)
    where exchange_connection_id is not null;
