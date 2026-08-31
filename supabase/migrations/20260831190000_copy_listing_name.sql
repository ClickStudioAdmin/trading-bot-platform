-- Catalogue desk name on share listings.

alter table public.desk_copy_listings
    add column name text;

update public.desk_copy_listings as listings
set name = desks.name
from public.trading_accounts as desks
where desks.id = listings.account_id
    and (listings.name is null or btrim(listings.name) = '');

alter table public.desk_copy_listings
    alter column name set default 'Desk';

update public.desk_copy_listings
set name = 'Desk'
where name is null or btrim(name) = '';

alter table public.desk_copy_listings
    alter column name set not null;

alter table public.desk_copy_listings
    add constraint desk_copy_listings_name_len
        check (char_length(trim(name)) between 1 and 40);
