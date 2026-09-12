-- Dedicated gas wallet for deposit-address drips (not the admin payout wallet).

alter table public.platform_settings
    add column if not exists billing_gas_ciphertext bytea,
    add column if not exists billing_gas_nonce bytea,
    add column if not exists billing_gas_address text
        check (
            billing_gas_address is null
            or billing_gas_address ~ '^0x[0-9a-f]{40}$'
        ),
    add column if not exists billing_gas_created_at timestamptz;
