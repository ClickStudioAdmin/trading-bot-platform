-- Flex and DCA bot names match the 80-character app limit.
-- Cash and Carry names are unconstrained text and already follow the app.

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_name_check;

alter table public.futures_automation_rules
    add constraint futures_automation_rules_name_check
    check (char_length(trim(name)) between 1 and 80);

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_name_check;

alter table public.dca_playbooks
    add constraint dca_playbooks_name_check
    check (char_length(trim(name)) between 1 and 80);
