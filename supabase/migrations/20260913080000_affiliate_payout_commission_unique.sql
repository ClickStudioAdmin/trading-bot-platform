-- A commission row can sit on only one payout.
create unique index if not exists membership_payout_items_commission_uidx
    on public.membership_payout_items (commission_id);
