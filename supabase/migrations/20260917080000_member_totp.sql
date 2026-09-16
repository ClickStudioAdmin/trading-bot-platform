-- Login TOTP (Google Authenticator). Secret encrypted at rest. Recovery
-- codes stored as hashes. Enabled only after the member confirms a code.

alter table public.members
    add column if not exists totp_secret_cipher bytea,
    add column if not exists totp_secret_nonce bytea,
    add column if not exists totp_enabled_at timestamptz,
    add column if not exists totp_recovery_hashes text[],
    add column if not exists totp_last_step bigint;
