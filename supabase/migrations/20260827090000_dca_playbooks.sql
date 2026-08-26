-- Phase 11: stacked DCA playbooks. One per desk contract+side. Runtime state lives on the same row.

create table public.dca_playbooks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    account_id uuid not null references public.trading_accounts (id) on delete cascade,
    name text not null default 'DCA'
        check (char_length(trim(name)) between 1 and 40),
    symbol text not null check (
        char_length(symbol) between 4 and 32
        and symbol ~ '^[A-Z0-9]+$'
    ),
    side text not null check (side in ('long', 'short')),
    clip_size numeric not null check (clip_size > 0),
    size_unit text not null default 'qty'
        check (size_unit in ('qty', 'usdt')),
    max_clips integer check (max_clips is null or max_clips > 0),
    max_value numeric check (max_value is null or max_value > 0),
    dip_pct numeric check (dip_pct is null or dip_pct > 0),
    interval_minutes integer check (interval_minutes is null or interval_minutes > 0),
    take_profit_pct numeric check (take_profit_pct is null or take_profit_pct > 0),
    stop_loss_pct numeric check (stop_loss_pct is null or stop_loss_pct > 0),
    arm_trigger_by text check (
        arm_trigger_by is null
        or arm_trigger_by in ('last', 'mark', 'index')
    ),
    arm_compare text check (
        arm_compare is null
        or arm_compare in ('gte', 'lte')
    ),
    arm_price numeric check (arm_price is null or arm_price > 0),
    arm_condition_true boolean not null default false,
    disarm_trigger_by text check (
        disarm_trigger_by is null
        or disarm_trigger_by in ('last', 'mark', 'index')
    ),
    disarm_compare text check (
        disarm_compare is null
        or disarm_compare in ('gte', 'lte')
    ),
    disarm_price numeric check (disarm_price is null or disarm_price > 0),
    disarm_condition_true boolean not null default false,
    status text not null default 'idle'
        check (status in ('idle', 'armed', 'stop_adding')),
    clips_filled integer not null default 0 check (clips_filled >= 0),
    last_clip_price numeric check (last_clip_price is null or last_clip_price > 0),
    last_clip_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (account_id, symbol, side),
    check (
        (arm_price is null and arm_trigger_by is null and arm_compare is null)
        or (
            arm_price is not null
            and arm_trigger_by is not null
            and arm_compare is not null
        )
    ),
    check (
        (disarm_price is null and disarm_trigger_by is null and disarm_compare is null)
        or (
            disarm_price is not null
            and disarm_trigger_by is not null
            and disarm_compare is not null
        )
    )
);

create index dca_playbooks_status_idx
    on public.dca_playbooks (status);

create or replace function public.dca_playbooks_match_account_user()
returns trigger
language plpgsql
as $$
declare
    account_user uuid;
begin
    select user_id into account_user
    from public.trading_accounts
    where id = new.account_id;
    if account_user is null then
        raise exception 'trading account not found';
    end if;
    if account_user is distinct from new.user_id then
        raise exception 'dca playbook user must match the account';
    end if;
    return new;
end;
$$;

create trigger dca_playbooks_match_account_user
    before insert or update on public.dca_playbooks
    for each row
    execute procedure public.dca_playbooks_match_account_user();

alter table public.dca_playbooks enable row level security;

create policy dca_playbooks_select_own
    on public.dca_playbooks
    for select
    to authenticated
    using (user_id = auth.uid());

revoke all on table public.dca_playbooks from anon, authenticated;
grant select on table public.dca_playbooks to authenticated;
