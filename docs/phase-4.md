# Phase 4 — Automated paper engine

## Purpose

Let each signed-in user save cash-and-carry execution rules. A scheduled tick scans Bybit on the server, opens and closes **paper** rows on that user’s blotter, and uses the same all-in P&L as Phase 3.

No Bybit orders. No exchange API keys. No Fly.io. No browser Bybit calls.

## Current micro-step

**7 of 7 — Secrets + push** (waiting on you)

`runPaperEngineTick`, `POST /api/engine/tick`, and `.github/workflows/paper-engine-tick.yml` are in the repo. The engine is on when you save at least one rule set. Add `CRON_SECRET` and `ENGINE_TICK_URL` as below, then confirm a tick on `develop`. Do not merge to `main` until that works.

## Micro-steps

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | `phase-4.md` exists. Master spec, environments, database, and phase-discipline say Phase 4 |
| 2 | Decision math | Agent | `lib/engine` decides entries and exits from scan + opens + rules. Checks pass |
| 3 | Rules table | Agent | `paper_rules` and `paper_carries.source` migrations. GitHub Actions applies on `develop` |
| 4 | Rules UI | Agent | `/strategies/cash-and-carry/automations` saves layers. Subnav includes Settings and Automations |
| 5 | Engine tick | Agent | `runPaperEngineTick` + `POST /api/engine/tick` with `CRON_SECRET`. Service-role writes. Manual Close vs Unwind |
| 6 | Schedule | Agent | GitHub Actions every 5 minutes hits the matching Vercel URL |
| 7 | Secrets + push | You + agent | `CRON_SECRET` on Preview and Production. Push `develop`. Production unchanged until you merge |

Stop after each step.

## Runtime

The tick is host-agnostic: `runPaperEngineTick` in `lib/engine`. Phase 4 calls it from `POST /api/engine/tick` on Vercel in Sydney. GitHub Actions schedules the POST. Fly.io can later call the same function; do not add Fly this phase.

Vercel Cron is not the scheduler. Hobby cron is once per day and Production-only, so `develop` would not tick.

`develop` → TBP-dev Preview URL + TBP-dev service role. `main` → Production URL + TBP-prod service role. Never mix.

## Rules (per user)

`paper_engine_settings` holds usable book share and whether any rule sets are saved (one row per user). `paper_rules` holds stacked layers (many rows per user). RLS own-row. Layers can be deleted. The engine is on when at least one layer exists.

Each layer has a name, its own entry and exit order types, entry filters, open caps, and exits. **One pair per set by default.** Max pairs (empty = 1) is distinct pairs, not clips. **Fixed entry** opens Order size once on a pair you do not already hold, and can require Min usable book. **Dynamic entry** adds one clip per tick on the **existing** paper row for the pair this set already holds — or opens one row on the best matching pair if it holds none — sized to current usable book or leftover room under Max Position Size. Skip a clip below Min Order Size. Entry basis on that row is the size-weighted average of its open clips. If two open rows share a pair (legacy duplicates), later clips go on the oldest. For a pair, the engine uses the matching layer with the **highest min APR**. Usable book is the user’s Settings share of the top 5 book levels inside 5 bp of impact. Default share is 25%. The scan stores the raw in-range book; the share is applied per user.

**Exit (first match wins, on that layer):** DTE ≤ `close_max_dte`; mark net APR < `close_min_net_apr`; P&L % ≥ `take_profit_pct`; P&L % ≤ `stop_loss_pct`. P&L % is all-in P&L ÷ entry notional (10% on $10,000 is $1,000). **Fixed exit** closes the whole row. **Dynamic exit** closes up to current usable book per tick until the row is flat. Mid-unwind rows use status `closing`.

Manual rows: **Close** flattens remaining size at the live scan. **Unwind** clips to usable book and sets `closing` until later ticks finish it. Auto rows follow that layer’s exits on each tick. Clicking **Close** on an Auto row uses that set’s exit order type (Fixed flattens; Dynamic clips). Positions show Manual or Auto.

**Engine safety:** A set will not open a second pair unless Max pairs is raised. Fixed entry skips a pair you already hold. Dynamic entry may add clips on the existing row for the pair this set already holds. It does not insert a second row for that pair. Rank by net APR. Caps are per layer. If there are no rule sets, the engine does not open or fire rule exits. It still clips `closing` rows. Manual opens have no `rule_id` and are not auto-closed unless the user clicks Unwind.

Positions with no live mark are not auto-closed.

`paper_carries.source` is `manual` or `engine`. `paper_carries.rule_id` points at the layer that opened an engine row. `paper_carries.rule_name` is that set’s name at open.

Engine opens copy that layer’s entry filters and exits onto the carry. Click **Engine** on an open row to see them and edit that trade’s exits. Past Positions show **In Auto/Manual · Out Auto/Manual**; click for the triggers and how it actually closed. `close_source` is `manual` or `engine`. The tick uses the carry’s exits and writes `close_reason` when it auto-closes.

Expand a current or past position to see its paper orders. Each order stores the conditions that were armed, the scan values at fill time (net basis, APR, DTE, capacity, legs), and the paper execution (fill basis and notional). Paper fill equals the scan. `paper_orders` is append-only. The tick should insert a row per clip.

## Event logs and admin

`event_logs` records system, strategy, and trade events. Writes are service-role only via `writeEventLog`. Manual paper open/close, unwinds, automation saves, and engine clips are logged. Page scans are not.

`/strategies/cash-and-carry/activity` is the signed-in user’s own trade and strategy events. `/admin/logs` is the full system log for admins. Logs and members are live. Admin settings is a placeholder.

## Out of scope

- Bybit orders, encrypted keys, Fly.io
- Websockets, auto-switching
- Calling Bybit from the browser
- Public signup beyond the desk accounts you create
