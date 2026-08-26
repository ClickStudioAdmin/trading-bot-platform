# Phase 11 — DCA desk type

Current. Phase 10 is complete. See [phase-10.md](phase-10.md).

## Purpose

First managing playbook. The app owns clips and exits. Signals only arm. Same perp blotter and `runFuturesCommand`. One playbook per desk. Cannot stack scale-in or Perps recipes on that desk.

Paper Trading desks write the in-app ledger only. Connected Exchange desks use the existing Futures bind.

## Status

Current. Agent step 1 is in the tree (`dca` type, Create Desk, type-locked chrome). Playbook store, tick, and arming are next. Do not mark accepted until Click’s desk test.

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | This file is the DCA desk. Master spec current phase is 11. Type `dca` added. Still `futures_*` + `runFuturesCommand`. Done |
| 2 | Playbook store | Agent | One DCA config per desk (not a list of stacked playbooks). Fields: clip size, max clips or max value, add-on-dip and/or add-on-interval, take profit / stop, “stop adding”. |
| 3 | Tick | Agent | Engine tick adds/closes through `runFuturesCommand`. Same caps, reduce-only, Close All. Auto badge + playbook name. |
| 4 | Signals | Agent | Manual arm. Phase 9 `arm` / `disarm` / `close-playbook` now run. A price-cross can arm or disarm (reuse the Phase 8 evaluator; action is not a second Buy brain). |
| 5 | UI | Agent | Create Desk → DCA. Automations is the playbook form, not the Perps recipe list. Positions reuses the Futures table with DCA columns (Clip, Next add, Remaining budget) via `lib/futures/columns.ts`. Calendar / ladder in expand or on the card. |
| 6 | Desk test | Click | Paper then Bybit Demo: arm, clips add, TP/stop, Close All, reduce-only. Cannot add a scale-in or Perps recipe on that desk. |

Stop at the end of this phase for a desk test. Do not start scale-in ([phase-12 is not written until this phase is accepted]).

## How it works

1. Create a **DCA** desk. Type is immutable. Bind is the same Futures bind as Perps.
2. The desk owns one playbook. Automations is that form. Perps price-cross recipes stay on Perps desks only.
3. No Buy/Sell ticket. Close All, reduce-only, caps, and row TP/SL still protect.
4. Signals arm, disarm, or close the playbook. TradingView **Order** webhooks are not the brain on this desk. Signal webhooks are.
5. The tick places clips and exits through `runFuturesCommand`. Opened rows show Auto plus the playbook name.
6. Isolation is another desk **and** another trade-only key. Same-key warning copy from Phase 10 still applies.

## What this phase includes

- `desk_type = dca` on `trading_accounts`
- Create Desk can pick DCA
- Type-locked chrome: perp blotter, no ticket, no Perps recipes, Signal arm door
- One playbook row per desk
- Tick clips and exits on `runFuturesCommand`
- Manual arm plus Phase 9 arm verbs

## Out of scope

- Scale-in type
- Chained Perps recipes
- `/strategies/dca` ledger
- Hyperliquid / MEXC / XT
- Fly.io
- Calling private exchange APIs from the browser
- Paper auto-switch ([phase-auto-switch.md](phase-auto-switch.md))
