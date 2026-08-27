# Phase 11 — DCA desk type

Current. Phase 10 is complete. See [phase-10.md](phase-10.md).

## Purpose

First managing playbook. The app owns orders and exits. Signals only arm. Same perp blotter and `runFuturesCommand`. Stacked playbooks on the desk (one per contract). Direction can be long, short, or both. Cannot stack scale-in or Perps recipes on that desk.

Paper Trading desks write the in-app ledger only. Connected Exchange desks use the existing Futures bind.

## Status

Current. Agent steps 1–5 are in the tree. Wait for Click’s desk test. Do not mark accepted until that test. `dca_playbooks` migrates on push to `develop`.

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | This file is the DCA desk. Master spec current phase is 11. Type `dca` added. Still `futures_*` + `runFuturesCommand`. Done |
| 2 | Playbook store | Agent | Stacked DCA playbooks per desk (one per contract). Direction long / short / both. Start, adds, exit, and per-side runtime. Done |
| 3 | Tick | Agent | Engine tick adds/closes through `runFuturesCommand`. Same caps, reduce-only, Close All. Auto badge + playbook name. Done |
| 4 | Signals | Agent | Manual arm. Bound Signal `arm` / `disarm` / `close-playbook`. Buy / sell arms that side only. Price, indicator, or immediate start. Done |
| 5 | UI | Agent | Create Desk → DCA. Type-locked chrome. Automations is grouped playbook cards (General / Start / Initial order / Maximums / Additional orders / Additional order multipliers / Exit / Summary). Positions show Orders / Next add / Remaining. Done |
| 6 | Desk test | Click | Paper then Bybit Demo: arm, orders add, TP/stop, Close All, reduce-only. Cannot add a scale-in or Perps recipe on that desk. |

Stop at the end of this phase for a desk test. Do not start scale-in ([phase-12 is not written until this phase is accepted]).

## How it works

1. Create a **DCA** desk. Type is immutable. Bind is the same Futures bind as Perps.
2. The desk owns stacked playbooks. Automations is that list (Add playbook). One playbook per contract. Perps price-cross recipes stay on Perps desks only.
3. Direction is long, short, or both. Both opens two blotter rows that add independently and never flatten each other.
4. Start is Immediate, price cross, a bound Signal webhook, or an indicator on public klines (RSI 14, MACD, EMA 9/21; 5m / 15m / 1h). Arm enables. Immediate places the first order now. Other starts wait for the trigger. Webhook `arm` / buy / sell places the first order for the bound playbook.
5. Adds: order size (qty or USDT), max orders / max value, then one averaging kind — add on price deviation or add on interval. Price deviation can rest remaining orders as a GTC grid. Size and deviation multipliers scale later orders. Caps stop adding. They do not flatten.
6. Exit: take profit / stop vs average or first fill, optional move-stop-to-breakeven, optional trailing on the existing row trailing engine. Stop adding leaves the position. Close playbook flattens then returns to idle.
7. No Buy/Sell ticket. Close All, reduce-only, caps, and row TP/SL still protect. Reduce-only blocks new orders; TP/SL still run.
8. A Signal webhook only drives playbooks bound to it. TradingView **Order** webhooks are not the brain on this desk. Buy / sell on that Signal arms that side only and does not send TV size.
9. The tick places orders and exits through `runFuturesCommand`. Opened rows show Auto plus the playbook name, plus Orders / Next add / Remaining.
10. Isolation is another desk **and** another trade-only key. Same-key warning copy from Phase 10 still applies.

## What this phase includes

- `desk_type = dca` on `trading_accounts`
- Create Desk can pick DCA
- Type-locked chrome: perp blotter, no ticket, no Perps recipes, Signal arm door
- Stacked playbook rows per desk (`dca_playbooks`, unique account + symbol)
- Tick orders and exits on `runFuturesCommand`
- Manual arm plus Phase 9 arm verbs, per-playbook Signal bind, buy/sell as side arm
- Automations grouped playbook form (Add playbook)
- Open blotter Orders / Next add / Remaining columns

## Out of scope

- Scale-in type
- Chained Perps recipes
- `/strategies/dca` ledger
- Hyperliquid / MEXC / XT
- Fly.io
- Calling private exchange APIs from the browser
- Paper auto-switch ([phase-auto-switch.md](phase-auto-switch.md))
