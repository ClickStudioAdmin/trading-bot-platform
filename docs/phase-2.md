# Phase 2 — Scanner and Current Opportunities

## Purpose

Read-only dated cash-and-carry scan for Bybit USDT expiry. Show a Current Opportunities screen with executable basis, net APR, and capacity. No orders. No engine worker. No user API keys.

The web app may call **public** Bybit market endpoints from the server. It must not place orders. The browser is not trusted for prices or ranking.

## Current micro-step

**1 of 7 — Opportunity math** (complete)

`lib/opportunities/math.ts` computes executable basis, net basis, net APR, and DTE. `npm test` passes. No Bybit HTTP yet.

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

Stop after each step.

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

`/opportunities` is the product home for this phase. Theme tokens only. Sample data is not allowed on the live page once step 3 exists.

## Out of scope

- Auto entry/exit, switching, blotter, encrypted keys, Fly.io engine
- Perp funding, other venues
- Calling Bybit from the browser
