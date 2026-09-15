-- Main / Affiliate book totals must match walletEntryDelta (withdraw is a debit
-- even when amount_usd is stored positive). Used by crypto collect and pay.

create or replace function public.membership_wallet_book_balance(
    p_user_id uuid,
    p_book text
)
returns numeric
language sql
stable
as $$
    select coalesce(sum(
        case
            when coalesce(
                book,
                case when kind = 'commission' then 'affiliate' else 'main' end
            ) <> p_book then 0
            when kind in ('deposit', 'commission', 'transfer_in') then abs(amount_usd)
            when kind in ('debit_rent', 'withdraw', 'transfer_out') then -abs(amount_usd)
            else amount_usd
        end
    ), 0)
    from public.membership_wallet_entries
    where user_id = p_user_id;
$$;

create or replace function public.collect_open_membership_invoice(
    p_invoice_id uuid,
    p_transfer_usd numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_invoice public.membership_invoices%rowtype;
    v_transfer_id uuid;
    v_main numeric;
begin
    if p_transfer_usd < 0 then
        raise exception 'Transfer cannot be negative.';
    end if;

    select *
    into v_invoice
    from public.membership_invoices
    where id = p_invoice_id
    for update;
    if not found then
        raise exception 'Invoice not found.';
    end if;
    if v_invoice.status <> 'open' then
        return v_invoice.id;
    end if;
    if v_invoice.method <> 'wallet' then
        raise exception 'Only crypto invoices can be collected from Account Balance.';
    end if;

    if p_transfer_usd >= 0.01 then
        v_transfer_id := gen_random_uuid();
        insert into public.membership_wallet_entries (
            user_id, book, kind, amount_usd, transfer_id, memo
        )
        values (
            v_invoice.user_id,
            'affiliate',
            'transfer_out',
            -abs(p_transfer_usd),
            v_transfer_id,
            'Plan shortfall from affiliate'
        );
        insert into public.membership_wallet_entries (
            user_id, book, kind, amount_usd, transfer_id, memo
        )
        values (
            v_invoice.user_id,
            'main',
            'transfer_in',
            abs(p_transfer_usd),
            v_transfer_id,
            'From affiliate earnings'
        );
    end if;

    v_main := public.membership_wallet_book_balance(v_invoice.user_id, 'main');
    if v_main < v_invoice.amount_usd then
        raise exception 'Insufficient Account Balance.';
    end if;

    insert into public.membership_wallet_entries (
        user_id, book, kind, amount_usd, memo
    )
    values (
        v_invoice.user_id,
        'main',
        'debit_rent',
        -abs(v_invoice.amount_usd),
        'Subscription'
    );

    update public.membership_invoices
    set status = 'paid'
    where id = v_invoice.id
      and status = 'open';

    update public.members
    set
        plan_id = v_invoice.plan_id,
        billing_method = 'wallet',
        subscription_status = 'active',
        period_end = v_invoice.period_end,
        updated_at = now()
    where user_id = v_invoice.user_id;

    return v_invoice.id;
end;
$$;

create or replace function public.pay_membership_from_wallet(
    p_user_id uuid,
    p_plan_id uuid,
    p_amount_usd numeric,
    p_transfer_usd numeric,
    p_period_start timestamptz,
    p_period_end timestamptz,
    p_external_id text,
    p_set_enroll boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_invoice_id uuid;
    v_transfer_id uuid;
    v_existing uuid;
    v_main numeric;
begin
    if p_amount_usd < 0.01 then
        raise exception 'Plan price must be positive.';
    end if;
    if p_transfer_usd < 0 then
        raise exception 'Transfer cannot be negative.';
    end if;

    select id
    into v_existing
    from public.membership_invoices
    where method = 'wallet'
      and external_id = p_external_id;
    if found then
        return v_existing;
    end if;

    if p_transfer_usd >= 0.01 then
        v_transfer_id := gen_random_uuid();
        insert into public.membership_wallet_entries (
            user_id, book, kind, amount_usd, transfer_id, memo
        )
        values (
            p_user_id,
            'affiliate',
            'transfer_out',
            -abs(p_transfer_usd),
            v_transfer_id,
            'Plan shortfall from affiliate'
        );
        insert into public.membership_wallet_entries (
            user_id, book, kind, amount_usd, transfer_id, memo
        )
        values (
            p_user_id,
            'main',
            'transfer_in',
            abs(p_transfer_usd),
            v_transfer_id,
            'From affiliate earnings'
        );
    end if;

    v_main := public.membership_wallet_book_balance(p_user_id, 'main');
    if v_main < p_amount_usd then
        raise exception 'Insufficient Account Balance.';
    end if;

    insert into public.membership_wallet_entries (
        user_id, book, kind, amount_usd, memo
    )
    values (
        p_user_id,
        'main',
        'debit_rent',
        -abs(p_amount_usd),
        'Subscription'
    );

    insert into public.membership_invoices (
        user_id,
        plan_id,
        method,
        external_id,
        amount_usd,
        status,
        period_start,
        period_end
    )
    values (
        p_user_id,
        p_plan_id,
        'wallet',
        p_external_id,
        p_amount_usd,
        'paid',
        p_period_start,
        p_period_end
    )
    returning id into v_invoice_id;

    update public.members
    set
        plan_id = p_plan_id,
        billing_method = 'wallet',
        subscription_status = 'active',
        period_end = p_period_end,
        last_enroll_plan_id = case
            when p_set_enroll then p_plan_id
            else last_enroll_plan_id
        end,
        updated_at = now()
    where user_id = p_user_id;

    return v_invoice_id;
exception
    when unique_violation then
        select id
        into v_invoice_id
        from public.membership_invoices
        where method = 'wallet'
          and external_id = p_external_id;
        return v_invoice_id;
end;
$$;

revoke all on function public.membership_wallet_book_balance(uuid, text)
    from public, anon, authenticated;
revoke all on function public.collect_open_membership_invoice(uuid, numeric)
    from public, anon, authenticated;
revoke all on function public.pay_membership_from_wallet(
    uuid, uuid, numeric, numeric, timestamptz, timestamptz, text, boolean
) from public, anon, authenticated;
grant execute on function public.membership_wallet_book_balance(uuid, text)
    to service_role;
grant execute on function public.collect_open_membership_invoice(uuid, numeric)
    to service_role;
grant execute on function public.pay_membership_from_wallet(
    uuid, uuid, numeric, numeric, timestamptz, timestamptz, text, boolean
) to service_role;
