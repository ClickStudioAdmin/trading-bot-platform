-- Follower drawdown kill switch and adverse-move skip on copied entries.

alter table public.desk_copy_settings
    add column max_drawdown_pct numeric;

alter table public.desk_copy_settings
    add constraint desk_copy_settings_max_drawdown_pct_check
        check (max_drawdown_pct is null or (max_drawdown_pct > 0 and max_drawdown_pct <= 100));

alter table public.desk_copy_settings
    add column max_adverse_move_pct numeric;

alter table public.desk_copy_settings
    add constraint desk_copy_settings_max_adverse_move_pct_check
        check (
            max_adverse_move_pct is null
            or (max_adverse_move_pct > 0 and max_adverse_move_pct <= 100)
        );

alter table public.desk_copy_settings
    add column equity_peak_usdt numeric;

alter table public.desk_copy_settings
    add constraint desk_copy_settings_equity_peak_check
        check (equity_peak_usdt is null or equity_peak_usdt > 0);
