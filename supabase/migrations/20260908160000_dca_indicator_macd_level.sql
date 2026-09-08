-- MACD histogram level may be 0 or negative (RSI / legacy EMA stay positive in the form).

alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_indicator_level_check;
alter table public.dca_playbooks
    drop constraint if exists dca_playbooks_short_indicator_level_check;
