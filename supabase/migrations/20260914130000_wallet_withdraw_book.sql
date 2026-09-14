-- Main Wallet USDT withdraws share the payout queue, tagged by book.
alter table public.membership_payouts
    add column if not exists book text not null default 'affiliate';

alter table public.membership_payouts
    drop constraint if exists membership_payouts_book_check;

alter table public.membership_payouts
    add constraint membership_payouts_book_check
    check (book in ('main', 'affiliate'));

create index if not exists membership_payouts_book_status_idx
    on public.membership_payouts (book, status, created_at desc);

alter table public.membership_payout_files
    add column if not exists book text not null default 'affiliate';

alter table public.membership_payout_files
    drop constraint if exists membership_payout_files_book_check;

alter table public.membership_payout_files
    add constraint membership_payout_files_book_check
    check (book in ('main', 'affiliate'));

create index if not exists membership_payout_files_book_idx
    on public.membership_payout_files (book, created_at desc);
