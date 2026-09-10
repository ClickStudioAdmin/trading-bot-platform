-- Perps TP/SL can be a price or a percent from the fill / entry.

alter table public.futures_automation_rules
    add column if not exists tp_kind text,
    add column if not exists sl_kind text;

update public.futures_automation_rules
set
    tp_kind = case
        when take_profit is not null then coalesce(tp_kind, 'price')
        else tp_kind
    end,
    sl_kind = case
        when stop_loss is not null then coalesce(sl_kind, 'price')
        else sl_kind
    end;

alter table public.futures_automation_rules
    drop constraint if exists futures_automation_rules_tp_kind_check,
    drop constraint if exists futures_automation_rules_sl_kind_check;

alter table public.futures_automation_rules
    add constraint futures_automation_rules_tp_kind_check
        check (tp_kind is null or tp_kind in ('price', 'percent')),
    add constraint futures_automation_rules_sl_kind_check
        check (sl_kind is null or sl_kind in ('price', 'percent'));
