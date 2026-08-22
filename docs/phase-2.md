# Phase 2 — Scanner and Current Opportunities

## Purpose

Read-only dated cash-and-carry scan for Bybit USDT expiry. Show a Current Opportunities screen with executable basis, net APR, and capacity. No orders. No engine worker. No user API keys.

The web app may call **public** Bybit market endpoints from the server. It must not place orders. The browser is not trusted for prices or ranking.

## Current micro-step

**7 of 7 — Push `develop`** (complete)

Phase 2 is accepted. `develop` has the scanner and Current Opportunities UI. Production stays on `main` until you merge.

## Micro-steps

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Opportunity math | Agent | `lib/opportunities` computes executable basis, net basis, net APR, DTE. Checks pass |
| 2 | Bybit instruments | Agent | Server lists Bybit USDT expiry contracts and matching USDT spot. Universe is the six listed names |
| 3 | Books → opportunities | Agent | Each pair has bid/ask basis, fees model, net APR, depth capacity |
| 4 | Persist scan | Agent | `opportunities` migration. Server writes latest row per pair. GitHub Actions applies on `develop` |
| 5 | Current Opportunities UI | Agent | `/opportunities` uses the portal theme. Columns match the spec |
| 6 | Filters | Agent | Min net APR, DTE window, min capacity |
| 7 | Push `develop` | You + agent | Development Vercel shows the live book. Production unchanged until you merge |

Stop after each step. Phase 2 micro-steps are complete. Check the Vercel Development URL, then wait before merging to `main`.

## Universe

Bybit USDT expiry only: BTC, ETH, SOL, DOGE, XRP, MNT. Tenors with `deliveryTime ≠ 0` / `LinearFutures`. Pair to the same `baseCoin` USDT spot. Same venue. No perps. No cross-exchange.

## Formulas

- Executable basis = `(future_bid − spot_ask) / spot_ask`
- DTE = `(deliveryTime − now) / 86400000`
- Net basis = executable − fees − slippage − delivery fee (USDT expiry delivery fee is 0)
- Net APR = `net basis × 365 / DTE`
- Capacity = notional that stays inside the slippage budget (default 5 bps)

Never rank on mid or last price.

## Screen

`/strategies/universe` is the strategy home. `/strategies/universe/opportunities` is the full book with GET filters (min net APR %, min/max DTE, min capacity USDT). `/strategies/universe/pairs` is the instrument scan list. Theme tokens only. Top opportunities are a live scan. Current trades, past trades, and desk statistics are labeled placeholders until later phases place orders.

## Out of scope

- Auto entry/exit, switching, blotter, encrypted keys, Fly.io engine
- Perp funding, other venues
- Calling Bybit from the browser
