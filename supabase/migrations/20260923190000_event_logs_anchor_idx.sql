-- Do not build expression indexes on event_logs.data here.
--
-- CREATE INDEX scans the whole table and sends nothing back while it runs.
-- The session pooler drops that quiet connection. The next db push then waits
-- on the lock from the build that is still running, so "Applying migration"
-- sits there until the job is cancelled.
--
-- Position and carry logs read event_logs by account_id and created_at.
-- That pair is already indexed.

do $$
begin
  null;
end $$;
