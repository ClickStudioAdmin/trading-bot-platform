-- Position and carry logs are read by data->>'positionId' / data->>'carryId'
-- together with account_id and scope. Without these indexes each lookup
-- scans that account's trade and strategy logs.
--
-- Building the index scans event_logs once. The hosted statement_timeout
-- cancels that scan (57014). Turn the timeout off for this transaction.
-- db push runs the file in one transaction, so the index cannot be built
-- concurrently.

set local statement_timeout = 0;

create index event_logs_account_position_id_idx
    on public.event_logs (account_id, (data ->> 'positionId'))
    where scope in ('trade', 'strategy')
      and (data ->> 'positionId') is not null;

create index event_logs_account_carry_id_idx
    on public.event_logs (account_id, (data ->> 'carryId'))
    where scope in ('trade', 'strategy')
      and (data ->> 'carryId') is not null;
