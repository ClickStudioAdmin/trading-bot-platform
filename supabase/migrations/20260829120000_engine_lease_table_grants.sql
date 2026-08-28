-- Table grants so the service-role client can claim desks without PostgREST RPCs.

grant select, insert, update on table public.engine_desk_leases to service_role;
grant select, insert, update on table public.engine_venue_gates to service_role;

notify pgrst, 'reload schema';
