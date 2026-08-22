-- Phase 4: per-user paper execution rules, and source on paper carries.

alter table public.paper_carries
    add column source text not null default 'manual'
    check (source in ('manual', 'engine'));

create table public.paper_rules (
    user_id uuid primary key references auth.users (id) on delete cascade,
    enabled boolean not null default false,
    notional_usdt numeric not null default 10000 check (notional_usdt > 0),
    min_net_apr numeric,
    min_dte numeric,
    max_dte numeric,
    min_capacity_usdt numeric,
    max_open_count integer check (max_open_count is null or max_open_count > 0),
    max_open_notional_usdt numeric check (
        max_open_notional_usdt is null
        or max_open_notional_usdt > 0
    ),
    close_max_dte numeric,
    close_min_net_apr numeric,
    take_profit_pct numeric,
    stop_loss_pct numeric,
    updated_at timestamptz not null default now(),
    check (
        min_dte is null
        or max_dte is null
        or min_dte <= max_dte
    )
);

alter table public.paper_rules enable row level security;

create policy paper_rules_select_own
    on public.paper_rules
    for select
    to authenticated
    using (user_id = auth.uid());

create policy paper_rules_insert_own
    on public.paper_rules
    for insert
    to authenticated
    with check (user_id = auth.uid());

create policy paper_rules_update_own
    on public.paper_rules
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

grant select, insert, update on table public.paper_rules to authenticated;
