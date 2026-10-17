-- Ticket desks were `perps`. Bot desks were `perps_bots`.
-- Templates, studies, and backtests stored the bot recipe as `perps`.
-- Rename the ticket to `manual` and the bot to `flex`.

alter table public.trading_accounts
    disable trigger trading_accounts_forbid_desk_type_change;

alter table public.trading_accounts
    drop constraint if exists trading_accounts_desk_type_check;

alter table public.automation_templates
    drop constraint if exists automation_templates_desk_type_check;

alter table public.automation_template_sets
    drop constraint if exists automation_template_sets_desk_type_check;

alter table public.backtest_runs
    drop constraint if exists backtest_runs_desk_type_check;

alter table public.backtest_studies
    drop constraint if exists backtest_studies_desk_type_check;

update public.automation_templates
set
    desk_type = 'flex',
    recipe = case
        when recipe->>'kind' = 'perps'
            then jsonb_set(recipe, '{kind}', '"flex"')
        else recipe
    end,
    updated_at = now()
where desk_type = 'perps'
    or recipe->>'kind' = 'perps';

update public.automation_template_sets
set
    desk_type = 'flex',
    updated_at = now()
where desk_type = 'perps';

update public.backtest_runs
set
    desk_type = 'flex',
    recipe = case
        when recipe->>'kind' = 'perps'
            then jsonb_set(recipe, '{kind}', '"flex"')
        else recipe
    end
where desk_type = 'perps'
    or recipe->>'kind' = 'perps';

update public.backtest_studies
set
    desk_type = 'flex',
    seed_recipe = case
        when seed_recipe->>'kind' = 'perps'
            then jsonb_set(seed_recipe, '{kind}', '"flex"')
        else seed_recipe
    end
where desk_type = 'perps'
    or seed_recipe->>'kind' = 'perps';

update public.trading_accounts
set desk_type = 'flex'
where desk_type = 'perps_bots';

update public.trading_accounts
set desk_type = 'manual'
where desk_type = 'perps';

update public.membership_plans
set
    features = (features - 'desk_perps_bots')
        || jsonb_build_object('desk_flex', features->'desk_perps_bots'),
    caps = case
        when caps ? 'max_desk_perps_bots'
            then (caps - 'max_desk_perps_bots')
                || jsonb_build_object('max_desk_flex', caps->'max_desk_perps_bots')
        else caps
    end,
    updated_at = now()
where features ? 'desk_perps_bots'
    or caps ? 'max_desk_perps_bots';

update public.membership_plans
set
    features = (features - 'desk_perps')
        || jsonb_build_object('desk_manual', features->'desk_perps'),
    caps = case
        when caps ? 'max_desk_perps'
            then (caps - 'max_desk_perps')
                || jsonb_build_object('max_desk_manual', caps->'max_desk_perps')
        else caps
    end,
    updated_at = now()
where features ? 'desk_perps'
    or caps ? 'max_desk_perps';

update public.member_onboarding
set draft = replace(draft::text, '"perps_bots"', '"flex"')::jsonb
where draft::text like '%"perps_bots"%';

update public.member_onboarding
set draft = replace(draft::text, '"perps"', '"manual"')::jsonb
where draft::text like '%"perps"%';

alter table public.trading_accounts
    add constraint trading_accounts_desk_type_check
        check (desk_type in (
            'cash_and_carry',
            'manual',
            'flex',
            'signal_follower',
            'dca'
        ));

alter table public.trading_accounts
    enable trigger trading_accounts_forbid_desk_type_change;

alter table public.automation_templates
    add constraint automation_templates_desk_type_check
        check (desk_type in ('dca', 'flex', 'cash_and_carry'));

alter table public.automation_template_sets
    add constraint automation_template_sets_desk_type_check
        check (desk_type in ('dca', 'flex', 'cash_and_carry'));

alter table public.backtest_runs
    add constraint backtest_runs_desk_type_check
        check (desk_type in ('flex', 'dca'));

alter table public.backtest_studies
    add constraint backtest_studies_desk_type_check
        check (desk_type in ('flex', 'dca'));
