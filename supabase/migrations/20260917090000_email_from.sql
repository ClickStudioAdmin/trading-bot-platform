-- Outbound From for Resend. Admin Settings can edit it. Must be on a verified domain.
alter table public.platform_settings
    add column if not exists email_from text not null
        default 'Trading Bot Platform <system@alphadesks.app>';

alter table public.platform_settings
    drop constraint if exists platform_settings_email_from_len;

alter table public.platform_settings
    add constraint platform_settings_email_from_len
    check (char_length(trim(email_from)) between 3 and 200);

update public.platform_settings
set email_from = 'Trading Bot Platform <system@alphadesks.app>'
where id = 'tbp'
  and (email_from is null or btrim(email_from) = '');
