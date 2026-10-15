-- Perps bots: Long, Short, or Both.
-- Both keeps the long leg on the existing columns and the short leg in short_entry.
-- short_condition_true latches the short leg the same way condition_true latches the long leg.

alter table public.futures_automation_rules
  add column if not exists direction text;

update public.futures_automation_rules
set direction = case
  when action = 'sell' or close_side = 'short' then 'short'
  else 'long'
end
where direction is null;

alter table public.futures_automation_rules
  alter column direction set default 'long';

alter table public.futures_automation_rules
  alter column direction set not null;

alter table public.futures_automation_rules
  drop constraint if exists futures_automation_rules_direction_check;

alter table public.futures_automation_rules
  add constraint futures_automation_rules_direction_check
  check (direction in ('long', 'short', 'both'));

alter table public.futures_automation_rules
  add column if not exists short_entry jsonb;

alter table public.futures_automation_rules
  add column if not exists short_condition_true boolean not null default false;
