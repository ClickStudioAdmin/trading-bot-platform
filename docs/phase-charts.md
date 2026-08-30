# Charts (popup)

**Roadmap 4, plan A.** Not started. Pairs with [phase-backtesting.md](phase-backtesting.md). Shared chart kit; different homes. Do not build until Click starts this item.

## Purpose

Show a price chart **without changing desk layout**. First ship is a **popup** (modal) the user can close. If we do not like it, we remove the button and the modal — Positions, Automations, and Pairs stay as they are.

TradingView **alerts** stay webhooks. This is charts only.

## Locked for v1

- **Popup only.** No new pane, no split view, no sidebar chart, no moving the blotter.
- One contract at a time (focused row, or the picker symbol).
- Lightweight Charts (open source). Same component as Backtesting.
- Candles from **our** venue klines (server). Not the public TradingView embed (cannot draw our book). Not TradingView cloud as truth.
- Chart trading (place / amend from the pane) is out. Ticket and bots stay the source of truth.

## Shared kit (this plan + backtesting)

Build once, used in two places:

| Piece | Live popup | Backtest page |
| --- | --- | --- |
| Candle API (`desk-klines`, longer history) | Venue + symbol + timeframe | Same, plus from/to window |
| `<DeskChart>` (Lightweight Charts) | Yes | Yes |
| Overlay: working limits, TP/SL, trailing, entry | From **live** ledger | Off (sim book is the run) |
| Overlay: fill markers | From **live** `futures_orders` / paper fills | From **run** simulated orders |
| Overlay: bot trigger line | Optional, from the open automation | From the frozen recipe |
| Timeframe control | Same DCA set first | Same |

Do not fetch candles from the browser. Do not call private exchange APIs from the browser.

## Where the popup opens

| Surface | Button | Chart shows |
| --- | --- | --- |
| **Positions** | Chart on the focused open row (and on the ticket symbol if no row) | Entry, working limits, TP/SL/trailing, recent fills |
| **Automations** | Chart on that bot card | Candles + When price line (and indicator if the bot uses one) |
| **Pairs** | Chart on a pair row | Candles only (v1) |
| **Activity** | Chart on a fill | Jump to that time, mark that fill |
| **Backtests** | Chart on a finished run | Simulated fills + equity optional later |

C&C / basis charts stay parked until Perps popup is accepted.

## TradingView products (unchanged)

| Product | Fit |
| --- | --- |
| Embed widget | Reject. Cannot overlay our ledger. |
| Lightweight Charts | **v1.** |
| Advanced Charts (paid library) | Later only if Click takes a license. |

## Ship order (when this item starts)

1. Server OHLC API (Bybit + HL). Reuse `lib/market/desk-klines.ts`.
2. Shared `<DeskChart>` + overlay types (`live` \| `backtest`).
3. Popup shell (theme tokens, close, timeframe). No layout change around it.
4. Wire **Positions** first. Empty book still shows candles.
5. Live overlays: entry, working, TP/SL, fills.
6. **Stop.** Click tries it. Easy to rip out (button + modal + API).
7. If kept: Automations, then Pairs / Activity. Backtest page consumes the same chart (plan B).

## Out of scope

- Building now (Hyperliquid desk test is still current).
- Changing Current Positions / ticket / stats card layout.
- Chart as a permanent column or docked pane.
- Chart trading.
- C&C charts.
- MEXC.

## Open locks

1. Popup title: contract only, or contract + timeframe in the chrome?
2. Default timeframe (15m / 1h / D)?
3. After Positions, is Automations next or wait for Backtesting to reuse the chart?
