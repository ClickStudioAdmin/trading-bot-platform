-- Cash and Carry bots insert into paper_rules. That table was renamed from
-- paper_rule_layers, so Postgres kept the Auth foreign key name
-- paper_rule_layers_user_id_fkey. The drop in
-- 20260822220000_members_password_no_auth_fk.sql looked for
-- paper_rules_user_id_fkey and left this one in place. Logins are members,
-- not Auth users, so every Cash and Carry save was rejected.

alter table public.paper_rules
    drop constraint if exists paper_rule_layers_user_id_fkey;

alter table public.paper_rules
    drop constraint if exists paper_rules_user_id_fkey;

alter table public.paper_engine_settings
    drop constraint if exists paper_engine_settings_user_id_fkey;
