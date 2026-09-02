# Backtesting

**Roadmap 4, plan B.** In repo (Perps bots price-cross **and** DCA). Pairs with [phase-charts.md](phase-charts.md). Shared chart kit; **separate page** in the account dashboard.

## Purpose

A member queues a bot config as a **backtest task**. The server replays it on venue history (paper math only). The run owns the recipe. A library template is optional: attach after a matching run, or save as a new template. Publishing a public snapshot is parked; leftover `user_id` null copies may still exist.

Never writes the live blotter. Never places venue orders. Never arms a desk from a run.

Admin **studies** (grid sweeps from a desk bot) are parked. No `/admin/backtests` UI. The `backtest_studies` table and leftover `study_id` rows stay in the database; they are hidden from `/account/backtests`.

## Product shape

```
User
  Automations → Backtest (new tab, saved or not) → draft recipe on /account/backtests
      or pick a desk automation or library template on that page
      edit replay fields → queue → /account/backtests/[runId]
      then Template / Desk panels: Attach if the recipe matches a library template,
      or Save as template (modal; creates and attaches)
      Admin: **Save as platform template** is always on a done run, separate from user save.
      or Load into new backtest → same form, new run
```

Site header **Backtesting Tool** (`/account/backtests`). Two tabs: **New Backtest** (queue form) and **Saved Backtests** (`?tab=saved`, the run list). **Load into new backtest**, drafts, and template links open the New tab. **All backtests** on a run opens Saved.

Each run has its own **detail page**: parameters, stats, desk-style open / past positions (expand for orders and synthesized logs), account-impact timeline, and an inline chart. The Saved list shows name, type, contract, comps, days, win rate, ROE, APR, status, and Actions. Name opens the detail page in this tab. Old `?run=` URLs redirect.

## Locked for this slice

