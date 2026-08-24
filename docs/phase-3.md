# Phase 3 — Paper blotter

## Purpose

Record paper cash-and-carry trades and show them on the strategy overview. No exchange orders. No user API keys. No engine worker.

A paper carry is long USDT spot and short the matching dated future, sized in USDT notional. P&L is the change in basis, not the coin’s direction. A desk can hold more than one open paper carry on the same pair.

## Status

Complete. Manual paper blotter is in use. Push any remaining Phase 3 commits on `develop` if they are not on GitHub yet.

Phase 6 is complete. Current work is Phase 7 — [phase-7.md](phase-7.md).

## Micro-steps

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Paper carry math | Agent | `lib/paper` computes basis P&L, days held, realized APR. Checks pass |
| 2 | Sign-in | Agent + you | Supabase Auth session on the web app. You enable email auth on both TBP projects |
| 3 | Paper carries table | Agent | Migration with RLS by `user_id`. GitHub Actions applies on `develop` |
| 4 | Open paper carry | Agent | Signed-in user can open a paper carry from an opportunity. No Bybit order |
| 5 | Mark and close | Agent | Open carries mark from the live scan. Close writes realized P&L. Done |
| 6 | Overview blotter | Agent | `/strategies/cash-and-carry` current trades, past trades, and desk stats use paper rows. Done |
| 7 | Push `develop` | You + agent | Development Vercel shows the paper desk. Production unchanged until you merge |

Stop after each step.

`/sign-in` is email/password. Create users in the dashboard. `/` and the scanner stay public.

`/strategies` lists strategies. `/strategies/cash-and-carry` is this strategy’s landing page. Related screens are `/strategies/cash-and-carry/opportunities` and `/strategies/cash-and-carry/pairs`.

## Formulas

- Unrealized / realized USDT = `(entry_net − current_net − 2 × fee_rate) × notional`
- P&L % = `unrealized / notional` (not annualized)
- `fee_rate` is the scan model: VIP0 taker on both legs + 5 bp slip + delivery (0 on USDT expiry)
- Days held = `(closed_at − opened_at) / 86400000`
- Realized APR = `(realized / notional) × 365 / days held`

Entry and mark basis are the same net basis the scanner already uses. Do not mark on mid or last. Because both numbers are already net, the dollar P&L subtracts the fee rate twice so open and close costs stay in the figure.

## Out of scope

- Bybit orders, encrypted keys, Fly.io engine
- Auto entry/exit or switching
- Calling Bybit from the browser
- Public signup beyond the desk accounts you create
