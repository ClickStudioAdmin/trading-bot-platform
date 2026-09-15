-- Refunds after hold write a negative commission row. The earn unique
-- stays on non-negative rows so a reversal can share invoice + earner + level.

alter table public.membership_commissions
    drop constraint if exists membership_commissions_amount_usd_check;

alter table public.membership_commissions
    add constraint membership_commissions_amount_usd_check
    check (amount_usd <> 0);

alter table public.membership_commissions
    drop constraint if exists membership_commissions_invoice_id_earner_user_id_level_key;

create unique index if not exists membership_commissions_earn_unique
    on public.membership_commissions (invoice_id, earner_user_id, level)
    where amount_usd >= 0;
