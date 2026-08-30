-- Desk members are the only users. Drop Auth foreign keys and store a password hash.

alter table public.members
    add column if not exists password_hash text;

alter table public.members
    drop constraint if exists members_user_id_fkey;

alter table public.paper_carries
    drop constraint if exists paper_carries_user_id_fkey;

alter table public.paper_rules
    drop constraint if exists paper_rules_user_id_fkey;

alter table public.paper_engine_settings
    drop constraint if exists paper_engine_settings_user_id_fkey;

alter table public.app_admins
    drop constraint if exists app_admins_user_id_fkey;

alter table public.event_logs
    drop constraint if exists event_logs_user_id_fkey;
