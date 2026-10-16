# Strategy Builder

Current V1 item. Started 14 Oct 2026. See [roadmap.md](roadmap.md).

## Purpose

Perps bots become a strategy the user builds from conditions. One playbook owns one contract. Direction is Long, Short, or Both when the exchange can hold both sides. The app places the first order, later adds, and the exit. Signals only arm. DCA and Cash and Carry move onto that same shape after the Perps bot does. This replaces the parked position builder / scale-in desk.

## Status

In progress. First step is the entry stack on Perps bots.

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Entry stack | Agent | Perps bots can add conditions after the initial trigger, joined with And or Or. Each added row uses the same trigger dropdown (Price cross, Indicator, Trend, or Signal webhook). Conflicting choices are disabled. Direction is Long, Short, or Both when the exchange hedges. Both uses two sections, Long Entry Condition Builder and Short Entry Condition Builder, each with its own trigger and stack. The same form is the desk bot, New Backtest, and replay Modify. The engine, replay, and parameter lists (bot, backtest, template) read that stack. Those lists title the sections Long Entry Conditions and Short Entry Conditions. A saved Secondary Entry opens as one And filter. |
| 2 | Exit stack | Agent | Long Exit Condition Builder and Short Exit Condition Builder replace the shared exit card on DCA and Perps. Parameter lists title them Long Exit Conditions and Short Exit Conditions. Top-level clauses join with Or. Condition Type is Take profit, Trailing stop, Stop loss, or Build Custom Conditions. One of each classic exit. Custom conditions inside a clause join with And. Another custom clause joins with Or. Each leg stores its own take profit, trailing stop, and stop loss. DCA short classics live in `short_classic`. Perps short classics live on `short_entry.classic`. A null short set still uses the long columns. Switching to Both does not copy a classic clause onto the other section. Custom conditions stay on `exit_if_*` / `exit_hard` / `exit_expr`. DCA short custom uses `short_exit_*`. Perps short custom is `short_entry.exit`. |
| 3 | Additional exposure | Agent | Perps Additional Orders is a condition builder. Condition Type opens on Select Condition Type: Indicator, Trend, Price Cross, or Signal Webhook. Size, Unit, and Order sit in that section. DCA Additional Orders stays the fixed averaging model. Caps, the condition stack, and saving these fields come later. |
| 4 | Position and pattern leaves | — | Breakeven-limit, price versus fill, impulse then pullback. Not started. |
| 5 | Other playbooks | Agent | DCA entry uses the same Add Condition stack as Perps. Cash and Carry is not started. |
| 6 | Full test | Click | Desk, backtest, and replay on the finished builder. Not started. |

## How the entry stack works

1. The Condition Type stays Price cross, Indicator, Trend, or Signal webhook. It is condition 1 and has no joiner.
2. **Add Condition** appends another trigger: Price cross, Indicator, Trend, or Signal webhook, with the same fields as the Condition Type. Each added row picks **And** or **Or**.
3. And stays in the current group. Or starts a new group. Groups are OR'd. Conditions inside a group are AND'd. A dropdown choice that cannot be true in that group is disabled: the same webhook twice, two webhooks joined with And, or two tests of one series that cannot be true together. A second price row stays available. At or above A and at or below B on the same price source are disabled only when A is higher than B. Opposite crosses, opposite sits, and a cross against the other side of the same MACD, RSI, moving average, Bollinger band, or Supertrend are disabled. And itself is disabled when that join would create one of those. Cap is 12 conditions and 4 timeframes, including the trigger. A saved Secondary Entry still opens as its filter row.
4. A level that stays true still fires once, on the edge, the same way the bot fires today.
5. One And filter is still stored on the old confirm columns so an older reader sees the same Secondary Entry. Any other stack is `entry_expr` on `futures_automation_rules`. Templates and backtests store that stack on the recipe when the confirm column cannot hold it.
6. Close long / Close short do not take the stack. Those choices stay only on a bot that already closes.
7. Direction matches DCA: Long, Short, or Both. Both is hidden on a one-way exchange. Both keeps the long leg on the existing columns and the short leg in `short_entry`. Each side has its own section, trigger, and stack. Switching Long or Short to Both does not copy or flip the other leg. The new section starts empty until it is configured. Switching Both back to one side keeps that side. The same webhook may arm both sides. Conflict rules stay inside one section. New Backtest and replay Modify open that saved bot with Direction Both and every condition on each builder.
8. DCA uses that same stack on Long Entry Condition Builder and Short Entry Condition Builder. Each side has its own Condition Type. One And filter still writes `confirm_*` / `short_confirm_*`. Any other stack is `entry_expr` / `short_entry_expr`. Cash and Carry is unchanged. Saved bot, backtest, and template lists title these sections Long Entry Conditions and Short Entry Conditions. New Backtest and replay Modify open each side's Condition Type and added conditions.

