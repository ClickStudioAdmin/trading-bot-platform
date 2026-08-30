-- Backtested template visibility and paper-only replay runs.
-- Never writes futures_orders or live blotters.

alter table public.automation_templates
    drop constraint if exists automation_templates_visibility_check;

alter table public.automation_templates
    drop constraint if exists automation_templates_check;

alter table public.automation_templates
    add constraint automation_templates_visibility_check
    check (visibility in ('user', 'platform', 'backtested'));

alter table public.automation_templates
    add constraint automation_templates_owner_check
    check (
        (visibility = 'platform' and user_id is null)
        or (visibility = 'user' and user_id is not null)
        or (visibility = 'backtested')
    );

create unique index if not exists automation_templates_user_backtested_name_idx
    on public.automation_templates (user_id, lower(name), desk_type)
    where visibility = 'backtested' and user_id is not null;

create unique index if not exists automation_templates_platform_backtested_name_idx
    on public.automation_templates (lower(name), desk_type)
    where visibility = 'backtested' and user_id is null;

drop policy if exists automation_templates_select_visible on public.automation_templates;

create policy automation_templates_select_visible
    on public.automation_templates
    for select
    to authenticated
    using (
        visibility = 'platform'
        or user_id = auth.uid()
        or (visibility = 'backtested' and user_id is null)
    );

create table public.backtest_runs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.members (user_id) on delete cascade,
    template_id uuid references public.automation_templates (id) on delete set null,
    desk_type text not null
        check (desk_type = 'perps'),
    venue text not null,
    venue_environment text,
    symbol text not null,
    interval text not null,
    from_ms bigint not null
        check (from_ms > 0),
    to_ms bigint not null
        check (to_ms > from_ms),
    fee_preset text not null
        check (fee_preset = 'vip0_taker'),
    fee_rate numeric not null
        check (fee_rate >= 0),
    status text not null
        check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),
    recipe jsonb not null
        check (jsonb_typeof(recipe) = 'object'),
    stats jsonb,
    orders jsonb not null default '[]'::jsonb
        check (jsonb_typeof(orders) = 'array'),
    error text,
    created_at timestamptz not null default now(),
    finished_at timestamptz
);

create index backtest_runs_user_idx
    on public.backtest_runs (user_id, created_at desc);

create index backtest_runs_template_idx
    on public.backtest_runs (template_id, created_at desc);

alter table public.backtest_runs enable row level security;

create policy backtest_runs_select_visible
    on public.backtest_runs
    for select
    to authenticated
    using (
        user_id = auth.uid()
        or user_id is null
    );

revoke all on table public.backtest_runs from anon, authenticated;
grant select on table public.backtest_runs to authenticated;
