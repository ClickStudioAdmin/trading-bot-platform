# Phase 7 — Live execution

## Purpose

Let a **Connected Exchange** book place cash-and-carry on the bound venue. First venue is Bybit. Manual Open, Close, and Unwind, plus the engine tick (automations), place venue orders from **Sydney Vercel**. No Fly.io this phase. No private exchange calls from the browser.

Paper Trading books still use the Phase 4 paper ledger and never send exchange orders.

## Status

Complete. Accepted after desk testing on a Connected Exchange book with a Bybit Demo key. Phase 8 (additional exchanges) waits until you say so. See [phase-8.md](phase-8.md).

## Current micro-step

**7 of 7 — Automations and Unwind** (complete). Phase accepted.

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | This file is live execution. Additional exchanges are [phase-8.md](phase-8.md). Master spec allows Sydney Vercel to place orders |
| 2 | Bybit private orders | Agent | Signed POST helper, qty-from-notional, fill parse. Checks pass. No live order in CI |
| 3 | Bound key load | Agent | Server decrypts only the bound connection. Ciphertext never goes to the browser |
| 4 | Fill columns | Agent | `paper_orders` migration for venue, environment, exchange order ids, fill qty/price. Actions apply on `develop` |
| 5 | Manual Open | Agent | Bound Connected Exchange book shows Size + Open. Both Bybit legs fill before the blotter row is written |
| 6 | Manual Close | Agent | Close flattens both Bybit legs, then writes the close clip |
| 7 | Automations and Unwind | Agent | Tick places Bybit opens, adds, exits, and unwind clips on a bound book. Manual Unwind clips to usable book on the exchange |

Stop after each step. Do not start the next until you say so.

## How an open works

1. Book is Connected Exchange. Cash and Carry has a bound, active key.
2. Size is USDT notional, clipped to usable book (same as paper).
3. Server decrypts the bound key. Demo → `api-demo.bybit.com`. Production → `api.bybit.com`.
4. Qty is base-coin, rounded down to each instrument’s step. Same qty on both legs.
5. Market **buy spot**, then market **sell dated linear**. If the future fails, flatten the spot. If flatten fails, log and do not write an open carry.
6. Write `paper_carries` + `paper_orders` on this book only. Marks still come from the public scan. If an **open** row already exists for that pair, add size to it (weighted entry basis) instead of inserting a second row. Paper Trading books still allow more than one row per pair.

Close is the reverse: buy the linear to cover, sell the spot. If the spot sell fails, re-short the future to restore the hedge. Do not mark the carry closed unless both legs are flat.

Unwind (manual or Dynamic exit) is a partial close: qty is the remaining fill qty scaled by clip notional, floored to the instrument step. A clip that cannot size yet marks the row Closing and later ticks retry.

## Tick

The same `POST /api/engine/tick` loop now includes Connected Exchange books that have a bound, active key. Paper books are unchanged. A live book without a bind is skipped (no paper fills). Reduce only still blocks new automated entries and scale-ins; exits, clips, Unwind, and manual Open/Close still run.

If a venue open fills and the blotter write fails, the tick flattens that clip on the exchange.

## Ledger

Reuse `paper_carries` / `paper_orders`. A book is paper or live forever, so fills do not mix on one account. Live rows store venue, environment, and exchange order ids. On a Connected Exchange book the venue nets one position per pair, so the blotter does the same: later Opens (manual or engine) add clips to the oldest open row for that pair. Do not add to a `closing` row. Duplicate live rows from before this rule stay until they Close.

## Out of scope

- Fly.io
- Second venue ([phase-8.md](phase-8.md))
- Paper auto-switch ([phase-auto-switch.md](phase-auto-switch.md))
- Maker / limit entry
- Calling private APIs from the browser
