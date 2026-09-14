-- Develop-only: sample Main + Affiliate ledger rows on the first admin
-- login so Billing → Wallet Ledger shows every kind, including paying a
-- month from affiliate earnings. Do not merge to main.

do $$
declare
    admin_id uuid;
    plan_id uuid;
    transfer_fee uuid := md5('click-admin-ledger:transfer:fee')::uuid;
    t0 timestamptz := timezone('utc', now()) - interval '90 days';
begin
    if exists (
        select 1
        from public.membership_wallet_entries
        where external_id like 'click-admin-ledger:%'
        limit 1
    ) then
        raise notice 'Admin wallet ledger demo already present; skipping';
        return;
    end if;

    select user_id
    into admin_id
    from public.members
    where role = 'admin'
      and status = 'active'
      and lower(email) = 'click.studio.admin@gmail.com'
    limit 1;

    if admin_id is null then
        select user_id
        into admin_id
        from public.members
        where role = 'admin'
          and status = 'active'
        order by created_at
        limit 1;
    end if;

    if admin_id is null then
        raise notice 'Admin wallet ledger demo needs an active admin member';
        return;
    end if;

    select coalesce(
        (
            select m.last_enroll_plan_id
            from public.members m
            where m.user_id = admin_id
        ),
        (select id from public.membership_plans where slug = 'pro' limit 1),
        (
            select id
            from public.membership_plans
            where price_usd >= 0.01
            order by price_usd desc
            limit 1
        )
    )
    into plan_id;

    insert into public.membership_wallet_entries (
        user_id,
        book,
        kind,
        amount_usd,
        transfer_id,
        external_id,
        memo,
        created_at
    )
    values
        (
            admin_id,
            'main',
            'deposit',
            30,
            null,
            'click-admin-ledger:deposit:seed',
            'On-chain deposit',
            t0
        ),
        (
            admin_id,
            'affiliate',
            'commission',
            80,
            null,
            'click-admin-ledger:commission:l1',
            'L1 commission',
            t0 + interval '5 days'
        ),
        (
            admin_id,
            'affiliate',
            'transfer_out',
            -19,
            transfer_fee,
            'click-admin-ledger:transfer-out:fee',
            'Plan shortfall from affiliate',
            t0 + interval '20 days'
        ),
        (
            admin_id,
            'main',
            'transfer_in',
            19,
            transfer_fee,
            'click-admin-ledger:transfer-in:fee',
            'From affiliate earnings',
            t0 + interval '20 days'
        ),
        (
            admin_id,
            'main',
            'debit_rent',
            -49,
            null,
            'click-admin-ledger:rent:affiliate-mix',
            'Subscription',
            t0 + interval '20 days' + interval '1 second'
        ),
        (
            admin_id,
            'main',
            'deposit',
            200,
            null,
            'click-admin-ledger:deposit:topup',
            'On-chain deposit',
            t0 + interval '35 days'
        ),
        (
            admin_id,
            'main',
            'debit_rent',
            -49,
            null,
            'click-admin-ledger:rent:main',
            'Subscription',
            t0 + interval '40 days'
        ),
        (
            admin_id,
            'main',
            'withdraw',
            100,
            null,
            'click-admin-ledger:withdraw:rejected',
            'USDT withdraw requested',
            t0 + interval '50 days'
        ),
        (
            admin_id,
            'main',
            'adjust',
            100,
            null,
            'click-admin-ledger:adjust:reject',
            'USDT withdraw rejected',
            t0 + interval '51 days'
        ),
        (
            admin_id,
            'main',
            'withdraw',
            40,
            null,
            'click-admin-ledger:withdraw:paid',
            'USDT withdraw requested',
            t0 + interval '65 days'
        ),
        (
            admin_id,
            'main',
            'adjust',
            -5,
            null,
            'click-admin-ledger:adjust:correction',
            'Balance correction',
            t0 + interval '75 days'
        ),
        (
            admin_id,
            'main',
            'deposit',
            50,
            null,
            'click-admin-ledger:deposit:later',
            'On-chain deposit',
            t0 + interval '80 days'
        ),
        (
            admin_id,
            'main',
            'debit_rent',
            -19,
            null,
            'click-admin-ledger:rent:plus',
            'Subscription',
            t0 + interval '85 days'
        );

    if plan_id is not null then
        insert into public.membership_invoices (
            user_id,
            plan_id,
            method,
            external_id,
            amount_usd,
            status,
            period_start,
            period_end,
            created_at
        )
        values
            (
                admin_id,
                plan_id,
                'wallet',
                'click-admin-ledger:invoice:affiliate-mix',
                49,
                'paid',
                t0 + interval '20 days',
                t0 + interval '50 days',
                t0 + interval '20 days' + interval '1 second'
            ),
            (
                admin_id,
                plan_id,
                'wallet',
                'click-admin-ledger:invoice:main',
                49,
                'paid',
                t0 + interval '40 days',
                t0 + interval '70 days',
                t0 + interval '40 days'
            ),
            (
                admin_id,
                plan_id,
                'wallet',
                'click-admin-ledger:invoice:plus',
                19,
                'paid',
                t0 + interval '85 days',
                t0 + interval '115 days',
                t0 + interval '85 days'
            );
    end if;
end $$;
