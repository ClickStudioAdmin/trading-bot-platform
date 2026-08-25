# Phase 8 — Futures strategy on Bybit

Current. Phase 7 is complete. See [phase-7.md](phase-7.md).

## Purpose

Add a second strategy that buys, sells, or flattens one USDT linear perpetual on Bybit. This is the vehicle for TradingView (Phase 9) and later venues. Cash-and-carry is unchanged.

Paper Trading books write the in-app ledger only. Connected Exchange books place a single Bybit linear market order from Sydney Vercel when a key is bound on **Futures** Strategy Settings.

## Status

In progress. Steps 1–3 are in code. Waiting on Click’s Bybit Demo desk test (step 4).

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs + registry | Agent | This file is the Futures strategy. Master spec lists two strategies. |
| 2 | Settings bind | Agent | `strategy_settings` holds the Futures bind. Cash-and-carry stays on `paper_engine_settings`. |
| 3 | Ledger + Bybit perp | Agent | `futures_positions` + `futures_orders`. One linear market order per action. Checks pass. |
| 4 | Manual desk test | Click | Bybit Demo: Buy, Sell, Flatten. Paper book writes the ledger only. |

Stop at the end of this phase for a Demo desk test. Do not start TradingView ([phase-9 is not written until this phase is accepted]).

## How a trade works

1. Book is Paper or Connected Exchange. Futures has its own bind (not the cash-and-carry bind).
2. Action is **Buy** (open or add long), **Sell** (open or add short), or **Flatten** on an open row (close that side).
3. A book may hold one open long and one open short on the same contract. Buy does not close a short. Sell does not close a long. Flatten the row you want closed.
4. Size is base-coin quantity, or USDT/USDC notional converted at mark. Both floor to the instrument step. Below minimum is rejected.
5. Live: server decrypts the Futures-bound key. Demo → `api-demo.bybit.com`. Market order on `linear` in **hedge mode** (`positionIdx` 1 long / 2 short). Flatten is `reduceOnly`. If the Bybit account is still one-way on that contract, opening the second side is rejected until the venue position is flat and the mode can switch.
6. Write `futures_positions` + `futures_orders` on this book only. Live books keep one open row per **symbol and side** and add size to that row. Paper does the same.
7. Reduce only (Futures settings) blocks Buy and Sell. Flatten still runs.

## What this phase includes

- Strategy slug `futures` under `/strategies/futures` (overview, positions, automations, performance, settings, activity, pairs)
- `strategy_settings` for the Futures bind and reduce-only flag
- Single-leg blotter tables
- Manual Buy / Sell / Flatten on Bybit linear USDT perps
- Event logs with `strategy = futures`

## Out of scope

- TradingView webhooks (next phase)
- Hyperliquid wallets
- MEXC / XT / Binance adapters
- Cash-and-carry automations copied onto Futures
- Maker / limit
- Fly.io
- Paper auto-switch ([phase-auto-switch.md](phase-auto-switch.md))
- Calling private exchange APIs from the browser
- Paper scan-venue picker (still wait until two venues can scan the same strategy)
