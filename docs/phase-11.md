# Phase 11 — DCA desk type

Complete. Phase 10 is complete. See [phase-10.md](phase-10.md). After Phase 11, see [roadmap.md](roadmap.md). Fly.io is next to build; scale-in / position builder is roadmap 7.

## Purpose

First managing playbook. The app owns orders and exits. Signals only arm. Same perp blotter and `runFuturesCommand`. Stacked playbooks on the desk (one per contract). Direction can be long, short, or both. Cannot stack scale-in or Perps recipes on that desk.

Paper Trading desks write the in-app ledger only. Connected Exchange desks use the existing Futures bind.

## Status

Complete. Accepted 27 Aug 2026. Click will keep desk-testing; treat the phase as done. `dca_playbooks` migrates on push to `develop`. If Automations errors on `breakeven_activation_pct`, push `20260827140000_dca_playbooks_advanced.sql`. If it errors on `take_profit_order_type`, push `20260827170000_dca_exit_order_types.sql`. If Save rejects a 30m–daily indicator timeframe, push `20260828080000_dca_indicator_timeframes.sql`. If it rejects RSI/EMA/MACD crosses (`cross_gte` / `cross_lte`), push `20260828090000_dca_indicator_crosses.sql`.

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | This file is the DCA desk. Master spec current phase is 11. Type `dca` added. Still `futures_*` + `runFuturesCommand`. Done |
| 2 | Playbook store | Agent | Stacked DCA playbooks per desk (one per contract). Direction long / short / both. Start, adds, exit, and per-side runtime. Done |
| 3 | Tick | Agent | Engine tick adds/closes through `runFuturesCommand`. Same caps, reduce-only, Close All & Cancel All. Auto badge + playbook name. Done |
| 4 | Signals | Agent | Manual arm. Bound Signal `arm` / `disarm` / `close-playbook`. Buy / sell arms that side only. Price, indicator, or immediate start. Done |
| 5 | UI | Agent | Create Desk → DCA. Type-locked chrome. Automations is grouped playbook cards (General / Start / Initial order / Maximum Exposure / Additional orders / Additional order multipliers / Take profit / Stop loss / Summary). Positions show Orders as filled/max. Done |
| 6 | Desk test | Click | Paper then Bybit Demo: arm, orders add, TP/stop, Close All & Cancel All, reduce-only. Cannot add a scale-in or Perps recipe on that desk. Done |

Phase accepted. Do not start Fly.io or scale-in until Click asks. Sequence: [roadmap.md](roadmap.md).

## How it works

