-- Platform Tester is a member role. Testers are not admins.
-- They can see Testing exchanges, plus Beta and Live.
-- In Development stays hidden. Developers and admins still see it.

alter table public.members
    drop constraint if exists members_role_check;

alter table public.members
    add constraint members_role_check
    check (role in ('member', 'platform_tester', 'developer', 'admin'));
