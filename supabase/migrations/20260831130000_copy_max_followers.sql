-- Copy trading: max followers on a listing, plus an admin default for new shares.

alter table public.platform_settings
    add column copy_max_followers_default integer
        check (
            copy_max_followers_default is null
            or copy_max_followers_default >= 1
        );

alter table public.desk_copy_listings
    add column max_followers integer
        check (max_followers is null or max_followers >= 1);
