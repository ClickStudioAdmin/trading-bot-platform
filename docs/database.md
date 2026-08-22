# Database

GitHub migrations in `supabase/migrations/` are the source of truth. Do not edit hosted schemas by hand as the normal process.

Migrations are applied by GitHub Actions. Do not run `supabase db push` locally as the normal process.

Current tables:

| Table | Phase | Purpose |
| --- | --- | --- |
| `system_health` | 1 | Pipeline proof. One row: `TBP`. |
| `opportunities` | 2 | Latest scan per spot/future pair. Server upsert only. RLS on, no anon policies. |
| `paper_carries` | 3 | Paper blotter. RLS by `user_id`. Authenticated select/insert/update. No delete. Multiple open rows per pair are allowed. `source` is how it opened (`manual` or `engine`). `close_source` is how it closed. `close_reason` is the auto-exit that fired. Engine rows also store the entry snapshot and per-trade exits. |
| `paper_engine_settings` | 4 | Per-user engine on/off. RLS by `user_id`. |
| `paper_rules` | 4 | Stacked entry/exit layers. Many rows per user. RLS by `user_id`. Authenticated select/insert/update/delete. |
| `app_admins` | 4 | Admin allow-list. The desk admin email is hardcoded in `lib/admin/emails.ts` and upserted on sign-in. Users can select only their own row. |
| `event_logs` | 4 | Append-only system, strategy, and trade events. Authenticated select own or admin. Writes are service-role only. |
| `members` | 4 | Desk users. Email, password hash, role (`member` / `admin`), status. This is the only login table. Writes and reads for the app are service-role only, scoped by the session. |

Phase 4 rules migrations: `supabase/migrations/20260822160000_paper_rules.sql` then `supabase/migrations/20260822170000_paper_rule_layers.sql`.

Event logs and admins: `supabase/migrations/20260822180000_event_logs_and_admins.sql`.

Members: `supabase/migrations/20260822190000_members.sql`. Password and no Auth FK: `supabase/migrations/20260822220000_members_password_no_auth_fk.sql`.

Per-trade automation snapshot: `supabase/migrations/20260822200000_paper_carry_automation.sql`. Close source: `supabase/migrations/20260822210000_paper_carry_close_source.sql`.

`event_logs` is append-only. Writes go through `writeEventLog` with the service role. Authenticated clients can select their own rows; `app_admins` can select every row. Secrets in `data` are redacted before insert. Logging failures must not break the action that produced the event.

The `system_health` migration is `supabase/migrations/20260822000000_system_health.sql`. GitHub Actions applies it on push to `develop` (development project) and `main` (production project).

See [phase-1.md](phase-1.md) and [environments.md](environments.md).
