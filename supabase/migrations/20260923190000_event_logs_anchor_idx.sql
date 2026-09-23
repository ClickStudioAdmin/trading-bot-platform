-- Position and carry logs are read by data->>'positionId' / data->>'carryId'
-- together with account_id and scope. Without these indexes each lookup
-- scans that account's trade and strategy logs.

create index event_logs_account_position_id_idx
    on public.event_logs (account_id, (data ->> 'positionId'))
    where scope in ('trade', 'strategy')
      and (data ->> 'positionId') is not null;

create index event_logs_account_carry_id_idx
    on public.event_logs (account_id, (data ->> 'carryId'))
    where scope in ('trade', 'strategy')
      and (data ->> 'carryId') is not null;
