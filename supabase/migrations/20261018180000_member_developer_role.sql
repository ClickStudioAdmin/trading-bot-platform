-- Developer is a member role. Developers are not admins.
-- They can see In Development and Testing exchanges. Members cannot.

alter table public.members
    drop constraint if exists members_role_check;

alter table public.members
    add constraint members_role_check
    check (role in ('member', 'developer', 'admin'));
