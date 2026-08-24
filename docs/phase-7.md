# Phase 7 — Live execution (manual)

## Purpose

Let a **Connected Exchange** book place cash-and-carry on the bound venue. First venue is Bybit. First slice is **manual Open and Close**. The tick still skips these books. Automations do not place exchange orders.

Orders run on **Sydney Vercel** (same host as trade-only verify). No Fly.io this phase. No private exchange calls from the browser.

Paper Trading books still use the Phase 4 paper ledger and never send exchange orders.

## Current micro-step

**5–6 of 6 — Manual Open and Close** (in progress, desk test next)

Code for docs, Bybit order helpers, bound-key load, fill columns, and manual Open/Close is in. The tick still skips Connected Exchange books. Wait for a `develop` migration and a Demo Open on your desk.

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | This file is live execution. Additional exchanges are [phase-8.md](phase-8.md). Master spec allows Sydney Vercel to place orders |
| 2 | Bybit private orders | Agent | Signed POST helper, qty-from-notional, fill parse. Checks pass. No live order in CI |
| 3 | Bound key load | Agent | Server decrypts only the bound connection. Ciphertext never goes to the browser |
| 4 | Fill columns | Agent | `paper_orders` migration for venue, environment, exchange order ids, fill qty/price. Actions apply on `develop` |
| 5 | Manual Open | Agent | Bound Connected Exchange book shows Size + Open. Both Bybit legs fill before the blotter row is written |
| 6 | Manual Close | Agent | Close flattens both Bybit legs, then writes the close clip. Unwind-to-book on the exchange is later |

Stop after each step. Do not start the next until you say so.

## How an open works

1. Book is Connected Exchange. Cash and Carry has a bound, active key.
2. Size is USDT notional, clipped to usable book (same as paper).
3. Server decrypts the bound key. Demo → `api-demo.bybit.com`. Production → `api.bybit.com`.
4. Qty is base-coin, rounded down to each instrument’s step. Same qty on both legs.
5. Market **buy spot**, then market **sell dated linear**. If the future fails, flatten the spot. If flatten fails, log and do not write an open carry.
6. Write `paper_carries` + `paper_orders` on this book only. Marks still come from the public scan. If an **open** row already exists for that pair, add size to it (weighted entry basis) instead of inserting a second row. Paper Trading books still allow more than one row per pair.

Close is the reverse: buy the linear to cover, sell the spot. If the spot sell fails, re-short the future to restore the hedge. Do not mark the carry closed unless both legs are flat.

## Ledger

Reuse `paper_carries` / `paper_orders`. A book is paper or live forever, so fills do not mix on one account. Live rows store venue, environment, and exchange order ids. On a Connected Exchange book the venue nets one position per pair, so the blotter does the same: later Opens add clips to the oldest open row for that pair. Do not add to a `closing` row. Duplicate live rows from before this rule stay until they Close.

## Out of scope

- Tick / automations placing Bybit orders
- Fly.io
- Second venue ([phase-8.md](phase-8.md))
- Paper auto-switch ([phase-auto-switch.md](phase-auto-switch.md))
- Maker / limit entry
- Unwind-to-book on the exchange
- Calling private APIs from the browser
