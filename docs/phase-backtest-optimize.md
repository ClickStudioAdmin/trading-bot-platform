# Consolidate back testing and optimization

Parked 6 Oct 2026. Not in the locked sequence ([roadmap.md](roadmap.md)). Do not start until Click picks it up. Backtesting that already ships stays [phase-backtesting.md](phase-backtesting.md).

## Purpose

One recipe form in three places. From a finished replay, edit that form and run again on the candles already loaded. The chart stays on screen.

## One form

The desk bot, New Backtest, and the replay panel render one recipe form. A new field, label, or validation change is made there once and shows in all three.

New Backtest and replay Optimize mount the desk forms (`components/dca-playbook-form.tsx`, `components/futures-rules-form.tsx`) through `components/bot-recipe-editor.tsx`. That mount hides Save, Arm, and the template sidebar, and it does not write a desk. A field change in the desk form is the same change on those two screens.

Each place keeps its own actions around the form:

- Desk: Save, Arm, and the template sidebar. The desk form can lock fields while a cycle is open.
- New Backtest: name, dates, balance, leverage, venue, comparables, and Queue sit in a Backtest Parameters section with the same header and collapse arrow as the other sections. The bot sections sit beside it with no outer card. Bot and Template sit in a Bot or Template section at the top of that column, and the section asks the user to select a bot or a template. Automations → Backtest selects that saved bot in the Bot list. When the user has no desk bots and no templates, that section shows an orange callout telling them to create a new Bot. Each list can be searched. Choosing one hides the other. Change, to the right of the chosen list, clears that choice, the bot sections, and Name. Changing the loaded recipe shows an Edited badge. Contract stays in General.
- Replay: Run, Reset, and Keep.

The panel matches the bot form sections, with the same labels and order. In that narrower column a row with one field spans the width, and Condition Type uses the cell width so the well stays inside the card. Selects and prefixed number fields keep the same gap under the label as a plain input. Flex is General, Long Entry, Short Entry when Direction is Both, Long Additional Orders, Short Additional Orders when that side is open, Long Exit, and Short Exit when that side is open. Those condition steps use the Condition Builder badge. Position Sizing sits at the bottom of each entry group, under a hairline after the conditions, and stays hidden until that group's Condition Type is selected. Group 1 then shows the size fields. Group 2 and later open with Same as Group 1 checked and show those fields only after it is cleared. Once those fields are visible they are required. A group that still uses Same as Group 1 does not require its own fields. Close long and Close short keep the Position Sizing step. DCA uses Additional Orders for that step, and Size unit and Order size sit at the bottom of each entry group, under the same hairline, with the same Same as Group 1 box. DCA Maximum Exposure (Max orders, Max value) sits in General. Flex Long Additional Orders Condition Builder and Short Additional Orders Condition Builder use entry group cards. Direction Both shows both. All, Long, and Short then sit at the top right of the form, with grey text. Long hides the short steps and Short hides the long steps. Shared steps stay, and the hidden steps stay in the form. Add Condition and Add Condition Group work in each section, and each group has Position Sizing once that group's Condition Type is selected. Those visible fields are required, including Limit price when Order is Limit. A group that still uses Same as Group 1 does not require its own fields. Group 2 and later open with Same as Group 1 checked. Those rows stay Off until the add is saved. Parameter lists title the sections Long Additional Orders and Short Additional Orders. Close long and Close short omit them. DCA Additional Orders stays Additional Order Types and Additional Order Scaling. Cash and Carry stays General, Entry Conditions, Position Sizing, and Exit Conditions. On New Backtest and replay Optimize, Name in Backtest Parameters is the backtest title. On New Backtest, choosing a bot or template leaves Name blank, and Generate Name copies the selected bot or template name. General on those two screens omits the bot name. Contract in General is the only pair field, and its options follow the venue in that section. Parameter lists on the replay, the report, templates, and the saved bot keep the saved order size under Position Sizing, with Market window first (including the backtest name). Extra entry groups are not saved. Those lists title the builder sections Long Entry Conditions, Short Entry Conditions, Long Exit Conditions, and Short Exit Conditions. On replay Optimize, the window fields sit in Backtest Parameters and those bot sections stack under it. Queue variant, Cancel, and the Edited badge stay in a pinned header. Queue variant stays disabled, and Edited stays hidden, until a field changes. Run, Reset, and Keep on candles already loaded are still parked. The embedded form does not arm a desk.

## Replay

A **Bot** button in the replay title row, beside the page-layout icon, opens a panel from the right edge of the replay frame. The sections stack in the panel. Run, Reset, and Keep sit at the bottom. The chart stays visible on the left, including in fill browser and full screen. Closing the panel leaves the draft in place.

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
