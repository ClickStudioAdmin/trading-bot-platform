-- Platform ceiling for Maximum copy traders. Default only pre-fills; this caps.

alter table public.platform_settings
    add column copy_max_followers_ceiling integer
        check (
            copy_max_followers_ceiling is null
            or copy_max_followers_ceiling >= 1
        );
