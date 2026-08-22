# Database

GitHub migrations in `supabase/migrations/` are the source of truth. Do not edit hosted schemas by hand as the normal process.

Migrations are applied by GitHub Actions. Do not run `supabase db push` locally as the normal process.

Current tables:

| Table | Phase | Purpose |
| --- | --- | --- |
| `system_health` | 1 | Pipeline proof. One row: `TBP`. |
| `opportunities` | 2 | Latest scan per spot/future pair. Server upsert only. RLS on, no anon policies. |
| `paper_carries` | 3 | Paper blotter. RLS by `user_id`. Authenticated select/insert/update. No delete. Multiple open rows per pair are allowed. `source` is `manual` or `engine`. `rule_id` is the layer that opened an engine row. |
| `paper_engine_settings` | 4 | Per-user engine on/off. RLS by `user_id`. |
| `paper_rules` | 4 | Stacked entry/exit layers. Many rows per user. RLS by `user_id`. Authenticated select/insert/update/delete. |

Phase 4 rules migrations: `supabase/migrations/20260822160000_paper_rules.sql` then `supabase/migrations/20260822170000_paper_rule_layers.sql`.

The `system_health` migration is `supabase/migrations/20260822000000_system_health.sql`. GitHub Actions applies it on push to `develop` (development project) and `main` (production project).

See [phase-1.md](phase-1.md) and [environments.md](environments.md).
