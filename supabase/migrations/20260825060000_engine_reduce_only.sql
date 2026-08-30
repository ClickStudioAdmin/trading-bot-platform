-- Reduce-only: automations may exit and clip, but must not open new entries.
-- Used to wind down a book before removing an exchange connection.

alter table public.paper_engine_settings
    add column reduce_only boolean not null default false;