1. Create a **DCA** desk. Type is immutable. Bind is the same Futures bind as Perps.
2. The desk owns stacked playbooks. Automations is that list (Add playbook, or Clone existing playbook). Clone opens an idle copy named with `(copy)`. One playbook per contract. Perps price-cross recipes stay on Perps desks only.
3. Direction is long, short, or both. Both opens two blotter rows that add independently and never flatten each other. Manual start uses Save and Trigger Long and Save and Trigger Short for that side.
4. Start is Immediate, price cross, a bound Signal webhook, or an indicator on public klines (RSI 14, MACD, EMA 9/21; 5m through daily). RSI can sit at a level or **cross** it. EMA is 9/21 cross or **EMA 21 crosses** a price (Long = above, Short = below). MACD can stay on histogram sign or **cross zero**. Direction **Both** splits the event: Long and Short never fire on the same print (MACD / EMA 9/21 by sign or pair cross; EMA 21 above→Long below→Short; RSI below→Long above→Short). Long or Short hides When options that do not apply. Immediate: Save writes the recipe. Save and Trigger Long / Save and Trigger Short save then place that side’s first order. Price, indicator, and webhook: idle uses Save and Save and Arm. Live uses Save; Arm resumes after Stop adding. Close returns to idle. Price/indicator then wait for the condition. Webhook: the bound Signal’s `arm` / buy / sell places the first order only after Arm. Idle recipes ignore the Signal.
5. Adds: order size (qty or USDT), max orders / max position value (USDT), then one averaging kind — add on price deviation or add on interval (minutes, hours, or days). Price deviation can place remaining orders as GTC limits instead of market. Saving a live playbook syncs those GTCs: market adds cancel them, a lower max cancels extras, dip/size changes amend what remains. Cancelling resting GTCs (Save to market, a lower max, or Close All) does not count as filling the cap. Switching to GTC rests remaining orders with one key per entry index **and this position** so a prior cycle’s filled Entry # 2 or # 14 cannot block the next rest. Save and the tick share that key. Live desks rest a few per tick, lowest Entry # first, and cancel extras at the same index; later ticks finish the ladder so Bybit is not flooded in one 60s engine run. Size and deviation multipliers scale later orders. Caps stop adding. They do not flatten. Save (and Arm / Trigger) is blocked in the form when any order is above the venue max qty, with an amber warning. Stop adding and Close playbook still run if the recipe is already over that cap.
6. Exit: take profit / stop vs average or first fill. Take profit can fill Market (default) or as a GTC limit. Stop is market only. GTC take profit is the close: the tick does not also flatten at market while that limit is resting. If the GTC is missing, cancelled, or rejected, the tick flattens at market. Save and the tick share one rest (stable key per position, extras cancelled). Cancelling that GTC drops the receipt so the next rest can place again. A leftover `working` receipt with no open GTC does not block the next rest. Limit take profit is the GTC: the tick does not call Bybit trading-stop every cycle just to keep that limit on the position row. After a partial fill, a larger add cancels the leftover and rests a new GTC for the full remaining qty instead of amending a reduce-only order up. Place/amend rejects write `dca.sync_failed`. First market order, flatten, and TP rest use stable keys so a retry does not double-place. Optional move-stop-to-breakeven and trailing on the existing row trailing engine. After adds, trailing distance refreshes from mark and only tightens. Stop loss never moves away from price (long: never lower; short: never higher). Positions show recipe prices faint until a limit is resting, then TP green / SL red. Saving a live playbook rests or cancels the TP GTC. Stop adding leaves the position. Close playbook flattens then returns to idle.
7. No Buy/Sell ticket. Each open row’s Close By is **Close Playbook** (same as Automations: flatten every side, cancel working playbook orders, idle). Positions panic is **Close All & Cancel All Open Orders** only (does not idle the playbook). After the position is gone, Manual start returns to idle so Save and Trigger Long / Short can open a new first order. Price / indicator / Signal stay armed and wait for the next start. Reduce-only, caps, and playbook TP/SL still protect. Positions show those levels read-only; faint is the recipe or a market exit, colour means a limit is resting. No Add/Edit on the row. No Market/Limit qty close, positions-only Close All, Cancel All Open Orders, or row Edit/Cancel on working limits. Open orders hide TP/SL and Trailing: those attach on the position, not each GTC. Reduce-only blocks new orders; TP/SL still run.
8. A Signal webhook only drives playbooks bound to it, and only after Arm. TradingView **Order** webhooks are not the brain on this desk. Buy / sell on that Signal starts that side only and does not send TV size.
9. The tick places orders and exits through `runFuturesCommand`. Take profit / stop sync before the entry ladder so a long grid dump cannot skip the GTC close. Opened rows show Auto plus the playbook name, plus Orders as filled/max. Open orders show Side (Buy/Sell) and Type (Entry #, Take Profit, Stop Loss, or Close), grouped by source then Entry #. A playbook rests one Take Profit GTC per side; extras are cancelled. Positions and Overview refresh the blotter while the tab is visible so fills and resting GTCs show without a reload.
10. Isolation is another desk **and** another trade-only key. Same-key warning copy from Phase 10 still applies.

## What this phase includes

- `desk_type = dca` on `trading_accounts`
- Create Desk can pick DCA
- Type-locked chrome: perp blotter, no ticket, no Perps recipes, Signal arm door. Desk-scoped URLs keep `?desk=` so two tabs can stay on different desks.
- Stacked playbook rows per desk (`dca_playbooks`, unique account + symbol)
- Tick orders and exits on `runFuturesCommand`
- Manual arm plus Phase 9 arm verbs, per-playbook Signal bind, buy/sell as side arm
- Automations grouped playbook form (Add playbook)
- Open blotter Orders column (filled/max)

## Out of scope

- Scale-in / position builder (roadmap 6)
- Chained Perps recipes
- `/strategies/dca` ledger
- Hyperliquid / MEXC / XT
- Fly.io (roadmap 1; not this phase)
- Calling private exchange APIs from the browser
- Paper auto-switch ([phase-auto-switch.md](phase-auto-switch.md))
- Later items on [roadmap.md](roadmap.md). Copy trading is started: [phase-copy-trading.md](phase-copy-trading.md).
