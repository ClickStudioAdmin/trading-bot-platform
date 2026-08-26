# Phase 8 — Futures strategy on Bybit

Current. Phase 7 is complete. See [phase-7.md](phase-7.md).

## Purpose

Add a second strategy that buys, sells, or closes one USDT linear perpetual on Bybit. This is the vehicle for TradingView (Phase 9) and later venues. Cash-and-carry is unchanged.

Paper Trading books write the in-app ledger only. Connected Exchange books place a Bybit linear market or GTC limit from Sydney Vercel when a key is bound on **Futures** Strategy Settings.

## Status

In progress. Steps 1–3 are in code. Waiting on Click’s Bybit Demo desk test (step 4).

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs + registry | Agent | This file is the Futures strategy. Master spec lists two strategies. |
| 2 | Settings bind | Agent | `strategy_settings` holds the Futures bind. Cash-and-carry stays on `paper_engine_settings`. |
| 3 | Ledger + Bybit perp | Agent | `futures_positions` + `futures_orders` + working limits + TP/SL + trailing stop. Market or GTC limit. Checks pass. |
| 4 | Manual desk test | Click | Bybit Demo: Buy, Sell, Market Close (full and a slice), Limit Close, a Limit that rests, Edit, and Cancel, plus TP/SL and trailing stop on an order and on an open row, plus Close All, Cancel All Open Orders, and Close All & Cancel All Open Orders. Paper book writes the ledger only. |

Stop at the end of this phase for a Demo desk test. Do not start TradingView ([phase-9 is not written until this phase is accepted]).

## How a trade works

1. Book is Paper or Connected Exchange. Futures has its own bind (not the cash-and-carry bind).
2. Action is **Buy** (open or add long), **Sell** (open or add short), or **Close** on an open row (that side). Buy and Sell may be **Market** or **GTC Limit**. Close is **Market** or **Limit**. Both open a qty dialog (default is the whole row). Limit also sets price (reduce-only GTC). Edit remaining qty or limit on Open orders. Optional take profit / stop loss attaches to Buy and Sell, or can be set on an open row. Entire closes the whole size; Partial closes a qty on TP and a qty on SL. Optional trailing stop (retracement by distance, optional activation price) attaches the same way and closes the whole row at market.
3. A book may hold one open long and one open short on the same contract. Buy does not close a short. Sell does not close a long. Close the row you want closed.
4. Size is base-coin quantity, or USDT/USDC value converted at mark for market and at the limit price for limit. Both floor to the instrument step. Below minimum is rejected.
5. Live: server decrypts the Futures-bound key. Demo → `api-demo.bybit.com`. Market or GTC limit on `linear` in **hedge mode** (`positionIdx` 1 long / 2 short). Market Close is `reduceOnly`. Limit Close is a reduce-only GTC. Working limits, TP/SL, and trailing stops are polled on Positions load and on the paper engine tick. If the Bybit account is still one-way on that contract, opening the second side is rejected until the venue position is closed and the mode can switch.
6. Write `futures_positions` + `futures_orders` on this book only. Live books keep one open row per **symbol and side** and add size to that row. Paper does the same. Resting limits live on `futures_working_orders` until they fill or cancel. TP/SL and trailing stop live on the working row until fill, then on the position. Live trailing is set with Bybit `trading-stop` after the position exists (not on order create). Setting TP/SL re-sends the current trailing, and the reverse, so one does not cancel the other.
7. Reduce only (Futures settings) blocks Buy and Sell. Close still runs. Optional max value per symbol and max open positions reject Buy and Sell that would breach; Close is uncapped. The desk says Value, not notional.
8. Positions has **Close All** (market-close every open position; confirm `CLOSE ALL`), **Close All & Cancel All Open Orders** (cancel every working order, then close every position; confirm `CLOSE ALL`), and Open orders has **Cancel All Open Orders** (confirm `CANCEL ALL`). Each uses the same close or cancel path as the row buttons. Stops on the first error. The parent command may carry an idempotency key; child cancels and closes do not reuse it. Close All dialogs can optionally **Set reduce only** (book-wide Buy/Sell block) so size cannot come back. When Futures automations ship, that checkbox must also put automation-controlled rules into reduce only so they cannot reopen.
9. Desk clicks and later automations go through `runFuturesCommand`. Form server actions are thin adapters (session + redirect). An optional idempotency key is stored on `futures_command_receipts` and on working/order rows; live sends it to Bybit as `orderLinkId`. No webhook this phase.

## What this phase includes

- Strategy slug `futures` under `/strategies/futures` (overview, positions, automations, performance, settings, activity, pairs)
- `strategy_settings` for the Futures bind, reduce-only flag, and optional Buy/Sell max value and max open positions
- Single-leg blotter tables
- Manual Buy / Sell / Close on Bybit linear USDT perps
- Buy/Sell Market or GTC Limit. Close is Market or reduce-only GTC Limit; both take a qty (full or a slice). Open orders table + Edit remaining qty/limit + Cancel.
- Take profit / stop loss on Buy and Sell (market or limit), and add/edit on an open position. Last / Mark / Index trigger. Entire-position or partial market stops. Partial qty can differ on TP vs SL.
- Trailing stop on Buy and Sell (market or limit), and add/edit on an open position. Retracement by price distance. Optional activation price. Entire-position market close. Paper: SL, then trailing, then TP.
- Event logs with `strategy = futures`
- Typed `runFuturesCommand` for place / close / close-all / TP-SL / trailing / amend / cancel. Form actions are adapters. Optional idempotency key (Bybit `orderLinkId` on live). No webhook this phase.
- **Close All**, **Close All & Cancel All Open Orders**, and **Cancel All Open Orders**. Confirm `CLOSE ALL` or `CANCEL ALL`. Close All can optionally set reduce only. When automations ship, that option must also set those rules to reduce only.

## Out of scope

- TradingView webhooks (next phase)
- Hyperliquid wallets
- MEXC / XT / Binance adapters
- Post-only / maker
- Limit TP/SL orders
- Trailing stop by percentage
- Partial trailing qty
- Cash-and-carry automations copied onto Futures
- Fly.io
- Paper auto-switch ([phase-auto-switch.md](phase-auto-switch.md))
- Calling private exchange APIs from the browser
- Paper scan-venue picker (still wait until two venues can scan the same strategy)
