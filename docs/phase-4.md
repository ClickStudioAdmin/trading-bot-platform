# Phase 4 — Automated paper engine

## Purpose

Let each signed-in user save cash-and-carry execution rules. A scheduled tick scans Bybit on the server, opens and closes **paper** rows on that user’s blotter, and uses the same all-in P&L as Phase 3.

No Bybit orders. No exchange API keys. No Fly.io. No browser Bybit calls.

## Current micro-step

**4 of 7 — Rules UI** (complete)

`/strategies/cash-and-carry/rules` saves the user’s rules. Waiting on **5 — Engine tick**.

## Micro-steps

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | `phase-4.md` exists. Master spec, environments, database, and phase-discipline say Phase 4 |
| 2 | Decision math | Agent | `lib/engine` decides entries and exits from scan + opens + rules. Checks pass |
| 3 | Rules table | Agent | `paper_rules` and `paper_carries.source` migrations. GitHub Actions applies on `develop` |
| 4 | Rules UI | Agent | `/strategies/cash-and-carry/rules` saves the user’s rules. Subnav includes Rules |
| 5 | Engine tick | Agent | `runPaperEngineTick` + `POST /api/engine/tick` with `CRON_SECRET`. Service-role writes |
| 6 | Schedule | Agent | GitHub Actions every 5 minutes hits the matching Vercel URL |
| 7 | Secrets + push | You + agent | `CRON_SECRET` on Preview and Production. Push `develop`. Production unchanged until you merge |

Stop after each step.

## Runtime

The tick is host-agnostic: `runPaperEngineTick` in `lib/engine`. Phase 4 calls it from `POST /api/engine/tick` on Vercel in Sydney. GitHub Actions schedules the POST. Fly.io can later call the same function; do not add Fly this phase.

Vercel Cron is not the scheduler. Hobby cron is once per day and Production-only, so `develop` would not tick.

`develop` → TBP-dev Preview URL + TBP-dev service role. `main` → Production URL + TBP-prod service role. Never mix.

## Rules (per user)

One `paper_rules` row per `user_id`. RLS select/insert/update own. No delete.

**Entry (all must pass):** `enabled`, `notional_usdt`, `min_net_apr`, `min_dte`, `max_dte`, `min_capacity_usdt`, `max_open_count`, `max_open_notional_usdt`.

**Exit (first match wins):** DTE ≤ `close_max_dte`; mark net APR < `close_min_net_apr`; P&L % ≥ `take_profit_pct`; P&L % ≤ `stop_loss_pct`.

**Engine safety:** skip a pair if that user already has any open row on it. Rank by net APR. Fill until caps. If `enabled` is false, the engine neither opens nor closes.

Positions with no live mark are not auto-closed.

`paper_carries.source` is `manual` or `engine`.

## Out of scope

- Bybit orders, encrypted keys, Fly.io
- Websockets, auto-switching
- Calling Bybit from the browser
- Public signup beyond the desk accounts you create
