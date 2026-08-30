# Backtesting

**Roadmap 4, plan B.** In repo (Perps bots price-cross). Pairs with [phase-charts.md](phase-charts.md). Shared chart kit; **separate page** in the account dashboard.

## Purpose

A member queues a bot config as a **backtest task**. The server replays it on venue history (paper math only). Results and simulated orders are saved against a **`backtested` template** so anyone who can see that template can open the stats, the order list, and the chart.

Admins can fan out a **bounded** set of contracts, rank them, and publish winners as `backtested` platform templates.

Never writes the live blotter. Never places venue orders. Never arms a desk from a run.

## Product shape

```
Automations
    [Backtest]  →  run inline (queued → done)  →  /account/backtests
                                                       │
                                                       ├─ task list
                                                       ├─ open a done run → stats + simulated orders + chart popup
                                                       └─ freeze config as template visibility = backtested
```

Account nav (with Bot Templates): **Backtests**. Admin: **Backtests** under `/admin`.

## Locked for this slice

| Lock | Decision |
| --- | --- |
| First recipe | **Perps bots price-cross only.** Webhook-entry skipped. DCA later. |
| Unpublished runs | **Owner only** (plus admin). |
| Bar fill | Decide on **bar close**, fill at **close**. Same `decideFuturesAutomationTick` as live. |
| Fee | Named preset `vip0_taker` = **6 bps all-in** per fill. |
| Rank | **Realized** USDT. |
| Sweep | Admin: one template × up to **10** contracts. Runs inline (not Fly). |
| Window | 30d default, 90d option. Timeframes 15m / 1h / 4h / D. |

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
- `desk_type` + `venue` + `symbol` + window + timeframe
- `status`: `queued` \| `running` \| `done` \| `failed` \| `cancelled`
- `fee_preset` / `fee_rate`
- `stats` JSON, `orders` JSON (simulated only, source backtest)
- Immutable after `done` (updates only while queued/running). A re-run creates a new row.

Migration: `supabase/migrations/20260830120000_backtest_runs.sql`.

## Engine rules

- Replay uses `decideFuturesAutomationTick` on each bar close.
- Signal / webhook When: **rejected** at queue time.
- Venue truth: Bybit klines for Bybit, HL candles for HL.
- Does not write `futures_orders` / paper carries.

## Shared with charts (plan A)

Same `<DeskChart>`, candle API, and overlay renderer. Backtest overlay source = `backtest_runs.orders` plus the When line.

## Out of scope (still)

- DCA replay.
- TV Strategy / webhook-only recipes.
- C&C, walk-forward, tick-level, Pine parity.
- Unbounded cartesian knob sweeps (Fly job storm later).
- Chart trading.
- Writing simulated fills into the live blotter.
