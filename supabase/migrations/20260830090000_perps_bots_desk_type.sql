alter table public.trading_accounts
    drop constraint if exists trading_accounts_desk_type_check;

alter table public.trading_accounts
    add constraint trading_accounts_desk_type_check
        check (desk_type in (
            'cash_and_carry',
            'perps',
            'perps_bots',
            'signal_follower',
            'dca'
        ));
