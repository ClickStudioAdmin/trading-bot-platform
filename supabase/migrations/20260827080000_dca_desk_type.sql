-- Phase 11: DCA desk type. Still one playbook per desk; same futures blotter.

alter table public.trading_accounts
    drop constraint if exists trading_accounts_desk_type_check;

alter table public.trading_accounts
    add constraint trading_accounts_desk_type_check
        check (desk_type in ('cash_and_carry', 'perps', 'signal_follower', 'dca'));
