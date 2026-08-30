# Backtesting

**Roadmap 4, plan B.** In repo (Perps bots price-cross **and** DCA). Pairs with [phase-charts.md](phase-charts.md). Shared chart kit; **separate page** in the account dashboard.

## Purpose

A member queues a bot config as a **backtest task**. The server replays it on venue history (paper math only). Results and simulated orders are saved against a **`backtested` template** so anyone who can see that template can open the stats, the order list, and the chart.

Admins run a **study**: every discrete scenario from a desk bot’s entry starts, timeframes, take profits, and stops. Rank the group, then open a winner’s detail page. Publish still copies a single run as a `backtested` platform template.

Never writes the live blotter. Never places venue orders. Never arms a desk from a run.

## Product shape

```
User
  Automations → Save as template → Backtest (new tab) → /account/backtests
      one template × one window × one balance → /account/backtests/[runId]

Admin
  Desk bot (live playbook / Perps rule) → study grid → /admin/backtests/studies/[id]
      ranked scenarios → /admin/backtests/[runId]
```

Account nav (with Bot Templates): **Backtests**. Admin: **Backtests** under `/admin`.

Each run has its own **detail page**: parameters, stats, trade list, account-impact timeline, and an inline chart. Lists only link there. Old `?run=` URLs redirect.

## Locked for this slice

| Lock | Decision |
| --- | --- |
| Recipes | **Perps bots price-cross** and **DCA** (immediate / price / indicator start). Webhook-entry and webhook-start skipped. |
| Perps bot exits | Same ticket set as manual: TP/SL (full/partial, last/mark/index, market/limit) plus trailing. Optional. Buy/sell only. Flatten rules stay flatten-only. |
| Unpublished runs | **Owner only** (plus admin). |
| Remove | Owner deletes their run. Admin can delete any, including published. Unused `backtested` snapshot is deleted with the last run that pointed at it. |
| Bar fill (entries) | Decide on **bar close**, fill at **close**. |
| Bar fill (exits) | Stop and trailing use the **adverse wick**. Take profit uses the **favorable wick** (Perps) or close (DCA percent exits). If stop and take profit both print on the same bar, **stop wins**. |
| Fee | Named preset `vip0_taker` = **6 bps all-in** per fill. |
| Rank | **Realized** USDT. |
| User queue | **One predefined template.** Required: saved library template, start date, end date, initial balance, timeframe, venue. **Primary pair** preloads from the template; the user can pick another from the venue list. Optional **comparables** (max 8) queue the same bot/window on other pairs. |
| Admin study | Seed from a **desk bot** (DCA playbook or Perps bots rule), not a template. Expands a **locked discrete grid**: entry starts × timeframes that fit the window × take-profit % × stop %. Cap **96** scenarios. Grouped as a `backtest_studies` row; child runs have `study_id`. |
| Study grid (DCA) | Starts: immediate; price ≥/≤ when the seed has an arm price; RSI / MACD / EMA-cross × cross ≥ / cross ≤. Timeframes: 15m, 1h, 4h, Daily if the window is ≤ 1500 bars. TP: off / 4% / 8% / 12%. SL: off / 5% / 10%. Clip size, averaging, and contract stay on the seed. Webhook start is never generated. |
| Study grid (Perps) | Buy/sell only. When ≥ / ≤ at the seed price. Same timeframes and TP/SL percents (converted to prices from the When). Flatten rules are skipped. |
| Detail | `/account/backtests/[runId]` and `/admin/backtests/[runId]`. Parameters, stats, full trade list, equity timeline, inline chart. |
| Desk Backtest | Link in a new tab. Shown only when the **current form matches a saved user/platform template**. Webhook recipes stay disabled. |
| Window | Explicit start/end dates. Max **1825** days (5 years). Any indicator timeframe (5m through Daily). Rejected only if the range needs more than **200,000** bars. |
| Worker | Short jobs (≤1500 bars and ≤4 pairs) run in the request. Longer jobs stay `queued`. The engine worker (Fly, or the 5-minute Vercel tick for modest jobs) claims one run at a time and pages candles. Stale `running` after 15 minutes is reclaimable. |
| Balance | Required `starting_balance_usdt`. Replay skips an entry when notional + fee exceeds remaining cash (start + realized − locked notional). |
| DCA start | Replay treats legs as **armed** at the window start (Save and Arm). Immediate fires the first clip on the first close. |

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
- `template_id` (the `backtested` snapshot)
- `desk_type` (`perps` \| `dca`) + `venue` + `symbol` + window + timeframe
- `status`: `queued` \| `running` \| `done` \| `failed` \| `cancelled`
- `starting_balance_usdt`
- `fee_preset` / `fee_rate`
- `stats` JSON, `orders` JSON (simulated only, source backtest)
- Immutable after `done` (updates only while queued/running). A re-run creates a new row.
- `study_id` (null on regular user tests)
- `parent_run_id` (comparable children) and `comparable_symbols` (on the primary)
- `claimed_at` (worker lease)

Migrations: `supabase/migrations/20260830120000_backtest_runs.sql`, `supabase/migrations/20260830133000_bot_exits_and_dca_backtest.sql`, `supabase/migrations/20260830140000_backtest_starting_balance.sql`, `supabase/migrations/20260830150000_backtest_studies.sql`, `supabase/migrations/20260830160000_backtest_comparables_and_worker.sql`.

Admin studies live in `backtest_studies`. Candle fetch is once per timeframe; recipes replay in process.

## Engine rules

- Perps replay uses `decideFuturesAutomationTick` on each bar close, then ticket exits on the same book.
- DCA replay uses `decideDcaTick` (same clip / percent-exit / breakeven math as live).
- Signal / webhook When or webhook-start: **rejected** at queue time.
- Venue truth: Bybit klines for Bybit, HL candles for HL.
- Does not write `futures_orders` / paper carries.

## Shared with charts (plan A)

Same `<DeskChart>`, candle API, and overlay renderer. Backtest overlay source = `backtest_runs.orders` plus the When line (Perps only).

## Out of scope (still)

- TV Strategy / webhook-only recipes.
- C&C, walk-forward, tick-level, Pine parity.
- Unbounded float sweeps or more than 96 scenarios (Fly job later).
- Chart trading.
- Writing simulated fills into the live blotter.
