-- PostgREST was not serving claim_engine_desks (schema cache).
-- Recreate grants and force a cache reload. Same functions as
-- 20260829080000_engine_desk_leases.sql.

grant execute on function public.claim_engine_desks(text, integer, integer)
    to service_role;
grant execute on function public.try_claim_engine_desk(uuid, text, integer)
    to service_role;
grant execute on function public.release_engine_desk(uuid, text)
    to service_role;
grant execute on function public.take_engine_venue_slot(uuid, integer)
    to service_role;

notify pgrst, 'reload schema';
select pg_notification_queue_usage();
