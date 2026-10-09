# Consolidate back testing and optimization

Parked 6 Oct 2026. Not in the locked sequence ([roadmap.md](roadmap.md)). Do not start until Click picks it up. Backtesting that already ships stays [phase-backtesting.md](phase-backtesting.md).

## Purpose

One recipe form in three places. From a finished replay, edit that form and run again on the candles already loaded. The chart stays on screen.

## One form

The desk bot, New Backtest, and the replay panel render one recipe form. A new field, label, or validation change is made there once and shows in all three.

New Backtest and replay Modify mount the desk forms (`components/dca-playbook-form.tsx`, `components/futures-rules-form.tsx`) through `components/bot-recipe-editor.tsx`. That mount hides Save, Arm, and the template sidebar, and it does not write a desk. A field change in the desk form is the same change on those two screens.

Each place keeps its own actions around the form:

- Desk: Save, Arm, and the template sidebar. The desk form can lock fields while a cycle is open.
- New Backtest: pair, dates, balance, leverage, comparables, and Queue. Picking a desk bot or a library template stays here.
- Replay: Run, Reset, and Keep.

The panel matches the bot form sections: General, Entry Conditions, Position Sizing, and Exit Conditions, with the same labels and order. Parameter lists on the replay and the report use that same order. Run, Reset, and Keep on candles already loaded are still parked. The embedded form does not arm a desk.

## Replay

A **Bot** button in the replay title row, beside the page-layout icon, opens a panel from the right edge of the replay frame. The four sections stack in the panel. Run, Reset, and Keep sit at the bottom. The chart stays visible on the left, including in fill browser and full screen. Closing the panel leaves the draft in place.

The panel opens with the recipe from the replay on screen. Pair, dates, and venue stay that run’s window.

1. Edit a field. Leaving the field stores the number. Run starts the simulation.
2. The server replays that recipe on the candles already loaded (`replayDcaPlaybook` / `replayPerpsPriceCross`). No exchange calls from the browser.
3. A short window finishes in the request and plays. A long window shows progress on the same chart and can be cancelled. The next Run cancels whatever is still going.
4. The title row shows P&L, win rate, and trade count, each against the opened run.
5. Reset puts the opened recipe back.
6. Keep is the only write. It stores a new `backtest_runs` row, named from the original, and that row becomes the baseline. The opened run stays as it was. Finished runs stay immutable.

An indicator timeframe change can require a new candle load. That still happens behind Run. Webhook and manual bots stay out.

Template, desk, and the full report stay on the report page after a run is kept.

## Out of this plan

- A parameter grid or an automatic search for the best inputs. Admin studies stay parked in [phase-backtesting.md](phase-backtesting.md).
- A second chart.
- Saving a row on every Run.
- Starting a backtest, or picking a bot or template, from the replay panel.
