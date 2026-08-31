# Backtesting

**Roadmap 4, plan B.** In repo (Perps bots price-cross **and** DCA). Pairs with [phase-charts.md](phase-charts.md). Shared chart kit; **separate page** in the account dashboard.

## Purpose

A member queues a bot config as a **backtest task**. The server replays it on venue history (paper math only). The run owns the recipe. A library template is optional: attach after a matching run, or save as a new template. Publish still copies a finished run as a `backtested` platform template.

Never writes the live blotter. Never places venue orders. Never arms a desk from a run.

Admin **studies** (grid sweeps from a desk bot) are parked. No `/admin/backtests` UI. The `backtest_studies` table and leftover `study_id` rows stay in the database; they are hidden from `/account/backtests`.

## Product shape

```
User
  Automations → Backtest (new tab, saved or not) → draft recipe on /account/backtests
      or pick a desk automation or library template on that page
      edit replay fields → queue → /account/backtests/[runId]
      then Save to the loaded template (if unchanged) or Save to library
      or Re-run Parameters → same form, new run
```

Site header **Backtesting Tool** (`/account/backtests`).

Each run has its own **detail page**: parameters, stats, orders list, account-impact timeline, and an inline chart. Lists only link there. Old `?run=` URLs redirect.

## Locked for this slice

| Lock | Decision |
| --- | --- |
| Recipes | **Perps bots price-cross** and **DCA price / indicator start**. User queue rejects **manual** and **webhook**. |
| Perps bot exits | Same ticket set as manual: TP/SL (full/partial, last/mark/index, market/limit) plus trailing. Optional. Buy/sell only. Flatten rules stay flatten-only. |
| Unpublished runs | **Owner only** (plus admin). |
| Remove | Owner deletes their run. Admin can delete any, including published. Unused `backtested` snapshot is deleted with the last run that pointed at it. A linked **user** template is kept. |
| Bar fill (entries) | Decide on **bar close**, fill at **close**. |
| Bar fill (exits) | Stop and trailing use the **adverse wick**. Take profit uses the **favorable wick** (Perps) or close (DCA percent exits). If stop and take profit both print on the same bar, **stop wins**. |
| Fee | Named preset `vip0_taker` = **6 bps all-in** per fill. |
| Rank | **Realized** USDT. |
| Return | A run is one strategy, not the whole account. Header **APR** and **On capital used** use **max capital used** (peak qty × entry), not starting balance. On capital used is realized / peak. APR is (1 + that)^(1/years) − 1. Performance still shows starting / ending / account return on the paper start so the cash path is visible. Open mark stays in **Current trades**. Account-impact equity marks the open position on each candle (not a single end-point cliff). Not exchange-margin ROE. |
| User queue | Recipe from a **desk automation** (this page or Automations → Backtest), a **library template**, or a previous run (**Re-run Parameters**). Manual and webhook bots stay out of the desk list. Required: a replayable recipe, start date, end date, initial balance, timeframe, venue. Loaded blocked fields show as invalid until the user picks a legal value. Replay fields are editable on the page. **Primary pair** preloads from the recipe; the user can pick another. Optional **comparables** (max 8). The run stores the recipe. No library row until Attach or Save as. |
| Detail | `/account/backtests/[runId]`. Parameters, stats, equity chart, inline chart, paged orders. **Re-run Parameters** loads that run’s recipe, window, balance, pair, timeframe, venue, and comparables into the list-page replay form (`?rerun=`). Queue still creates a **new** run. The Orders list and chart include **every** fill, including clips still open at the window end (action `open` in the table; Open markers + entry line on the chart). Header and Performance stay **realized only**. Open mark and side also sit in **Current trades** under Performance. Queued, running, failed, or cancelled runs keep Parameters and header dates; Performance, equity, chart, and trades show a waiting or failed message — not an empty chart or “no fills”. While queued or running, the detail page refreshes itself until the status is terminal. |
| Desk Backtest | Click is always offered. Manual, webhook, or other blocked fields show the reason and do **not** open a draft. Price / indicator (DCA) or a price When (Perps) seeds a draft. If the form matches a library template, the draft remembers it as `source_template_id`. |
| Attach / Save | After **done**, header groups stay separate. **Library:** if they loaded a template and replay fields still match, **Save to {name}** links the run. Otherwise **Save to library** (new user template, run linked). Never auto-attach after an edit. A linked user template on `/account/templates` shows a **Backtested** badge: hover shows window, win rate, realized P&L, on capital used, and APR; click opens the run in a new tab. **Desk:** **Add to desk** copies idle onto a chosen desk; never arm from a run. **Share:** **Publish snapshot** copies a platform `backtested` row (`user_id` null). |
| Window | Explicit start/end dates. No day cap — 10 years is allowed. Any indicator timeframe (5m through Daily). Rejected only if the range needs more than **200,000** bars. |
| Worker | Short jobs (≤1500 bars and ≤4 pairs) run in the request. Longer jobs stay `queued`. The engine worker (Fly, or the 5-minute Vercel tick for modest jobs) claims one run at a time and pages candles. Stale `running` after 15 minutes is reclaimable. |
| Balance | Required `starting_balance_usdt`. Replay skips an entry when notional + fee exceeds remaining cash (start + realized − locked notional). |
| DCA start | Replay treats legs as **armed** at the window start (Save and Arm). Immediate fires the first clip on the first close. **Both** never starts long and short on the same print, and does not open the other side while one position is still on. Price ≥ is Long only; price ≤ is Short only. Immediate + Both takes Long first (Manual does not auto-hedge). |

