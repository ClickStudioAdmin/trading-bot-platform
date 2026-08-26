# Database

GitHub migrations in `supabase/migrations/` are the source of truth. Do not edit hosted schemas by hand as the normal process.

Migrations are applied by GitHub Actions. Do not run `supabase db push` locally as the normal process.

Current tables:

| Table | Phase | Purpose |
| --- | --- | --- |
| `system_health` | 1 | Pipeline proof. One row: `TBP`. |
| `opportunities` | 2 | Latest scan per spot/future pair. Server upsert only. RLS on, no anon policies. |
| `paper_carries` | 3 | Blotter. Scoped by `account_id`. RLS by `user_id`. Authenticated select/insert/update. No delete. Paper books allow multiple open rows per pair. On a Connected Exchange book later Opens add to the oldest open row for that pair. `source` is how it opened (`manual` or `engine`). `status` is `open`, `closing`, or `closed`. `close_source` is how it closed. `close_reason` is the auto-exit or `unwind`. Engine rows also store the entry snapshot and per-trade exits. On a Connected Exchange book these rows are venue fills (Phase 7). |
| `paper_orders` | 4 | Append-only fills on a carry. Scoped by `account_id`. RLS by `user_id`. Authenticated select/insert. No update or delete. Each row stores the scan snapshot (theoretical) and the fill (actual). Conditions that were armed are copied at fill time. Phase 7 adds venue, environment, exchange order ids, and fill qty/price. |
| `paper_engine_settings` | 4 | Per-account engine flags, usable book share, and optional `exchange_connection_id` (which Live key Cash and Carry uses; `on delete restrict`). Account `reduce_only` stops new automated entries and scale-ins across Active sets; exits, clips, Unwind, and manual Open/Close still work. A Paper scan-venue field is Phase 8, not now. |
| `paper_rules` | 4 | Stacked entry/exit layers. Many rows per account. `mode` is `active`, `reduce_only`, or `disabled`. RLS by `user_id`. Authenticated select/insert/update/delete. |
| `trading_accounts` | 5 | Books under a login. `mode` is `paper` or `live` and cannot change. The first account is `Demo Account` in paper mode. RLS own-row select. Service-role delete is allowed when the account is not last, has no open or closing carries, and automations are off. That teardown removes the account's paper rows; `event_logs.account_id` is set null. |
| `app_admins` | 4 | Admin allow-list. The desk admin email is hardcoded in `lib/admin/emails.ts` and upserted on sign-in. Users can select only their own row. |
| `event_logs` | 4 | Append-only system, strategy, and trade events. Authenticated select own or admin. Writes are service-role only. |
| `members` | 4 | Desk users. Email, password hash, role (`member` / `admin`), status. This is the only login table. Writes and reads for the app are service-role only, scoped by the session. |
| `exchange_connections` | 6 | Encrypted exchange API credentials on a Live trading account. Venue-agnostic (`venue` + `environment`). Unique `(account_id, venue, environment)`. Writes are service-role. Authenticated own-row select excludes ciphertext and nonce. Paper accounts cannot hold rows. |
| `strategy_settings` | 8 | Per-account, per-strategy bind. Phase 8 uses `strategy_id = futures` for the Futures exchange bind, reduce-only flag, and optional Buy/Sell risk caps (`max_notional_per_symbol`, `max_open_rows`). The desk labels these as Max value per symbol and Max open positions. Cash-and-carry stays on `paper_engine_settings`. RLS by `user_id`. Service-role writes. Authenticated select. |
| `futures_positions` | 8 | Single-leg Futures blotter. One open row per `(account_id, symbol, side)`. Buy adds to a long, Sell adds to a short, Close closes that side. Optional `take_profit` / `stop_loss` with Last/Mark/Index triggers. `tpsl_mode` is `full` or `partial`; partial stores `tp_qty` / `sl_qty`. Optional `trailing_stop` (price distance), `trailing_active` (activation), `trailing_peak` (best last since arm, paper). RLS by `user_id`. Authenticated select/insert/update. No delete. |
| `futures_orders` | 8 | Append-only Futures fills. One venue order id per row. Optional `idempotency_key` (unique per account when set). RLS by `user_id`. Authenticated select/insert. No update or delete. |
| `futures_working_orders` | 8 | Resting Futures GTC limits. Status may update (`open` / `filled` / `cancelled` / `rejected`). Optional TP/SL and trailing stop copy onto the position on fill, including partial TP/SL qty. `reduce_only` close limits reduce or flatten the bound open row instead of opening. Fills still append to `futures_orders`. Optional `idempotency_key` (unique per account when set). RLS by `user_id`. Authenticated select/insert/update. No delete. |
| `futures_command_receipts` | 8 | Idempotent Futures command receipts. Unique `(account_id, idempotency_key)`. Stores the flash and optional working/position ids so a replayed command does not place again. RLS by `user_id`. Authenticated select. Service-role writes. |

