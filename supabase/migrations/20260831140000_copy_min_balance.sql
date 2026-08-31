-- Copy trading: optional min available balance a Live copier must hold.

alter table public.desk_copy_listings
    add column min_balance_usdt numeric
        check (min_balance_usdt is null or min_balance_usdt > 0);
