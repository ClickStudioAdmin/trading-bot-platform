# Strategy Builder

Current V1 item. Started 14 Oct 2026. See [roadmap.md](roadmap.md).

## Purpose

Perps bots become a strategy the user builds from conditions. One playbook owns one contract. Direction is Long, Short, or Both when the exchange can hold both sides. The app places the first order, later adds, and the exit. Signals only arm. DCA and Cash and Carry move onto that same shape after the Perps bot does. This replaces the parked position builder / scale-in desk.

## Status

In progress. First step is the entry stack on Perps bots.

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Entry stack | Agent | Perps bots can add conditions after the initial trigger, joined with And or Or. Each added row uses the same trigger dropdown (Price cross, Indicator, Trend, or Signal webhook). Conflicting choices are disabled. Direction is Long, Short, or Both when the exchange hedges. Both uses two sections, Long Entry Condition Builder and Short Entry Condition Builder, each with its own trigger and stack. The same form is the desk bot, New Backtest, and replay Modify. The engine, replay, and parameter lists (bot, backtest, template) read that stack. A saved Secondary Entry opens as one And filter. |
| 2 | Exit stack | Agent | Hard Exit is the first row of an Add Condition stack on DCA and Perps. Further rows use the same Hard Exit triggers and And or Or. The stack is still one closer that races with take profit, trailing stop, and stop loss. One Hard Exit stays on `exit_if_*` / `exit_hard`. Extra rows are `exit_expr` (`short_exit_expr` on DCA Both). |
| 3 | Additional exposure | — | Caps, size per add, and its own condition stack. Not started. |
| 4 | Position and pattern leaves | — | Breakeven-limit, price versus fill, impulse then pullback. Not started. |
| 5 | Other playbooks | Agent | DCA entry uses the same Add Condition stack as Perps. Cash and Carry is not started. |
| 6 | Full test | Click | Desk, backtest, and replay on the finished builder. Not started. |

## How the entry stack works

1. The Condition Type stays Price cross, Indicator, Trend, or Signal webhook. It is condition 1 and has no joiner.
2. **Add condition** appends another trigger: Price cross, Indicator, Trend, or Signal webhook, with the same fields as the Condition Type. Each added row picks **And** or **Or**.
3. And stays in the current group. Or starts a new group. Groups are OR'd. Conditions inside a group are AND'd. A dropdown choice that cannot be true in that group is disabled: the same webhook twice, two webhooks joined with And, or two tests of one series that cannot be true together. A second price row stays available. At or above A and at or below B on the same price source are disabled only when A is higher than B. Opposite crosses, opposite sits, and a cross against the other side of the same MACD, RSI, moving average, Bollinger band, or Supertrend are disabled. And itself is disabled when that join would create one of those. Cap is 12 conditions and 4 timeframes, including the trigger. A saved Secondary Entry still opens as its filter row.
4. A level that stays true still fires once, on the edge, the same way the bot fires today.
5. One And filter is still stored on the old confirm columns so an older reader sees the same Secondary Entry. Any other stack is `entry_expr` on `futures_automation_rules`. Templates and backtests store that stack on the recipe when the confirm column cannot hold it.
6. Close long / Close short do not take the stack. Those choices stay only on a bot that already closes.
7. Direction matches DCA: Long, Short, or Both. Both is hidden on a one-way exchange. Both keeps the long leg on the existing columns and the short leg in `short_entry`. Each side has its own section, trigger, and stack. The same webhook may arm both sides. Conflict rules stay inside one section.
8. DCA uses that same stack on Long Entry Condition Builder and Short Entry Condition Builder. Each side has its own Condition Type. One And filter still writes `confirm_*` / `short_confirm_*`. Any other stack is `entry_expr` / `short_entry_expr`. Cash and Carry is unchanged.

## How the exit stack works

1. Take profit, trailing stop, and stop loss stay as they are, including limit orders. Move Breakeven stays inside Stop loss. There is no join between those exits and Hard Exit. The first one that is met closes. On one check, stop still wins, then this Hard Exit stack, then take profit.
2. Hard Exit is condition 1 and has no joiner. **Add condition** appends Price cross, Indicator, Trend, or Signal webhook, with And or Or. The same conflict rules as entries apply. Hard Exit also disables RSI Between against a level outside that range, Bollinger outside against inside, and ATR above the upper band together with below the lower band. Cap is 12 conditions and 4 timeframes, including the first row.
3. Entry and Hard Exit share one Indicator list: RSI, MACD, Price vs SMA, Price vs EMA, SMA Cross, EMA Cross, Price vs BB, and ATR band. Trend is Supertrend. Confirm keeps that list, then Supertrend.
4. When the stack is true, the app market-flattens that side. A webhook that is only an And peer does not flatten by itself.
5. DCA Both has a Long section and a Short section. Short uses the long exit, including its stack, only when the short Hard Exit is off. Perps Both keeps one shared Hard Exit section.
6. A single Hard Exit still writes `exit_if_*` or `exit_hard`. Extra rows write `exit_expr` on the playbook or rule, and `short_exit_expr` for the DCA short section. Empty extra rows store null.

## Out of this step

- Confirm conditions on take profit, trailing stop, or stop loss, and further profit or loss trigger types
- Additional exposure, position leaves, pattern leaves
- Cash and Carry
- A scripting language, nesting deeper than And-inside-Or, chart drawing, a general pattern scanner
- Multi-pair or virtual lots
- Create Platform Templates (V1 item 8)
