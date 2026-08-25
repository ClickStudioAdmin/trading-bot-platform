-- Reduce-only GTC limits that close an open Futures row.

alter table public.futures_working_orders
    add column reduce_only boolean not null default false;
