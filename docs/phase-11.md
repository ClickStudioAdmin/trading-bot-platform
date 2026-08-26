# Phase 11 — DCA desk type

Current. Phase 10 is complete. See [phase-10.md](phase-10.md).

## Purpose

First managing playbook. The app owns clips and exits. Signals only arm. Same perp blotter and `runFuturesCommand`. Stacked playbooks on the desk (one per contract and side). Cannot stack scale-in or Perps recipes on that desk.

Paper Trading desks write the in-app ledger only. Connected Exchange desks use the existing Futures bind.

## Status

Current. Agent steps 1–5 are in the tree. Wait for Click’s desk test. Do not mark accepted until that test. `dca_playbooks` migrates on push to `develop`.

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | This file is the DCA desk. Master spec current phase is 11. Type `dca` added. Still `futures_*` + `runFuturesCommand`. Done |
| 2 | Playbook store | Agent | Stacked DCA playbooks per desk (one per contract and side). Fields: clip size, max clips or max value, add-on-dip and/or add-on-interval, take profit / stop, “stop adding”. Done |
| 3 | Tick | Agent | Engine tick adds/closes through `runFuturesCommand`. Same caps, reduce-only, Close All. Auto badge + playbook name. Done |
| 4 | Signals | Agent | Manual arm. Phase 9 `arm` / `disarm` / `close-playbook` now run. A price-cross can arm or disarm (reuse the Phase 8 evaluator; action is not a second Buy brain). Done |
| 5 | UI | Agent | Create Desk → DCA. Type-locked chrome (no ticket, no Perps recipes, Signal arm door). Automations is stacked playbook cards plus Add playbook. Positions show Clip / Next add / Remaining. Done |
| 6 | Desk test | Click | Paper then Bybit Demo: arm, clips add, TP/stop, Close All, reduce-only. Cannot add a scale-in or Perps recipe on that desk. |

Stop at the end of this phase for a desk test. Do not start scale-in ([phase-12 is not written until this phase is accepted]).

## How it works

1. Create a **DCA** desk. Type is immutable. Bind is the same Futures bind as Perps.
2. The desk owns stacked playbooks. Automations is that list (Add playbook). One playbook per contract and side. Perps price-cross recipes stay on Perps desks only.
3. One symbol and one side. First clip places on Arm. Later clips fire on dip from the last clip, interval minutes, or whichever comes first. Empty dip and interval means one clip, then wait for TP/SL.
4. Caps (max clips and/or max value) stop adding. They do not flatten. Stop adding leaves the position. Close playbook flattens then returns to idle.
5. No Buy/Sell ticket. Close All, reduce-only, caps, and row TP/SL still protect. Reduce-only blocks new clips; TP/SL still run.
6. Signals arm, disarm (stop adding), or close every playbook on the desk. TradingView **Order** webhooks are not the brain on this desk. Signal webhooks are. Optional price-cross on each playbook form can arm or disarm.
7. The tick places clips and exits through `runFuturesCommand`. Opened rows show Auto plus the playbook name, plus Clip / Next add / Remaining.
8. Isolation is another desk **and** another trade-only key. Same-key warning copy from Phase 10 still applies.

## What this phase includes

- `desk_type = dca` on `trading_accounts`
- Create Desk can pick DCA
- Type-locked chrome: perp blotter, no ticket, no Perps recipes, Signal arm door
- Stacked playbook rows per desk (`dca_playbooks`, unique account + symbol + side)
- Tick clips and exits on `runFuturesCommand`
- Manual arm plus Phase 9 arm verbs
- Automations playbook list (Add playbook)
- Open blotter Clip / Next add / Remaining columns

## Out of scope

- Scale-in type
- Chained Perps recipes
- `/strategies/dca` ledger
- Hyperliquid / MEXC / XT
- Fly.io
- Calling private exchange APIs from the browser
- Paper auto-switch ([phase-auto-switch.md](phase-auto-switch.md))
