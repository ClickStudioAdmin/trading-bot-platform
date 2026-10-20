-- Latches the Flex additional-order condition so the engine fires on the
-- rising edge, the same way condition_true latches the entry.

alter table public.futures_automation_rules
  add column if not exists add_condition_true boolean not null default false;

alter table public.futures_automation_rules
  add column if not exists short_add_condition_true boolean not null default false;

comment on column public.futures_automation_rules.add_condition_true is
  'True after the long Flex additional-order condition has fired, until it is false again.';

comment on column public.futures_automation_rules.short_add_condition_true is
  'True after the short Flex additional-order condition has fired, until it is false again.';