| Lock | Decision |
| --- | --- |
| Recipes | **Perps bots price-cross** and **DCA price / indicator start**. User queue rejects **manual** and **webhook**. |
| Perps bot exits | Same ticket set as manual: TP/SL (full/partial, last/mark/index, market/limit) plus trailing. Optional. Buy/sell only. Flatten rules stay flatten-only. |
| Unpublished runs | **Owner only** (plus admin). Leftover published copies (`user_id` null) stay readable. New publishes are parked. |
| Remove | Owner deletes their run. Admin can delete any, including leftover published copies. Unused `backtested` snapshot is deleted with the last run that pointed at it. A linked **user** template is kept. |
| Bar fill (entries) | Decide on **bar close**, fill at **close**. |
| Bar fill (exits) | Stop and trailing use the **adverse wick** (Perps ticket stops and DCA **percent** SL). Take profit uses the **favorable wick** (Perps) or **close** (DCA percent TP). If stop and take profit both print on the same bar, **stop wins**. |
| Fee | Named preset `vip0_taker` = **6 bps all-in** per fill. |
| Rank | **Realized** USDT. |
| Return | A run is one strategy, not the whole account. Header tiles match desk Performance: days in the replay window, completed trades, win rate, max drawdown (peak-to-trough of marked equity versus that peak, plus the $ dip), realized profit, **P&L** (realized ÷ starting balance — same as account return), **ROE** (realized ÷ closed position value ÷ leverage), and **APR** (compound annualization of that account return over the window). Starting / ending / account return stay in the Performance list. Desk P&L stays on position value; live books have no starting balance. Open mark stays in **Current trades**. Account-impact equity marks the open position on each candle (not a single end-point cliff). |
| User queue | Recipe from a **desk automation** (this page or Automations → Backtest), a **library template** (grouped by folder), or a previous run (**Load into new backtest**). Manual and webhook bots stay out of the desk list. Required: a replayable recipe, start date, end date, initial balance, leverage, venue. The replay **tape** is system-picked: indicator-start DCA uses the bot Timeframe on **Bot to replay**; price-start and Perps use the finest tape that fits the window. There is no left Timeframe control. Loaded blocked fields show as invalid until the user picks a legal value. Replay fields are editable on the page. **Primary pair** preloads from the recipe; the user can pick another. Optional **comparables** (max 8). Each comparable is a child run named `{recipe} · {pair}` and matches library / desk bots on **that** contract, not the parent. The run stores the recipe. No library row until Attach or Save as. |
| Detail | `/account/backtests/[runId]`. Parameters, stats, equity chart, inline chart, then **Open Positions** and **Past Positions** in the same columns as the desk blotter (expand for fills and logs). Finished-run **Account impact** and **Chart** each have their own display timeframe (15m / 1h / 4h / D, plus the run’s own if it is not in that set). Default is the auto pick that keeps the window under 1,500 bars. Finer TFs still load the **full activity window** (paged; live desk candles stay at 1,500) so every fill stays on the chart. Changing a TF does not re-run the bot and does not change the other chart. **Load into new backtest** (beside Parameters) loads that run’s recipe, window, balance, pair, timeframe, venue, and comparables into the list-page replay form (`?rerun=`). Queue still creates a **new** run. Fills still open at the window end sit in **Open Positions**. Closed cycles sit in **Past Positions**. Chart markers are Entry / Add n / TP / SL / Trail / Close (open clips: Open long/short). Horizontal lines: average entry, planned take profit, planned stop. Header and Performance stay **realized only**. Queued, running, failed, or cancelled runs keep Parameters and header dates; Performance, equity, chart, and positions show a waiting or failed message — not an empty chart or “no fills”. While queued or running, the detail page starts the run if it is still queued, then refreshes until the status is terminal. A comparable set gets a **Comparables** table at the bottom (primary plus the other pairs from that queue). Same columns as the Backtesting Tool list. The primary row has a **Primary Pair** badge. Child pages do not use a header **Primary pair** link. |
| Desk Backtest | Click is always offered. Manual, webhook, or other blocked fields show the reason and do **not** open a draft. Price / indicator (DCA) or a price When (Perps) seeds a draft. If the form matches a library template, the draft remembers it as `source_template_id`. |
| Attach / Save | After **done**, the results header shows **status** beside the run name, then two panels: **Template** (left) and **Desk** (right). Template: `Template · {name}` or `No matching template`. Desk: `Desk · {desk} · {bot}` or `No matching desk bot` (info only). **Bot to replay** still uses the two badges. If any library template matches, **Attach to template** links the run (not only the loaded `source_template_id`). If already linked, **Results Attached**. If none match, **Save as template** opens a modal (name, folders). User save creates and links the run. Admins always see **Save as platform template** on a done run (catalog only, Starter Pack optional). It does not wait for a user save. Never auto-attach after an edit. A linked user template on `/account/templates` has a **Backtests** column: hover shows window, win rate, realized P&L, P&L on starting balance, ROE, and APR; **Open** opens the run in a new tab. If a desk bot already matches, **Go to Bot** opens that bot on Automations in a new tab. Otherwise **Add to desk** (does not require a saved template) opens a modal for desk + bot name and copies idle (never arm from a run). **Remove** sits next to **All backtests** in the title links (danger text). Public snapshot publish is parked. Queued / running / failed still show the match rows and hide save/attach. |
| Window | Explicit start/end dates. No day cap — 10 years is allowed. Any indicator timeframe (5m through Daily). Long tapes queue to the worker. Rejected only if the range needs more than **2,500,000** bars (safety ceiling). |
| Worker | Short jobs (≤3000 bars and ≤4 pairs) run in the request. Longer jobs stay `queued`. The engine cycle always ticks desks first. If time remains, it then claims one queued run (Fly: any length; Vercel: ≤3000). Opening a queued run also claims and executes that row so a busy desk wave cannot stall the queue. Stale `running` after 15 minutes is reclaimable. |
| Balance | Required `starting_balance_usdt` and **leverage** (form default **10**, stored on `backtest_runs`). Replay skips an entry when **margin** (notional ÷ leverage) + fee exceeds remaining cash (start + realized − locked margin). Empty field and old runs without leverage read as 1×. DCA **% of account** max value uses that same cash book (start + realized) at the **start of each cycle**. |
| DCA start | Replay treats legs as **armed** at the window start (Save and Arm). Immediate fires the first clip on the first close. **Both** never starts long and short on the same print, and does not open the other side while one position is still on. Immediate + Both takes Long first (Manual does not auto-hedge). Direction **Both** has two start sections (Long start / Short start): two prices, or two indicator When / level / timeframe rows. RSI 30 long does not imply RSI 30 short — short is its own level (default 70, crosses above). Legacy Both rows with one shared level are backfilled that way. |

