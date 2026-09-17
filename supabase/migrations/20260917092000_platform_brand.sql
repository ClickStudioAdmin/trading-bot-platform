-- Admin Settings → General: platform name and uploaded logo.

alter table public.platform_settings
    add column if not exists platform_name text not null
        default 'Trading Bot Platform';

alter table public.platform_settings
    drop constraint if exists platform_settings_platform_name_len;

alter table public.platform_settings
    add constraint platform_settings_platform_name_len
    check (
        char_length(btrim(platform_name)) between 1 and 80
        and platform_name !~ '[<>:]'
    );

alter table public.platform_settings
    add column if not exists platform_logo_path text;

alter table public.platform_settings
    drop constraint if exists platform_settings_platform_logo_path;

alter table public.platform_settings
    add constraint platform_settings_platform_logo_path
    check (
        platform_logo_path is null
        or platform_logo_path ~ '^tbp/logo\.(png|jpg|webp)$'
    );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'platform-logos',
    'platform-logos',
    true,
    1048576,
    array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists platform_logos_public_read on storage.objects;
create policy platform_logos_public_read
    on storage.objects
    for select
    using (bucket_id = 'platform-logos');
