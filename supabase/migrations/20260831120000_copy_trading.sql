-- Copy trading (roadmap 3, step 2). Schema only. No UI share/create yet.

create table public.platform_settings (
    id text primary key check (id = 'tbp'),
    copy_min_activity_days integer not null default 90
        check (copy_min_activity_days >= 0),
    updated_at timestamptz not null default now()
);

insert into public.platform_settings (id, copy_min_activity_days)
values ('tbp', 90);

alter table public.platform_settings enable row level security;

create policy platform_settings_select
    on public.platform_settings
    for select
    to authenticated
    using (true);

revoke all on table public.platform_settings from anon, authenticated;
grant select on table public.platform_settings to authenticated;

create table public.trader_profiles (
    user_id uuid primary key references public.members (user_id) on delete cascade,
    alias text not null check (char_length(trim(alias)) between 2 and 32),
    bio text check (
        bio is null or char_length(trim(bio)) between 1 and 280
    ),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index trader_profiles_alias_lower_idx
    on public.trader_profiles (lower(alias));

alter table public.trading_accounts
    add column copy_of_account_id uuid
        references public.trading_accounts (id) on delete restrict;

alter table public.trading_accounts
    add constraint trading_accounts_copy_of_not_self
        check (copy_of_account_id is distinct from id);

create index trading_accounts_copy_of_idx
    on public.trading_accounts (copy_of_account_id)
    where copy_of_account_id is not null;

create or replace function public.trading_accounts_copy_of_guard()
returns trigger
language plpgsql
as $$
declare
    parent public.trading_accounts%rowtype;
begin
    if tg_op = 'UPDATE'
        and old.copy_of_account_id is not null
        and new.copy_of_account_id is distinct from old.copy_of_account_id
    then
        raise exception 'copy source cannot change';
    end if;
    if new.copy_of_account_id is null then
        return new;
    end if;
    select * into parent
    from public.trading_accounts
    where id = new.copy_of_account_id;
    if parent.id is null then
        raise exception 'copy source desk was not found';
    end if;
    if parent.copy_of_account_id is not null then
        raise exception 'cannot copy a copy desk';
    end if;
    if parent.mode is distinct from 'live' then
        raise exception 'copy source must be a connected desk';
    end if;
    if parent.desk_type is distinct from new.desk_type then
        raise exception 'copy desk type must match the source';
    end if;
    if parent.venue is distinct from new.venue then
        raise exception 'copy desk venue must match the source';
    end if;
    if new.mode = 'live'
        and parent.venue_environment is distinct from new.venue_environment
    then
        raise exception 'copy desk environment must match the source';
    end if;
    return new;
end;
$$;

create trigger trading_accounts_copy_of_guard
    before insert or update on public.trading_accounts
    for each row
    execute procedure public.trading_accounts_copy_of_guard();

create table public.desk_copy_listings (
    account_id uuid primary key
        references public.trading_accounts (id) on delete cascade,
    visibility text not null check (visibility in ('private', 'public')),
    description text not null
        check (char_length(trim(description)) between 1 and 2000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index desk_copy_listings_public_idx
    on public.desk_copy_listings (created_at desc)
    where visibility = 'public';

create or replace function public.desk_copy_listing_guard()
returns trigger
language plpgsql
as $$
declare
    desk public.trading_accounts%rowtype;
begin
    select * into desk
    from public.trading_accounts
    where id = new.account_id;
    if desk.id is null then
        raise exception 'listing is missing a desk';
    end if;
    if desk.mode is distinct from 'live' then
        raise exception 'only connected desks can be shared';
    end if;
    if desk.copy_of_account_id is not null then
        raise exception 'a copy desk cannot be shared';
    end if;
    if desk.desk_type = 'cash_and_carry' then
        raise exception 'cash and carry desks cannot be shared';
    end if;
    return new;
end;
$$;

create trigger desk_copy_listing_guard
    before insert or update on public.desk_copy_listings
    for each row
    execute procedure public.desk_copy_listing_guard();

create table public.desk_copy_shares (
    id uuid primary key default gen_random_uuid(),
    parent_account_id uuid not null
        references public.desk_copy_listings (account_id) on delete cascade,
    from_user_id uuid not null
        references public.members (user_id) on delete cascade,
    to_user_id uuid not null
        references public.members (user_id) on delete cascade,
    invited_email text not null,
    status text not null check (status in ('invited', 'active', 'revoked')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (parent_account_id, to_user_id),
    check (from_user_id <> to_user_id)
);

create index desk_copy_shares_to_idx
    on public.desk_copy_shares (to_user_id, status);

create index desk_copy_shares_parent_idx
    on public.desk_copy_shares (parent_account_id, status);

create table public.desk_copy_settings (
    account_id uuid primary key
        references public.trading_accounts (id) on delete cascade,
    scale numeric not null default 0.1
        check (scale > 0 and scale <= 1),
    paused boolean not null default false,
    max_daily_loss_usdt numeric
        check (max_daily_loss_usdt is null or max_daily_loss_usdt > 0),
    max_open_notional_usdt numeric
        check (max_open_notional_usdt is null or max_open_notional_usdt > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.desk_copy_settings_guard()
returns trigger
language plpgsql
as $$
declare
    source uuid;
begin
    select copy_of_account_id into source
    from public.trading_accounts
    where id = new.account_id;
    if source is null then
        raise exception 'copy settings belong on a copy desk';
    end if;
    return new;
end;
$$;

create trigger desk_copy_settings_guard
    before insert or update on public.desk_copy_settings
    for each row
    execute procedure public.desk_copy_settings_guard();

create table public.desk_copy_receipts (
    id uuid primary key default gen_random_uuid(),
    follower_account_id uuid not null
        references public.trading_accounts (id) on delete cascade,
    parent_fill_id text not null
        check (char_length(trim(parent_fill_id)) between 1 and 80),
    created_at timestamptz not null default now(),
    unique (follower_account_id, parent_fill_id)
);

create index desk_copy_receipts_follower_idx
    on public.desk_copy_receipts (follower_account_id, created_at desc);

alter table public.trader_profiles enable row level security;
alter table public.desk_copy_listings enable row level security;
alter table public.desk_copy_shares enable row level security;
alter table public.desk_copy_settings enable row level security;
alter table public.desk_copy_receipts enable row level security;

create policy trader_profiles_select
    on public.trader_profiles
    for select
    to authenticated
    using (
        user_id = auth.uid()
        or exists (
            select 1
            from public.desk_copy_listings as listings
            join public.trading_accounts as desks
                on desks.id = listings.account_id
            where desks.user_id = trader_profiles.user_id
                and listings.visibility = 'public'
        )
        or exists (
            select 1
            from public.desk_copy_shares as shares
            join public.trading_accounts as desks
                on desks.id = shares.parent_account_id
            where desks.user_id = trader_profiles.user_id
                and shares.to_user_id = auth.uid()
                and shares.status in ('invited', 'active')
        )
    );

create policy desk_copy_listings_select
    on public.desk_copy_listings
    for select
    to authenticated
    using (
        visibility = 'public'
        or exists (
            select 1
            from public.trading_accounts as desks
            where desks.id = desk_copy_listings.account_id
                and desks.user_id = auth.uid()
        )
        or exists (
            select 1
            from public.desk_copy_shares as shares
            where shares.parent_account_id = desk_copy_listings.account_id
                and shares.to_user_id = auth.uid()
                and shares.status in ('invited', 'active')
        )
    );

create policy desk_copy_shares_select_own
    on public.desk_copy_shares
    for select
    to authenticated
    using (from_user_id = auth.uid() or to_user_id = auth.uid());

create policy desk_copy_settings_select_own
    on public.desk_copy_settings
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.trading_accounts as desks
            where desks.id = desk_copy_settings.account_id
                and desks.user_id = auth.uid()
        )
    );

create policy desk_copy_receipts_select_own
    on public.desk_copy_receipts
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.trading_accounts as desks
            where desks.id = desk_copy_receipts.follower_account_id
                and desks.user_id = auth.uid()
        )
    );

revoke all on table public.trader_profiles from anon, authenticated;
revoke all on table public.desk_copy_listings from anon, authenticated;
revoke all on table public.desk_copy_shares from anon, authenticated;
revoke all on table public.desk_copy_settings from anon, authenticated;
revoke all on table public.desk_copy_receipts from anon, authenticated;

grant select on table public.trader_profiles to authenticated;
grant select on table public.desk_copy_listings to authenticated;
grant select on table public.desk_copy_shares to authenticated;
grant select on table public.desk_copy_settings to authenticated;
grant select on table public.desk_copy_receipts to authenticated;
