-- Membership credit wallets (roadmap 5, step 5).
-- Two USD books, unique EVM deposit addresses, chain/token catalog.

alter table public.membership_wallet_entries
    add column if not exists book text not null default 'main',
    add column if not exists transfer_id uuid;

alter table public.membership_wallet_entries
    drop constraint if exists membership_wallet_entries_book_check;

alter table public.membership_wallet_entries
    add constraint membership_wallet_entries_book_check
    check (book in ('main', 'affiliate'));

alter table public.membership_wallet_entries
    drop constraint if exists membership_wallet_entries_kind_check;

alter table public.membership_wallet_entries
    add constraint membership_wallet_entries_kind_check
    check (kind in (
        'deposit',
        'debit_rent',
        'commission',
        'withdraw',
        'adjust',
        'transfer_in',
        'transfer_out'
    ));

update public.membership_wallet_entries
set book = 'affiliate'
where kind = 'commission'
  and book <> 'affiliate';

create index if not exists membership_wallet_user_book_idx
    on public.membership_wallet_entries (user_id, book, created_at);

create index if not exists membership_wallet_transfer_idx
    on public.membership_wallet_entries (transfer_id)
    where transfer_id is not null;

alter table public.platform_settings
    add column if not exists billing_hd_ciphertext bytea,
    add column if not exists billing_hd_nonce bytea,
    add column if not exists billing_hd_created_at timestamptz;

