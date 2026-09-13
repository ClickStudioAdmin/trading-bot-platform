-- Affiliate network display name. Separate from trader_profiles.alias (copy trading).
alter table public.members
    add column if not exists affiliate_alias text;

alter table public.members
    drop constraint if exists members_affiliate_alias_len;

alter table public.members
    add constraint members_affiliate_alias_len check (
        affiliate_alias is null
        or char_length(btrim(affiliate_alias)) between 2 and 32
    );

create unique index if not exists members_affiliate_alias_lower_idx
    on public.members (lower(affiliate_alias))
    where affiliate_alias is not null;
