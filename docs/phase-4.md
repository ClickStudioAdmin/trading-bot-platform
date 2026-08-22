# Phase 4 — Automated paper engine

## Purpose

Let each signed-in user save cash-and-carry execution rules. A scheduled tick scans Bybit on the server, opens and closes **paper** rows on that user’s blotter, and uses the same all-in P&L as Phase 3.

No Bybit orders. No exchange API keys. No Fly.io. No browser Bybit calls.

## Current micro-step

**4 of 7 — Rules UI** (complete)

`/strategies/cash-and-carry/automations` saves the user’s automation layers. `/strategies/cash-and-carry/positions` is the open paper table. `/strategies/cash-and-carry/performance` is past positions and desk statistics. `/strategies/cash-and-carry/settings` saves usable book share. Waiting on **5 — Engine tick**.

## Micro-steps

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | `phase-4.md` exists. Master spec, environments, database, and phase-discipline say Phase 4 |
| 2 | Decision math | Agent | `lib/engine` decides entries and exits from scan + opens + rules. Checks pass |
| 3 | Rules table | Agent | `paper_rules` and `paper_carries.source` migrations. GitHub Actions applies on `develop` |
| 4 | Rules UI | Agent | `/strategies/cash-and-carry/automations` saves layers. Subnav includes Settings and Automations |
| 5 | Engine tick | Agent | `runPaperEngineTick` + `POST /api/engine/tick` with `CRON_SECRET`. Service-role writes |
| 6 | Schedule | Agent | GitHub Actions every 5 minutes hits the matching Vercel URL |
| 7 | Secrets + push | You + agent | `CRON_SECRET` on Preview and Production. Push `develop`. Production unchanged until you merge |

Stop after each step.

## Runtime

The tick is host-agnostic: `runPaperEngineTick` in `lib/engine`. Phase 4 calls it from `POST /api/engine/tick` on Vercel in Sydney. GitHub Actions schedules the POST. Fly.io can later call the same function; do not add Fly this phase.

Vercel Cron is not the scheduler. Hobby cron is once per day and Production-only, so `develop` would not tick.

`develop` → TBP-dev Preview URL + TBP-dev service role. `main` → Production URL + TBP-prod service role. Never mix.

## Rules (per user)

`paper_engine_settings` holds the enable switch and usable book share (one row per user). `paper_rules` holds stacked layers (many rows per user). RLS own-row. Layers can be deleted.

Each layer has its own entry and exit order types, entry filters, open caps, and exits. **Fixed entry** opens Order size once on a pair you do not already hold, and can require Min usable book. **Dynamic entry** adds one clip per pair per tick, sized to current usable book or leftover room under Max Position Size, until that cap (and Max opens) is met. Skip a clip below Min Order Size. For a pair, the engine uses the matching layer with the **highest min APR**. Usable book is the user’s Settings share of the top 5 book levels inside 5 bp of impact. Default share is 25%. The scan stores the raw in-range book; the share is applied per user.

**Exit (first match wins, on that layer):** DTE ≤ `close_max_dte`; mark net APR < `close_min_net_apr`; P&L % ≥ `take_profit_pct`; P&L % ≤ `stop_loss_pct`. P&L % is all-in P&L ÷ entry notional (10% on $10,000 is $1,000). **Fixed exit** closes the whole row. **Dynamic exit** closes up to current usable book per tick until the row is flat.

**Engine safety:** Fixed entry skips a pair you already hold. Dynamic entry may add clips on a held pair. Rank by net APR. Caps are per layer. If `enabled` is false, the engine neither opens nor closes. Manual opens have no `rule_id` and are not auto-closed.

Positions with no live mark are not auto-closed.

`paper_carries.source` is `manual` or `engine`. `paper_carries.rule_id` points at the layer that opened an engine row.

Engine opens copy that layer’s entry filters and exits onto the carry. Click **Engine** on an open row to see them and edit that trade’s exits. Past Positions show **In Auto/Manual · Out Auto/Manual**; click for the triggers and how it actually closed. `close_source` is `manual` or `engine`. The tick uses the carry’s exits and writes `close_reason` when it auto-closes.

Expand a current or past position to see its paper orders. Each order stores the conditions that were armed, the scan values at fill time (net basis, APR, DTE, capacity, legs), and the paper execution (fill basis and notional). Paper fill equals the scan. `paper_orders` is append-only. The tick should insert a row per clip.

## Event logs and admin

`event_logs` records system, strategy, and trade events. Writes are service-role only via `writeEventLog`. Manual paper open/close and automation saves are logged. Page scans are not.

`/admin` is for `click.studio.admin@gmail.com` and members with role `admin`. Logs and members are live. Admin settings is a placeholder.

## Out of scope

- Bybit orders, encrypted keys, Fly.io
- Websockets, auto-switching
- Calling Bybit from the browser
- Public signup beyond the desk accounts you create
