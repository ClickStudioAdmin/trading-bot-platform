-- Replay positions start beside the chart. A saved Below Chart choice stays.

alter table public.replay_view_preferences
    alter column positions_right set default true;
