# Charts (popup)

**Roadmap 4, plan A.** Positions popup is **in repo**. Pairs with [phase-backtesting.md](phase-backtesting.md). Shared chart kit; different homes.

## Purpose

Show a price chart **without changing desk layout**. First ship is a **popup** (modal) the user can close. If we do not like it, we remove the button and the modal — Positions, Automations, and Pairs stay as they are.

TradingView **alerts** stay webhooks. This is charts only.

## Locked for v1

- **Popup only.** No new pane, no split view, no sidebar chart, no moving the blotter.
- One contract at a time (focused row, or the picker symbol).
- Lightweight Charts (open source). Same component as Backtesting.
- Candles from **our** venue klines (server). Not the public TradingView embed (cannot draw our book). Not TradingView cloud as truth.
- Chart trading (place / amend from the pane) is out. Ticket and bots stay the source of truth.
- **Default timeframe:** 1h. Title is contract + timeframe.
- Positions only for the live popup. Automations / Pairs / Activity wait.

## Shared kit (this plan + backtesting)

| Piece | Live popup | Backtest page |
| --- | --- | --- |
| Candle API (`/api/market/candles`, `loadDeskCandles` / ranged `loadBacktestCandles`) | Venue + symbol + timeframe (last 1,500) | Same, plus from/to window (full activity, paged) |
| `<DeskChart>` (Lightweight Charts) | Yes | Yes |
| Overlay: working limits, TP/SL, trailing, entry | From **live** ledger | Planned entry / TP / SL from the open cycle (or last closed) |
| Overlay: fill markers | From **live** `futures_orders` | From **run** simulated orders (Entry / Add / TP / SL / Close) |
| Overlay: bot trigger line | Not on Positions | From the frozen recipe |
| Timeframe control | 15m / 1h / 4h / D | Same set on the finished-run charts, plus the run’s own TF. Display only. |

Do not fetch candles from the browser venue APIs. Do not call private exchange APIs from the browser. The popup reads our public candle route.

## Where the popup opens

| Surface | Status |
| --- | --- |
| **Positions** (Bybit + Hyperliquid) | **Shipped.** Chart on Current Positions heading. Empty book still charts the default contract. |
| **Automations** | Not wired. |
| **Pairs** | Not wired. |
| **Activity** | Not wired. |
| **Backtests** | Chart on a finished run (plan B). |

C&C / basis charts stay parked.

## Ship order

1. Server OHLC API (Bybit + HL). Reuse `lib/market/desk-klines.ts`. **Done.**
2. Shared `<DeskChart>` + overlay types. **Done.**
3. Popup shell (theme tokens, close, timeframe). **Done.**
4. Wire **Positions**. **Done.**
5. Live overlays: entry, working, TP/SL, fills. **Done.**
6. **Stop for live popup.** Automations / Pairs / Activity later if Click keeps the popup.
7. Backtest page consumes the same chart (plan B). **Done.**

## Out of scope

- Changing Current Positions / ticket / stats card layout.
- Chart as a permanent column or docked pane.
- Chart trading.
- C&C charts.
- MEXC.

## Files that are easy to rip out

- `components/desk-chart.tsx`
- `components/positions-chart-button.tsx`
- `lib/charts/overlay.ts` (+ check)
- `app/api/market/candles/route.ts`
- `lib/market/candles.ts` (+ check)
- Chart button on the two Positions headings
- `lightweight-charts` in `package.json` (keep if Backtesting stays)
