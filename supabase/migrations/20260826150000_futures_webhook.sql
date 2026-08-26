-- Phase 9: TradingView webhook token on the Futures bind row.
-- Path token is the secret. Hash is for lookup. Ciphertext is for Settings display.

alter table public.strategy_settings
    add column webhook_token_hash text,
    add column webhook_token_ciphertext bytea,
    add column webhook_token_nonce bytea;

alter table public.strategy_settings
    add constraint strategy_settings_webhook_token_complete check (
        (
            webhook_token_hash is null
            and webhook_token_ciphertext is null
            and webhook_token_nonce is null
        )
        or (
            webhook_token_hash is not null
            and char_length(webhook_token_hash) = 64
            and webhook_token_hash ~ '^[0-9a-f]+$'
            and webhook_token_ciphertext is not null
            and webhook_token_nonce is not null
        )
    );

create unique index strategy_settings_webhook_token_hash_idx
    on public.strategy_settings (webhook_token_hash)
    where webhook_token_hash is not null;
