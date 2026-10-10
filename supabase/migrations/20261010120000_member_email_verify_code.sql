-- Signup confirmation can use the link or a 6-digit code on /account/verify.
-- code_hash is SHA-256 of the code. The raw code is never stored.
-- Five wrong codes lock further guesses. The link on that row still works.

alter table public.member_email_tokens
    add column if not exists code_hash text;

alter table public.member_email_tokens
    add column if not exists code_attempts integer not null default 0;

alter table public.member_email_tokens
    add constraint member_email_tokens_code_attempts_nonneg
    check (code_attempts >= 0);
