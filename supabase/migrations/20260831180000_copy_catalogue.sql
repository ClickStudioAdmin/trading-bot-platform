-- Copy catalogue (step 6). Favorites, desk stats snapshots, tighter listing select.

create table public.desk_copy_favorites (
    user_id uuid not null references public.members (user_id) on delete cascade,
    account_id uuid not null
        references public.trading_accounts (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, account_id)
);

create index desk_copy_favorites_account_idx
    on public.desk_copy_favorites (account_id);

create table public.futures_desk_stats (
    account_id uuid primary key
        references public.trading_accounts (id) on delete cascade,
    realized_usdt numeric not null default 0,
    realized_pct numeric,
    closed_count integer not null default 0 check (closed_count >= 0),
    win_count integer not null default 0 check (win_count >= 0),
    max_drawdown_usdt numeric not null default 0,
    max_drawdown_pct numeric,
    realized_usdt_30d numeric not null default 0,
    realized_pct_30d numeric,
    closed_count_30d integer not null default 0 check (closed_count_30d >= 0),
    win_count_30d integer not null default 0 check (win_count_30d >= 0),
    max_drawdown_usdt_30d numeric not null default 0,
    max_drawdown_pct_30d numeric,
    updated_at timestamptz not null default now()
);

alter table public.desk_copy_favorites enable row level security;
alter table public.futures_desk_stats enable row level security;

drop policy if exists desk_copy_listings_select on public.desk_copy_listings;

create policy desk_copy_listings_select
    on public.desk_copy_listings
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.trading_accounts as desks
            where desks.id = desk_copy_listings.account_id
                and desks.user_id = auth.uid()
        )
        or (
            visibility = 'public'
            and sharing_enabled
        )
        or exists (
            select 1
            from public.desk_copy_shares as shares
            where shares.parent_account_id = desk_copy_listings.account_id
                and shares.to_user_id = auth.uid()
                and shares.status in ('invited', 'active')
        )
    );

create policy desk_copy_favorites_select_own
    on public.desk_copy_favorites
    for select
    to authenticated
    using (user_id = auth.uid());

create policy futures_desk_stats_select
    on public.futures_desk_stats
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.trading_accounts as desks
            where desks.id = futures_desk_stats.account_id
                and desks.user_id = auth.uid()
        )
        or exists (
            select 1
            from public.desk_copy_listings as listings
            where listings.account_id = futures_desk_stats.account_id
                and listings.visibility = 'public'
                and listings.sharing_enabled
        )
        or exists (
            select 1
            from public.desk_copy_shares as shares
            where shares.parent_account_id = futures_desk_stats.account_id
                and shares.to_user_id = auth.uid()
                and shares.status in ('invited', 'active')
        )
    );

revoke all on table public.desk_copy_favorites from anon, authenticated;
revoke all on table public.futures_desk_stats from anon, authenticated;
grant select on table public.desk_copy_favorites to authenticated;
grant select on table public.futures_desk_stats to authenticated;
