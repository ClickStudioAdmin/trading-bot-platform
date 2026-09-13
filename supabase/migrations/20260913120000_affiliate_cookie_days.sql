alter table public.platform_settings
    add column if not exists affiliate_cookie_days integer not null default 30;

alter table public.platform_settings
    drop constraint if exists platform_settings_affiliate_cookie_days_check;

alter table public.platform_settings
    add constraint platform_settings_affiliate_cookie_days_check
    check (affiliate_cookie_days between 1 and 3650);
