# Phase 10 — Typed desks

Current. Phase 9 is complete. See [phase-9.md](phase-9.md).

## Purpose

The thing you create is a **Desk**. Type picks the UI and locks the manager. One bind per desk. Login → many desks. Do not nest Desk under Account.

Today one `trading_accounts` row can run both cash-and-carry and Futures. This phase **splits** those books.

Paper Trading desks write the in-app ledger only. Connected Exchange desks use the existing binds.

## Status

Current. Step 2 in progress (`desk_type` on the book).

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | This file is typed desks. Master spec current phase is 10. Nav word is Desks. |
| 2 | `desk_type` | Agent | Column on `trading_accounts`. Allowed: `cash_and_carry`, `perps`, `signal_follower`. Immutable after create (same as Paper/Live). Create Desk picks type. |
| 3 | Split dual books | Agent | A book with both C&C and Futures data becomes two desks. Ledgers stay on the matching desk id. Keys rebound with a same-key warning. One-strategy books just get that type. |
| 4 | Create Desk | Agent | Manage desks creates: name, mode, type, then Live bind. Copy warns that two desks on one key share venue margin. |
| 5 | Chrome | Agent | Header switcher says Desk. Nav Strategies → Desks. Perps shows Futures routes only. C&C shows C&C only. Signal follower shows perp blotter + webhook, hides the recipe form. |
| 6 | Bind | Agent | One bind on the desk. Ticket, header chip, balance, kill switch, TV door all use it. Desk A cannot place on Desk B. |
| 7 | Desk test | Click | Create a Perps desk and a C&C desk on one login. Each has its own bind. Split Demo book is usable. Shared-key warning visible. |

Stop at the end of this phase for a desk test. Do not start DCA ([phase-11 is not written until this phase is accepted]).

## Desk types

- **Cash and Carry** — current C&C UI and engine (spot + dated future).
- **Perps** — current Futures ticket, blotter, price-cross automations. Optional TradingView strategy door.
- **Signal follower** — same perp blotter. The webhook is the order. Desk only protects (caps, reduce-only, Close All, row TP/SL). No recipe form.

Perp types share `futures_positions` / `futures_orders` scoped to that desk id. Do not add `/strategies/dca` as a second ledger. Keep internal slugs (`futures`, `cash-and-carry`) if cheaper than `/desks/:id`.

Same venue key on two desks still shares IM. Isolation = another desk **and** another trade-only key.

## Later

- DCA desk type (Phase 11)
- Scale-in desk type (Phase 12)
- Richer Perps recipes (Phase 13)
- Live TradingView alert test ([phase-9.md](phase-9.md) Later)

## What this phase includes

- `desk_type` on `trading_accounts`
- Split dual-strategy books
- Create Desk: name, Paper/Live, type
- Nav and header say Desk / Desks
- Type-locked UI (one strategy surface per desk)
- Shared-key margin warning on create

## Out of scope

- DCA / scale-in types
- Richer if/then recipes
- Playbook-level venue override
- Hyperliquid / MEXC / XT
- Fly.io
- Calling private exchange APIs from the browser
- Paper auto-switch ([phase-auto-switch.md](phase-auto-switch.md))
- Nesting Desk under Account
