-- Applied after 20261017130000. The first copy used 20261016130000, which
-- sorts before migrations already on the development database, so db push stopped.
-- Direction Both stores the short exit leg's take profit, trailing stop,
-- and stop loss apart from the long columns. Null keeps the old shared value.
alter table dca_playbooks
  add column if not exists short_classic jsonb;

comment on column dca_playbooks.short_classic is
  'Short exit take profit, trailing stop, and stop loss. Null shares the long columns.';
