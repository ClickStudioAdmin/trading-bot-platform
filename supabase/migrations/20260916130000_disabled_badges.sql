-- Platform kill switches for required-action badges, plus optional desk-test counts.

alter table public.platform_settings
    add column if not exists disabled_badges text[] not null default '{}';

alter table public.platform_settings
    add column if not exists demo_badge_counts jsonb not null default '{}';
