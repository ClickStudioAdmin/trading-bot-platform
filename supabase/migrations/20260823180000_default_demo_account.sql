-- The first account created for a member is Demo Account in paper mode.

update public.trading_accounts as target
set name = 'Demo Account'
where target.mode = 'paper'
    and target.name = 'Paper'
    and not exists (
        select 1
        from public.trading_accounts as other
        where other.user_id = target.user_id
            and lower(other.name) = 'demo account'
    );