Phase 4 rules migrations: `supabase/migrations/20260822160000_paper_rules.sql` then `supabase/migrations/20260822170000_paper_rule_layers.sql`.

Event logs and admins: `supabase/migrations/20260822180000_event_logs_and_admins.sql`.

Members: `supabase/migrations/20260822190000_members.sql`. Password and no Auth FK: `supabase/migrations/20260822220000_members_password_no_auth_fk.sql`.

Per-trade automation snapshot: `supabase/migrations/20260822200000_paper_carry_automation.sql`. Close source: `supabase/migrations/20260822210000_paper_carry_close_source.sql`. Size type: `supabase/migrations/20260823063000_paper_rule_size_type.sql`. Exit size type: `supabase/migrations/20260823080000_paper_rule_exit_size_type.sql`. Paper orders: `supabase/migrations/20260823090000_paper_orders.sql`. Usable book share: `supabase/migrations/20260823100000_usable_book_share.sql`. Closing status: `supabase/migrations/20260823110000_paper_carry_closing.sql`. Max position size on the fill snapshot: `supabase/migrations/20260823120000_entry_max_open_notional.sql`. Rule names: `supabase/migrations/20260823130000_rule_name_and_one_pair.sql`. Trading accounts: `supabase/migrations/20260823140000_trading_accounts.sql`. Default Demo Account name: `supabase/migrations/20260823180000_default_demo_account.sql`. Exchange connections: `supabase/migrations/20260824190000_exchange_connections.sql`. Reduce-only: `supabase/migrations/20260825060000_engine_reduce_only.sql`. Rule mode: `supabase/migrations/20260825070000_paper_rule_mode.sql`. Strategy exchange bind: `supabase/migrations/20260825080000_strategy_exchange_connection.sql`. Live fill columns: `supabase/migrations/20260825090000_live_order_fills.sql`. Futures strategy: `supabase/migrations/20260825140000_futures_strategy.sql`. Hedge unique open row: `supabase/migrations/20260825170000_futures_hedge_positions.sql`. Working limits: `supabase/migrations/20260825180000_futures_working_orders.sql`. TP/SL: `supabase/migrations/20260825190000_futures_tpsl.sql`. Partial TP/SL qty: `supabase/migrations/20260825200000_futures_tpsl_partial.sql`. Trailing stop: `supabase/migrations/20260825210000_futures_trailing_stop.sql`. Limit close: `supabase/migrations/20260826090000_futures_limit_close.sql`. Command idempotency (`idempotency_key` on working/order rows + `futures_command_receipts`): `supabase/migrations/20260826100000_futures_command_idempotency.sql`. Futures risk caps: `supabase/migrations/20260826110000_futures_risk_caps.sql`.

`event_logs` is append-only. Writes go through `writeEventLog` with the service role. Authenticated clients can select their own rows; `app_admins` can select every row. Secrets in `data` are redacted before insert. Logging failures must not break the action that produced the event.

The `system_health` migration is `supabase/migrations/20260822000000_system_health.sql`. GitHub Actions applies it on push to `develop` (development project) and `main` (production project).

See [phase-1.md](phase-1.md) and [environments.md](environments.md).
