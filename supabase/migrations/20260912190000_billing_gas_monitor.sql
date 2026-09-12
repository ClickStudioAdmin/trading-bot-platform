-- Low-ETH watermark for the dedicated billing gas wallet (admin monitor).

alter table public.platform_settings
    add column if not exists billing_gas_low_eth numeric(20, 8) not null default 0.005
        check (billing_gas_low_eth > 0 and billing_gas_low_eth <= 10);
