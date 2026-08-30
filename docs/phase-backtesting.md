# Backtesting

**Roadmap 4, plan B.** Not started. Pairs with [phase-charts.md](phase-charts.md). Shared chart kit; **separate page** in the account dashboard. Do not build until Click starts this item.

## Purpose

A member queues a bot config as a **backtest task**. A worker replays it on venue history (paper math only). Results and simulated orders are saved against a **`backtested` template** so anyone who can see that template can open the stats, the order list, and the chart.

Admins can fan out **many** configs (parameter sweep), rank them, and publish the winners as `backtested` platform templates.

Never writes the live blotter. Never places venue orders. Never arms a desk from a run.

## Product shape

```
Automations (or Templates)
    [Backtest]  →  enqueue task  →  /account/backtests
                                         │
                                         ├─ task list (queued / running / done / failed)
                                         ├─ open a done run → stats + simulated orders + chart popup
                                         └─ freeze config as template visibility = backtested
```

Account nav (with Bot Templates): **Backtests**.

Admin: **Backtests** under `/admin` for sweeps, ranks, and platform `backtested` rows. Members never see the sweep form.

## How it sits on templates

Today a template is `visibility: user | platform` plus a `recipe` snapshot ([templates.md](templates.md)). Recipe is the bot config only — no keys, no webhook tokens, no runtime.

Add a third visibility: **`backtested`**.

| | User template | Platform template | **Backtested** template |
| --- | --- | --- | --- |
| What it is | Config to stamp on a desk | Same, admin-owned, everyone can apply | Config **plus** a completed run people can look up |
| Apply to a desk | Idle / disabled, as today | Same | Same. Apply never arms. Copy: “This was backtested. Enable on the desk yourself.” |
| Who sees it | Owner (+ shares) | Every member | Owner’s runs stay on the login. **Publish** copies to platform `backtested` (same rule as publish-to-platform today: copy, do not promote). Anyone can open published stats. |
| Recipe | Unchanged parsers | Unchanged | Same recipe JSON. Do not invent a second recipe format. |

**Do not** stuff thousands of simulated fills into `recipe`. Recipe stays applyable and small.

New table (name TBD, e.g. `backtest_runs`):

- `id`, `user_id` (null on platform/admin sweeps)
- `template_id` (the `backtested` snapshot this run is bound to)
- `desk_type` + `venue` + `symbol` + window (`from_ms`, `to_ms`) + timeframe
- `status`: `queued` \| `running` \| `done` \| `failed` \| `cancelled`
- `fee_model` (locked before coding — suggested: same assumed VIP0 taker + slip we use on paper C&C, or a named preset)
- `stats` JSON: trades, win rate, realized, max drawdown, profit factor, time-in-market
- `orders` (or a child table): simulated fills only. Source `backtest`. Not `futures_orders`.
- `error` if failed
- `created_at`, `finished_at`
- Immutable after `done`. A re-run creates a **new** run and can retarget the template’s “latest run.”

Corrections = new run, not an edit. Same rule as ledgers.

## User flow

1. On a **saved** bot (Perps bots or DCA — lock first type), **Backtest**.
2. Dialog: venue (desk’s venue), contract (bot’s symbol), window (e.g. 30d / 90d / 1y), timeframe, fee preset. Defaults from the bot.
3. Confirm queues a task and snapshots the current form into a `backtested` **user** template (or reuses one if they re-run the same frozen recipe).
4. `/account/backtests` shows the queue. Opening a done row shows stats, simulated orders, and the **same chart popup** as live (overlay source = this run).
5. **Publish** (optional) copies the `backtested` template + latest run pointer to platform, so other members can look it up (and apply idle if they want).

Unsaved dirty cards: Save first, then Backtest. Do not queue a half-edited draft.

TV Strategy has no recipe form — out of scope. C&C parked until Perps/DCA backtest is accepted.

## Admin sweep

Goal: “all reasonable configs” for a bot **family**, ranked.

1. Admin picks desk type + venue + one or more contracts + window + timeframe.
2. Admin sets **ranges / enums** for a bounded set of knobs (not every column). Example DCA: clip, grid step, TP, SL, RSI sit vs cross, timeframe. Example Perps bots: side, trigger compare, distance or level, size.
3. Server expands the cartesian product, **caps** it (hard max, e.g. 200–500 jobs per sweep unless Click raises it), and enqueues.
4. Each job = one `backtested` **platform** template (or a sweep folder + child templates) + one run.
5. Rank view: sort by a locked metric (realized, drawdown, profit factor). Admins pin winners into normal platform templates if they want a Starter Pack later.

Sweep is a job storm. It belongs on the **Fly worker** (or a sibling queue), not a Vercel request. Same lease idea as the engine: one worker claims jobs; never the browser.

Do not run sweeps against live keys. Paper math + public klines only.

## Engine rules

- Replay uses the **same decision functions** as the live engine (`runFuturesCommand` paper path / DCA tick), driven by historical OHLC — not a second invented brain.
- Bar model must be locked: e.g. decide on **close**, fill limits if the bar trades through, conservative intra-bar (stop before TP if both touched). Write this down before coding.
- Signal / webhook When: cannot replay TV. Those bots are skipped or only the price-cross / indicator part runs. Lock: **no webhook-entry bots in v1**.
- Fees and slip: one named preset on the run. Not “zero fees” as default.
- Venue truth: Bybit klines for Bybit recipes, HL candles for HL recipes. Backup klines = roadmap 6.

## Shared with charts (plan A)

| Shared | Live popup only | Backtest page only |
| --- | --- | --- |
| `<DeskChart>`, candle API, timeframes | Positions / Automations / Pairs / Activity **buttons** | `/account/backtests` + `/admin/backtests` |
| Overlay renderer | Live ledger | `backtest_runs.orders` |
| Theme tokens | Same modal chrome | Same modal chrome |

If we kill the live popup, Backtesting still keeps the chart on the Backtests page.

## Suggested ship (when roadmap 4 starts)

**Slice 1 — chart kit + live popup** ([phase-charts.md](phase-charts.md))  
Candle API, `<DeskChart>`, Positions **Chart** button → popup. Stop. Easy to remove.

**Slice 2 — Backtests page + one-bot queue**  
`/account/backtests`. Backtest on one saved Perps bots **or** DCA card. `backtested` visibility + `backtest_runs`. Stats + order list + chart popup on a done run. Publish to platform.

**Slice 3 — Admin sweep + rank**  
`/admin/backtests`. Bounded grid, cap, rank. Platform `backtested` library.

Stop after each slice until Click says go.

## Out of scope

- Building now.
- Writing simulated fills into `futures_orders` / paper carries.
- Arming or enabling a desk from a run.
- TV Strategy / webhook-only recipes.
- C&C, walk-forward, tick-level, Pine parity.
- Unbounded “all possible configs” with no cap.
- Chart trading.

## Open locks (ask Click when the item starts)

1. First recipe: Perps bots price-cross, or DCA?
2. Who can see unpublished user runs — owner only, or also people they share with (reuse template share)?
3. Sweep cap and which knobs are in the first grid.
4. Rank default: realized vs max drawdown vs profit factor.
5. Bar fill rule (close-only vs conservative intra-bar).
6. Fee preset (reuse paper C&C all-in, or a flatter bps number).