## How the exit stack works

1. Each open side has its own section: Long Exit Condition Builder or Short Exit Condition Builder. Direction Long shows the long section, Short shows the short section, and Both shows both. Close long and Close short hide them. Cash and Carry keeps its own Exit Conditions card. Saved bot, backtest, and template lists title the Perps and DCA sections Long Exit Conditions and Short Exit Conditions.
2. Clauses in a section join with Or. **Add Condition** adds another clause. Condition Type opens on Select Condition Type. The first options are Take profit, Trailing stop, and Stop loss, then Build Custom Conditions. One of each classic kind. A kind already chosen is disabled. Each leg stores its own take profit, trailing stop, and stop loss. Switching to Both does not copy a classic clause onto the other section. A section shows the clause only after it is added there, and editing a number changes that leg only. A saved Both bot with no short set still shows the long numbers on both sections until the next save writes the short set. Move Breakeven stays inside Stop loss. DCA and Perps keep their own fields. On one check, stop still wins, then the custom stack, then take profit.
3. Build Custom Conditions is one group: every condition in that group joins with And. The row is labeled Trigger and opens on Select Trigger: Price cross, Indicator, Trend, or Signal webhook. **Add Condition** inside the group appends another Trigger. Another custom group is another top-level Build Custom Conditions clause, joined with Or. The same conflict rules as entries apply, including RSI Between against a level outside that range, Bollinger outside against inside, and ATR above the upper band together with below the lower band. Cap is 12 custom conditions and 4 timeframes.
4. Entry and custom exit share one Indicator list: RSI, MACD, Price vs SMA, Price vs EMA, SMA Cross, EMA Cross, Price vs BB, and ATR band. Trend is Supertrend. Confirm keeps that list, then Supertrend.
5. When a custom group is true, the app market-flattens that side. A webhook that is only an And peer does not flatten by itself. The short side uses the long custom exit only when that side's custom exit is off.
6. The long take profit, trailing stop, and stop loss still write the existing columns. Direction Both writes the short set to `dca_playbooks.short_classic` or `short_entry.classic`. A classic clause with an empty price, percent, retracement, limit, or breakeven activation cannot be saved. The same check covers the other required fields: condition type, entry price, webhook, indicator level and period, size, and limit price. A custom anchor writes `exit_if_*` or `exit_hard`. Further rows in that group, and later custom groups, write `exit_expr`. DCA Both writes the short custom exit to `short_exit_*` and `short_exit_expr`. Perps Both writes the short custom exit on `short_entry.exit`. Empty custom stores null.

## How Perps additional orders work

1. DCA Additional Orders stays Additional Order Types and Additional Order Scaling. That model does not change.
2. Perps Additional Orders is its own step, after Position Sizing, when the bot is not closing. Condition Type opens on Select Condition Type. The options match the entry selector: Indicator, Trend, Price Cross, and Signal Webhook. Dependent fields, Add Condition, and And / Or groups come later.
3. Size, Unit, and Order sit in that step. Order is Market or Limit. Limit shows Limit price. These fields are not saved yet, so parameter lists and the saved bot configuration show Condition Type, Size, Unit, and Order as Off. Close long and Close short omit the step.

## Out of this step

- Confirm conditions on take profit, trailing stop, or stop loss, and further profit or loss trigger types
- Additional-order caps, the add condition stack, and saving those fields
- Position leaves, pattern leaves
- Cash and Carry
- A scripting language, nesting deeper than And-inside-Or, chart drawing, a general pattern scanner
- Multi-pair or virtual lots
- Create Platform Templates (V1 item 8)
