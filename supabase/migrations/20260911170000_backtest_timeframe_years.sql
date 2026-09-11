-- Backtest range cap is years, not bar count.

update public.membership_plans
set
    caps = (caps - 'max_backtest_bars') || jsonb_build_object(
        'max_backtest_years',
        caps->'max_backtest_bars'
    ),
    updated_at = now();
