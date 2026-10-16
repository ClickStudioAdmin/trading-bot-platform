-- Desk delete runs inside the database. One call removes one batch, commits,
-- and returns so the next call can continue. A single DELETE of a desk's
-- closed orders and activity logs can outlast the statement time limit.

create or replace function public.delete_desk_chunk(
    p_user_id uuid,
    p_account_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    chunk constant integer := 2000;
    removed integer := 0;
    target text;
    targets constant text[] := array[
        'futures_command_receipts',
        'futures_working_orders',
        'futures_orders',
        'futures_positions',
        'futures_automation_rules',
        'dca_playbooks',
        'futures_webhooks',
        'paper_orders',
        'paper_carries',
        'paper_rules'
    ];
begin
    -- A locked row or a slow batch must fail this call. The next call continues.
    perform set_config('lock_timeout', '2s', true);
    perform set_config('statement_timeout', '8s', true);

    if p_user_id is null or p_account_id is null then
        return 'missing';
    end if;

    if not exists (
        select 1
        from public.trading_accounts
        where id = p_account_id
          and user_id = p_user_id
    ) then
        return 'missing';
    end if;

    -- Parent desks cannot go while a copy still points at them.
    if exists (
        select 1
        from public.trading_accounts
        where copy_of_account_id = p_account_id
    ) then
        return 'copies';
    end if;

    foreach target in array targets
    loop
        execute format(
            'with doomed as (
                select id
                from public.%I
                where account_id = $1
                  and user_id = $2
                limit $3
            )
            delete from public.%I as desk_rows
            using doomed
            where desk_rows.id = doomed.id',
            target,
            target
        )
        using p_account_id, p_user_id, chunk;

        get diagnostics removed = row_count;
        if removed > 0 then
            return 'more';
        end if;
    end loop;

    with doomed as (
        select id
        from public.desk_copy_receipts
        where follower_account_id = p_account_id
        limit chunk
    )
    delete from public.desk_copy_receipts as desk_rows
    using doomed
    where desk_rows.id = doomed.id;
    get diagnostics removed = row_count;
    if removed > 0 then
        return 'more';
    end if;

    with doomed as (
        select user_id
        from public.desk_copy_favorites
        where account_id = p_account_id
        limit chunk
    )
    delete from public.desk_copy_favorites as desk_rows
    using doomed
    where desk_rows.account_id = p_account_id
      and desk_rows.user_id = doomed.user_id;
    get diagnostics removed = row_count;
    if removed > 0 then
        return 'more';
    end if;

    with doomed as (
        select id
        from public.event_logs
        where account_id = p_account_id
          and user_id = p_user_id
        limit chunk
    )
    update public.event_logs as desk_rows
    set account_id = null
    from doomed
    where desk_rows.id = doomed.id;
    get diagnostics removed = row_count;
    if removed > 0 then
        return 'more';
    end if;

    with doomed as (
        select id
        from public.backtest_studies
        where account_id = p_account_id
          and user_id = p_user_id
        limit chunk
    )
    update public.backtest_studies as desk_rows
    set account_id = null
    from doomed
    where desk_rows.id = doomed.id;
    get diagnostics removed = row_count;
    if removed > 0 then
        return 'more';
    end if;

    update public.strategy_settings
    set exchange_connection_id = null,
        updated_at = now()
    where account_id = p_account_id
      and user_id = p_user_id
      and exchange_connection_id is not null;

    update public.paper_engine_settings
    set exchange_connection_id = null,
        updated_at = now()
    where account_id = p_account_id
      and user_id = p_user_id
      and exchange_connection_id is not null;

    delete from public.strategy_settings
    where account_id = p_account_id
      and user_id = p_user_id;

    delete from public.paper_engine_settings
    where account_id = p_account_id
      and user_id = p_user_id;

    delete from public.trading_accounts
    where id = p_account_id
      and user_id = p_user_id;

    return 'done';
end;
$$;

revoke all on function public.delete_desk_chunk(uuid, uuid) from public;
revoke all on function public.delete_desk_chunk(uuid, uuid) from anon, authenticated;
grant execute on function public.delete_desk_chunk(uuid, uuid) to service_role;
