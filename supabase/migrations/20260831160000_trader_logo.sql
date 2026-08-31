-- Optional trader logo on the login profile. Files live in Storage.

alter table public.trader_profiles
    add column logo_path text
        check (
            logo_path is null
            or logo_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/logo\.(png|jpg|webp)$'
        );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'trader-logos',
    'trader-logos',
    true,
    1048576,
    array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy trader_logos_public_read
    on storage.objects
    for select
    using (bucket_id = 'trader-logos');
