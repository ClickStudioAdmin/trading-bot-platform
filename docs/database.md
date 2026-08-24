# Database

GitHub migrations in `supabase/migrations/` are the source of truth. Do not edit hosted schemas by hand as the normal process.

Migrations are applied by GitHub Actions. Do not run `supabase db push` locally as the normal process.

Current tables:

| Table | Phase | Purpose |
| --- | --- | --- |
| `system_health` | 1 | Pipeline proof. One row: `TBP`. |
| `opportunities` | 2 | Latest scan per spot/future pair. Server upsert only. RLS on, no anon policies. |
| `paper_carries` | 3 | Paper blotter. Scoped by `account_id`. RLS by `user_id`. Authenticated select/insert/update. No delete. Multiple open rows per pair are allowed. `source` is how it opened (`manual` or `engine`). `status` is `open`, `closing`, or `closed`. `close_source` is how it closed. `close_reason` is the auto-exit or `unwind`. Engine rows also store the entry snapshot and per-trade exits. |
| `paper_orders` | 4 | Append-only paper fills on a carry. Scoped by `account_id`. RLS by `user_id`. Authenticated select/insert. No update or delete. Each row stores the scan snapshot (theoretical) and the paper fill (actual). Conditions that were armed are copied at fill time. |
| `paper_engine_settings` | 4 | Per-account engine flags, usable book share, and optional `exchange_connection_id` (which Live key Cash and Carry uses; `on delete restrict`). Account `reduce_only` stops new automated entries and scale-ins across Active sets; exits, clips, Unwind, and manual Open/Close still work. A Paper scan-venue field is Phase 7, not now. |
| `paper_rules` | 4 | Stacked entry/exit layers. Many rows per account. `mode` is `active`, `reduce_only`, or `disabled`. RLS by `user_id`. Authenticated select/insert/update/delete. |
| `trading_accounts` | 5 | Books under a login. `mode` is `paper` or `live` and cannot change. The first account is `Demo Account` in paper mode. RLS own-row select. Service-role delete is allowed when the account is not last, has no open or closing carries, and automations are off. That teardown removes the account's paper rows; `event_logs.account_id` is set null. |
| `app_admins` | 4 | Admin allow-list. The desk admin email is hardcoded in `lib/admin/emails.ts` and upserted on sign-in. Users can select only their own row. |
| `event_logs` | 4 | Append-only system, strategy, and trade events. Authenticated select own or admin. Writes are service-role only. |
| `members` | 4 | Desk users. Email, password hash, role (`member` / `admin`), status. This is the only login table. Writes and reads for the app are service-role only, scoped by the session. |
| `exchange_connections` | 6 | Encrypted exchange API credentials on a Live trading account. Venue-agnostic (`venue` + `environment`). Unique `(account_id, venue, environment)`. Writes are service-role. Authenticated own-row select excludes ciphertext and nonce. Paper accounts cannot hold rows. |

Phase 4 rules migrations: `supabase/migrations/20260822160000_paper_rules.sql` then `supabase/migrations/20260822170000_paper_rule_layers.sql`.

Event logs and admins: `supabase/migrations/20260822180000_event_logs_and_admins.sql`.

Members: `supabase/migrations/20260822190000_members.sql`. Password and no Auth FK: `supabase/migrations/20260822220000_members_password_no_auth_fk.sql`.

Per-trade automation snapshot: `supabase/migrations/20260822200000_paper_carry_automation.sql`. Close source: `supabase/migrations/20260822210000_paper_carry_close_source.sql`. Size type: `supabase/migrations/20260823063000_paper_rule_size_type.sql`. Exit size type: `supabase/migrations/20260823080000_paper_rule_exit_size_type.sql`. Paper orders: `supabase/migrations/20260823090000_paper_orders.sql`. Usable book share: `supabase/migrations/20260823100000_usable_book_share.sql`. Closing status: `supabase/migrations/20260823110000_paper_carry_closing.sql`. Max position size on the fill snapshot: `supabase/migrations/20260823120000_entry_max_open_notional.sql`. Rule names: `supabase/migrations/20260823130000_rule_name_and_one_pair.sql`. Trading accounts: `supabase/migrations/20260823140000_trading_accounts.sql`. Default Demo Account name: `supabase/migrations/20260823180000_default_demo_account.sql`. Exchange connections: `supabase/migrations/20260824190000_exchange_connections.sql`. Reduce-only: `supabase/migrations/20260825060000_engine_reduce_only.sql`. Rule mode: `supabase/migrations/20260825070000_paper_rule_mode.sql`. Strategy exchange bind: `supabase/migrations/20260825080000_strategy_exchange_connection.sql`.

`event_logs` is append-only. Writes go through `writeEventLog` with the service role. Authenticated clients can select their own rows; `app_admins` can select every row. Secrets in `data` are redacted before insert. Logging failures must not break the action that produced the event.

The `system_health` migration is `supabase/migrations/20260822000000_system_health.sql`. GitHub Actions applies it on push to `develop` (development project) and `main` (production project).

See [phase-1.md](phase-1.md) and [environments.md](environments.md).