## How it sits on templates

Add a third visibility: **`backtested`**.

| | User template | Platform template | **Backtested** template |
| --- | --- | --- | --- |
| What it is | Config to stamp on a desk | Same, admin-owned | Config **plus** a completed run |
| Apply to a desk | Idle / disabled, as today | Same | Same. Copy: “This was backtested. Enable on the desk yourself.” |
| Who sees it | Owner (+ shares) | Every member | Owner’s runs on `/account/backtests`. **Publish** copies to `user_id` null. |
| Recipe | Unchanged parsers | Unchanged | Same recipe JSON. Fills live on `backtest_runs`, not in `recipe`. |

New table `backtest_runs`:

- `id`, `user_id` (null on published copies)
- `template_id` (library or published snapshot after Attach / Save / Publish; null on a fresh queue)
- `source_template_id` (library row they loaded from, if any)
- `desk_type` (`perps` \| `dca`) + `venue` + `symbol` + window + timeframe
- `status`: `draft` \| `queued` \| `running` \| `done` \| `failed` \| `cancelled`
- `starting_balance_usdt`
- `fee_preset` / `fee_rate`
- `stats` JSON, `orders` JSON (simulated only, source backtest)
- Immutable after `done` (updates only while queued/running). A re-run creates a new row.
- `study_id` (leftover from parked admin studies; user list hides these rows)
- `parent_run_id` (comparable children) and `comparable_symbols` (on the primary)
- `claimed_at` (worker lease)

Migrations: `supabase/migrations/20260830120000_backtest_runs.sql`, `supabase/migrations/20260830133000_bot_exits_and_dca_backtest.sql`, `supabase/migrations/20260830140000_backtest_starting_balance.sql`, `supabase/migrations/20260830150000_backtest_studies.sql`, `supabase/migrations/20260830160000_backtest_comparables_and_worker.sql`, `supabase/migrations/20260830170000_backtest_drafts_and_source.sql`.

## Engine rules

- Perps replay uses `decideFuturesAutomationTick` on each bar close, then ticket exits on the same book.
- DCA replay uses `decideDcaTick` (same clip / percent-exit / breakeven math as live).
- Signal / webhook When, webhook-start, or **manual** start: **rejected** at user queue time.
- Venue truth: Bybit klines for Bybit, HL candles for HL.
- Does not write `futures_orders` / paper carries.

## Shared with charts (plan A)

Same `<DeskChart>`, candle API, and overlay renderer. Backtest overlay source = `backtest_runs.orders` plus the When line (Perps only). Every fill is on the chart and in Orders. Completed fills stay Buy/Close arrows. Still-open clips use **Open long/short** markers only — no axis Open label. Header and Performance stay realized only.

## Out of scope (still)

- TV Strategy / webhook-only recipes.
- C&C, walk-forward, tick-level, Pine parity.
- Unbounded float sweeps or more than 96 scenarios (Fly job later).
- Admin studies / scenario grids (`/admin/backtests`). Parked until Click restarts that product.
- Chart trading.
- Writing simulated fills into the live blotter.
