-- One row each time a backtest is queued. Deleting the run does not
-- return the monthly slot. Drafts are not rows here.

create table public.backtest_queue_uses (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.members (user_id) on delete cascade,
    run_id uuid,
    queued_at timestamptz not null default now()
);

create index backtest_queue_uses_user_queued_idx
    on public.backtest_queue_uses (user_id, queued_at desc);

insert into public.backtest_queue_uses (user_id, run_id, queued_at)
select user_id, id, created_at
from public.backtest_runs
where user_id is not null
  and status <> 'draft';

alter table public.backtest_queue_uses enable row level security;

revoke all on table public.backtest_queue_uses from anon, authenticated;