## How it sits on templates

Add a third visibility: **`backtested`**.

| | User template | Platform template | **Backtested** template |
| --- | --- | --- | --- |
| What it is | Config to stamp on a desk | Same, admin-owned | Config **plus** a completed run |
| Apply to a desk | Idle / disabled, as today | Same | Same. Copy: “This was backtested. Enable on the desk yourself.” |
| Who sees it | Owner (+ shares) | Every member | Owner’s runs on `/account/backtests`. Public snapshot publish is parked. |
| Recipe | Unchanged parsers | Unchanged | Same recipe JSON. Fills live on `backtest_runs`, not in `recipe`. |

New table `backtest_runs`:

- `id`, `user_id` (null on leftover published copies)
- `template_id` (library row after Attach / Save; null on a fresh queue)
- `source_template_id` (library row they loaded from, if any)
- `desk_type` (`perps` \| `dca`) + `venue` + `symbol` + window + timeframe
- `status`: `draft` \| `queued` \| `running` \| `done` \| `failed` \| `cancelled`
- `starting_balance_usdt`
- `leverage` (form default 10; missing rows read as 1)
- `fee_preset` / `fee_rate`
- `stats` JSON, `orders` JSON (simulated only, source backtest)
- Immutable after `done` (updates only while queued/running). A re-run creates a new row.
- `study_id` (leftover from parked admin studies; user list hides these rows)
- `parent_run_id` (comparable children) and `comparable_symbols` (on the primary)
- `claimed_at` (worker lease)

Migrations: `supabase/migrations/20260830120000_backtest_runs.sql`, `supabase/migrations/20260830133000_bot_exits_and_dca_backtest.sql`, `supabase/migrations/20260830140000_backtest_starting_balance.sql`, `supabase/migrations/20260830150000_backtest_studies.sql`, `supabase/migrations/20260830160000_backtest_comparables_and_worker.sql`, `supabase/migrations/20260830170000_backtest_drafts_and_source.sql`, `supabase/migrations/20260901090000_backtest_leverage.sql`.

## Engine rules

- Perps replay uses `decideFuturesAutomationTick` on each bar close, then ticket exits on the same book.
- DCA replay uses `decideDcaTick` (same clip / percent-exit / breakeven math as live). Percent **stop** also fires on the adverse wick at the planned SL (same-bar stop wins versus percent TP on close). Disarm with qty still on the book becomes `stop_adding`, not a flatten.
- Signal / webhook When, webhook-start, or **manual** start: **rejected** at user queue time.
- Venue truth: Bybit klines for Bybit, HL candles for HL.
- Does not write `futures_orders` / paper carries.

## Shared with charts (plan A)

Same `<DeskChart>`, candle API, and overlay renderer. Backtest overlay source = `backtest_runs.orders` plus planned entry / TP / SL lines (from the open cycle, or the last closed cycle) and the When line (Perps only). Every fill is on the chart. Completed fills use Entry / Add / TP / SL / Trail / Close. Still-open clips use **Open long/short** (circle). Header and Performance stay realized only.

Replay still does **not** rest a GTC DCA grid, rest a limit TP, or persist trailing peak across clips. Indicator start uses an 80-bar warmup window. Position logs are synthesized from fills — replay does not write `event_logs` or `futures_*`.

## Out of scope (still)

- TV Strategy / webhook-only recipes.
- C&C, walk-forward, tick-level, Pine parity.
- Unbounded float sweeps or more than 96 scenarios (Fly job later).
- Admin studies / scenario grids (`/admin/backtests`). Parked until Click restarts that product.
- Chart trading.
- Writing simulated fills into the live blotter.
