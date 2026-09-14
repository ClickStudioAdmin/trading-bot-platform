-- Airdrop payout files. Generate a list per chain, then mark the file paid.
create table public.membership_payout_files (
    id uuid primary key default gen_random_uuid(),
    network text not null,
    status text not null check (status in ('pending', 'paid')),
    amount_usd numeric(12, 2) not null check (amount_usd > 0),
    payout_count integer not null check (payout_count > 0),
    external_id text,
    created_at timestamptz not null default now(),
    paid_at timestamptz
);

create index membership_payout_files_created_idx
    on public.membership_payout_files (created_at desc);

alter table public.membership_payouts
    add column if not exists payout_file_id uuid
        references public.membership_payout_files (id) on delete restrict;

create index if not exists membership_payouts_file_idx
    on public.membership_payouts (payout_file_id)
    where payout_file_id is not null;

alter table public.membership_payouts
    drop constraint if exists membership_payouts_status_check;

alter table public.membership_payouts
    add constraint membership_payouts_status_check
    check (status in ('requested', 'approved', 'pending', 'rejected', 'paid'));

alter table public.membership_payout_files enable row level security;

revoke all on table public.membership_payout_files from anon, authenticated;
