-- Public URL for the platform logo used in outbound mail.
alter table public.platform_settings
    add column if not exists platform_logo_url text;

alter table public.platform_settings
    drop constraint if exists platform_settings_platform_logo_url_len;

alter table public.platform_settings
    add constraint platform_settings_platform_logo_url_len
    check (
        platform_logo_url is null
        or char_length(btrim(platform_logo_url)) between 8 and 500
    );