create table if not exists public.membership_billing_chains (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique
        check (char_length(trim(slug)) between 2 and 40),
    name text not null
        check (char_length(trim(name)) between 2 and 80),
    chain_id integer not null
        check (chain_id > 0),
    rpc_url text not null
        check (char_length(trim(rpc_url)) between 8 and 300),
    explorer_url text
        check (explorer_url is null or char_length(trim(explorer_url)) between 8 and 200),
    environment text not null
        check (environment in ('development', 'production')),
    confirmations integer not null default 3
        check (confirmations >= 1 and confirmations <= 128),
    admin_address text
        check (
            admin_address is null
            or admin_address ~ '^0x[0-9a-fA-F]{40}$'
        ),
    last_scanned_block bigint
        check (last_scanned_block is null or last_scanned_block >= 0),
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

create unique index if not exists membership_billing_chains_env_chain_uidx
    on public.membership_billing_chains (environment, chain_id);

create table if not exists public.membership_billing_tokens (
    id uuid primary key default gen_random_uuid(),
    chain_id uuid not null
        references public.membership_billing_chains (id) on delete cascade,
    symbol text not null
        check (char_length(trim(symbol)) between 1 and 16),
    contract_address text not null
        check (contract_address ~ '^0x[0-9a-fA-F]{40}$'),
    decimals integer not null
        check (decimals >= 0 and decimals <= 36),
    kind text not null
        check (kind in ('stable', 'native', 'wbtc', 'other')),
    created_at timestamptz not null default now()
);

create unique index if not exists membership_billing_tokens_contract_uidx
    on public.membership_billing_tokens (chain_id, lower(contract_address));

create table if not exists public.membership_deposit_addresses (
    user_id uuid primary key
        references public.members (user_id) on delete restrict,
    address text not null unique
        check (address ~ '^0x[0-9a-f]{40}$'),
    derivation_index integer not null unique
        check (derivation_index >= 0),
    created_at timestamptz not null default now()
);

create table if not exists public.membership_deposit_txs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null
        references public.members (user_id) on delete restrict,
    chain_id uuid not null
        references public.membership_billing_chains (id) on delete restrict,
    token_id uuid not null
        references public.membership_billing_tokens (id) on delete restrict,
    tx_hash text not null
        check (tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
    log_index integer not null
        check (log_index >= 0),
    from_address text
        check (
            from_address is null
            or from_address ~ '^0x[0-9a-f]{40}$'
        ),
    to_address text not null
        check (to_address ~ '^0x[0-9a-f]{40}$'),
    token_amount numeric not null
        check (token_amount > 0),
    amount_usd numeric(12, 2) not null
        check (amount_usd >= 0.01),
    block_number bigint not null
        check (block_number >= 0),
    credited_entry_id uuid
        references public.membership_wallet_entries (id) on delete restrict,
    sweep_tx_hash text
        check (
            sweep_tx_hash is null
            or sweep_tx_hash ~ '^0x[0-9a-fA-F]{64}$'
        ),
    created_at timestamptz not null default now(),
    unique (chain_id, tx_hash, log_index)
);

create index if not exists membership_deposit_txs_user_idx
    on public.membership_deposit_txs (user_id, created_at desc);

alter table public.membership_billing_chains enable row level security;
alter table public.membership_billing_tokens enable row level security;
alter table public.membership_deposit_addresses enable row level security;
alter table public.membership_deposit_txs enable row level security;

revoke all on table public.membership_billing_chains from anon, authenticated;
revoke all on table public.membership_billing_tokens from anon, authenticated;
revoke all on table public.membership_deposit_addresses from anon, authenticated;
revoke all on table public.membership_deposit_txs from anon, authenticated;

insert into public.membership_billing_chains (
    slug,
    name,
    chain_id,
    rpc_url,
    explorer_url,
    environment,
    confirmations,
    sort_order
)
values (
    'arbitrum-sepolia',
    'Arbitrum Sepolia',
    421614,
    'https://sepolia-rollup.arbitrum.io/rpc',
    'https://sepolia.arbiscan.io',
    'development',
    3,
    10
)
on conflict (slug) do nothing;

insert into public.membership_billing_tokens (
    chain_id,
    symbol,
    contract_address,
    decimals,
    kind
)
select
    c.id,
    'USDT',
    '0xf3118a17863996B9F2A073c9A66Faaa664355cf8',
    6,
    'stable'
from public.membership_billing_chains c
where c.slug = 'arbitrum-sepolia'
  and not exists (
      select 1
      from public.membership_billing_tokens t
      where t.chain_id = c.id
        and lower(t.contract_address) = lower('0xf3118a17863996B9F2A073c9A66Faaa664355cf8')
  );

create or replace function public.credit_membership_deposit(
    p_user_id uuid,
    p_chain_id uuid,
    p_token_id uuid,
    p_tx_hash text,
    p_log_index integer,
    p_from_address text,
    p_to_address text,
    p_token_amount numeric,
    p_amount_usd numeric,
    p_block_number bigint
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_existing public.membership_deposit_txs%rowtype;
    v_entry_id uuid;
    v_tx_id uuid;
begin
    select *
    into v_existing
    from public.membership_deposit_txs
    where chain_id = p_chain_id
      and lower(tx_hash) = lower(p_tx_hash)
      and log_index = p_log_index;

    if found then
        return v_existing.credited_entry_id;
    end if;

    insert into public.membership_wallet_entries (
        user_id,
        book,
        kind,
        amount_usd,
        external_id,
        memo
    )
    values (
        p_user_id,
        'main',
        'deposit',
        p_amount_usd,
        lower(p_tx_hash) || ':' || p_log_index::text,
        'On-chain deposit'
    )
    returning id into v_entry_id;

    insert into public.membership_deposit_txs (
        user_id,
        chain_id,
        token_id,
        tx_hash,
        log_index,
        from_address,
        to_address,
        token_amount,
        amount_usd,
        block_number,
        credited_entry_id
    )
    values (
        p_user_id,
        p_chain_id,
        p_token_id,
        lower(p_tx_hash),
        p_log_index,
        p_from_address,
        p_to_address,
        p_token_amount,
        p_amount_usd,
        p_block_number,
        v_entry_id
    )
    returning id into v_tx_id;

    return v_entry_id;
exception
    when unique_violation then
        select credited_entry_id
        into v_entry_id
        from public.membership_deposit_txs
        where chain_id = p_chain_id
          and lower(tx_hash) = lower(p_tx_hash)
          and log_index = p_log_index;
        return v_entry_id;
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

revoke all on function public.credit_membership_deposit(
    uuid, uuid, uuid, text, integer, text, text, numeric, numeric, bigint
) from public, anon, authenticated;

revoke all on function public.pay_membership_from_wallet(
    uuid, uuid, numeric, numeric, timestamptz, timestamptz, text, boolean
) from public, anon, authenticated;
