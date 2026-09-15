-- Recurring invoices: issue open 7 days before period end, collect when funds exist.

alter table public.membership_invoices
    drop constraint if exists membership_invoices_status_check;

alter table public.membership_invoices
    add constraint membership_invoices_status_check
    check (status in ('open', 'paid', 'refunded', 'void'));

alter table public.membership_invoices
    add column if not exists due_at timestamptz;

create unique index if not exists membership_invoices_renewal_uidx
    on public.membership_invoices (user_id, external_id)
    where external_id like 'renewal:%';

create index if not exists membership_invoices_open_idx
    on public.membership_invoices (status, method, due_at)
    where status = 'open';

create or replace function public.create_open_membership_invoice(
    p_user_id uuid,
    p_plan_id uuid,
    p_method text,
    p_external_id text,
    p_amount_usd numeric,
    p_period_start timestamptz,
    p_period_end timestamptz,
    p_due_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
begin
    if p_method not in ('stripe', 'wallet') then
        raise exception 'Invoice method must be stripe or wallet.';
    end if;
    if p_amount_usd < 0.01 then
        raise exception 'Invoice amount must be positive.';
    end if;

    select id
    into v_id
    from public.membership_invoices
    where user_id = p_user_id
      and external_id = p_external_id;
    if found then
        return v_id;
    end if;

    insert into public.membership_invoices (
        user_id,
        plan_id,
        method,
        external_id,
        amount_usd,
        status,
        period_start,
        period_end,
        due_at
    )
    values (
        p_user_id,
        p_plan_id,
        p_method,
        p_external_id,
        p_amount_usd,
        'open',
        p_period_start,
        p_period_end,
        p_due_at
    )
    returning id into v_id;
    return v_id;
exception
    when unique_violation then
        select id
        into v_id
        from public.membership_invoices
        where user_id = p_user_id
          and external_id = p_external_id;
        return v_id;
end;
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

    select coalesce(sum(amount_usd), 0)
    into v_main
    from public.membership_wallet_entries
    where user_id = v_invoice.user_id
      and book = 'main';
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

revoke all on function public.create_open_membership_invoice(
    uuid, uuid, text, text, numeric, timestamptz, timestamptz, timestamptz
) from public, anon, authenticated;
revoke all on function public.collect_open_membership_invoice(uuid, numeric)
    from public, anon, authenticated;
grant execute on function public.create_open_membership_invoice(
    uuid, uuid, text, text, numeric, timestamptz, timestamptz, timestamptz
) to service_role;
grant execute on function public.collect_open_membership_invoice(uuid, numeric)
    to service_role;
