# Backtesting

**Roadmap 4, plan B.** In repo (Perps bots price-cross **and** DCA). Pairs with [phase-charts.md](phase-charts.md). Shared chart kit; **separate page** in the account dashboard.

## Purpose

A member queues a bot config as a **backtest task**. The server replays it on venue history (paper math only). Results and simulated orders are saved against a **`backtested` template** so anyone who can see that template can open the stats, the order list, and the chart.

Admins can fan out a **bounded** set of contracts, rank them, and publish winners as `backtested` platform templates.

Never writes the live blotter. Never places venue orders. Never arms a desk from a run.

## Product shape

```
Automations
    Save as template  →  [Backtest] (only if this config is a library template)
                                │
                                └ new tab →  /account/backtests  form
                                                 start / end / initial balance / timeframe / venue / contract
                                                 │
                                                 └ run → task list + stats
```

Account nav (with Bot Templates): **Backtests**. Admin: **Backtests** under `/admin`.

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
| Sweep | Admin: one template × up to **10** contracts. Same required dates and starting balance. |
| Queue | **Only from `/account/backtests`.** Required: saved library template, start date, end date, initial balance. Timeframe, venue, and contract are required too. |
| Desk Backtest | Link in a new tab. Shown only when the **current form matches a saved user/platform template**. Webhook recipes stay disabled. |
| Window | Explicit start/end dates. Max **365** days. Rejected if the range needs more than **1500** bars at the chosen timeframe. |
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

Migrations: `supabase/migrations/20260830120000_backtest_runs.sql`, `supabase/migrations/20260830133000_bot_exits_and_dca_backtest.sql`, `supabase/migrations/20260830140000_backtest_starting_balance.sql`.

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
- Unbounded cartesian knob sweeps (Fly job storm later).
- Chart trading.
- Writing simulated fills into the live blotter.
