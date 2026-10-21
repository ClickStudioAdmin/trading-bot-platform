-- Running high, low, and initial-entry arm for Flex additional-order retrace.
-- Cleared when the bot is saved and when that side is flat.

alter table public.futures_automation_rules
  add column if not exists add_retrace jsonb;

alter table public.futures_automation_rules
  add column if not exists short_add_retrace jsonb;

comment on column public.futures_automation_rules.add_retrace is
  'Position retrace memory for the long Flex additional-order stack. Null when flat or after save.';

comment on column public.futures_automation_rules.short_add_retrace is
  'Position retrace memory for the short Flex additional-order stack on direction Both.';
