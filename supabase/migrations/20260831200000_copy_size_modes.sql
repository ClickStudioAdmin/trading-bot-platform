-- Follower book for copy sizing: real balance, % sleeve, or dummy USDT book.

alter table public.desk_copy_settings
    add column size_mode text not null default 'balance';

alter table public.desk_copy_settings
    add constraint desk_copy_settings_size_mode_check
        check (size_mode in ('balance', 'percent', 'fixed'));

alter table public.desk_copy_settings
    add column size_percent numeric;

alter table public.desk_copy_settings
    add constraint desk_copy_settings_size_percent_check
        check (size_percent is null or (size_percent > 0 and size_percent <= 100));

alter table public.desk_copy_settings
    add column size_book_usdt numeric;

alter table public.desk_copy_settings
    add constraint desk_copy_settings_size_book_check
        check (size_book_usdt is null or size_book_usdt > 0);

alter table public.desk_copy_settings
    add constraint desk_copy_settings_size_fields_check
        check (
            (
                size_mode = 'balance'
                and size_percent is null
                and size_book_usdt is null
            )
            or (
                size_mode = 'percent'
                and size_percent is not null
                and size_book_usdt is null
            )
            or (
                size_mode = 'fixed'
                and size_book_usdt is not null
                and size_percent is null
            )
        );
