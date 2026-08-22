# Phase 3 — Paper blotter

## Purpose

Record paper cash-and-carry trades and show them on the strategy overview. No exchange orders. No user API keys. No engine worker.

A paper carry is long USDT spot and short the matching dated future, sized in USDT notional. P&L is the change in basis, not the coin’s direction.

## Current micro-step

**1 of 7 — Paper carry math** (complete)

Pure formulas and types. No auth or trade table yet.

## Micro-steps

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Paper carry math | Agent | `lib/paper` computes basis P&L, days held, realized APR. Checks pass |
| 2 | Sign-in | Agent + you | Supabase Auth session on the web app. You enable email auth on both TBP projects |
| 3 | Paper carries table | Agent | Migration with RLS by `user_id`. GitHub Actions applies on `develop` |
| 4 | Open paper carry | Agent | Signed-in user can open a paper carry from an opportunity. No Bybit order |
| 5 | Mark and close | Agent | Open carries mark from the live scan. Close writes realized P&L |
| 6 | Overview blotter | Agent | `/cash-and-carry` current trades, past trades, and desk stats use paper rows |
| 7 | Push `develop` | You + agent | Development Vercel shows the paper desk. Production unchanged until you merge |

Stop after each step.

## Formulas

- Unrealized / realized USDT = `(entry_basis − current_basis) × notional`
- Days held = `(closed_at − opened_at) / 86400000`
- Realized APR = `(realized / notional) × 365 / days held`

Entry and mark basis are the same net basis the scanner already uses. Do not mark on mid or last.

## Out of scope

- Bybit orders, encrypted keys, Fly.io engine
- Auto entry/exit or switching
- Calling Bybit from the browser
- Public signup beyond the desk accounts you create
