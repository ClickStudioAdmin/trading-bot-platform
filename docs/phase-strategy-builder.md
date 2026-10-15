# Strategy Builder

Current V1 item. Started 14 Oct 2026. See [roadmap.md](roadmap.md).

## Purpose

Perps bots become a strategy the user builds from conditions. One playbook owns one contract and one side. The app places the first order, later adds, and the exit. Signals only arm. DCA and Cash and Carry move onto that same shape after the Perps bot does. This replaces the parked position builder / scale-in desk.

## Status

In progress. First step is the entry stack on Perps bots.

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Entry stack | Agent | Perps bots can add market conditions after the initial trigger, joined with And or Or. The same form is the desk bot, New Backtest, and replay Modify. The engine, replay, and parameter lists (bot, backtest, template) read that stack. A saved Secondary Entry opens as one And. |
| 2 | Exit stack | — | Hard Exit becomes the first row of an exit condition stack. Not started. |
| 3 | Additional exposure | — | Caps, size per add, and its own condition stack. Not started. |
| 4 | Position and pattern leaves | — | Breakeven-limit, price versus fill, impulse then pullback. Not started. |
| 5 | Other playbooks | — | DCA and Cash and Carry use the same stacks. Not started. |
| 6 | Full test | Click | Desk, backtest, and replay on the finished builder. Not started. |

## How the entry stack works

1. The initial order trigger stays Price cross, Indicator, Trend, or Signal webhook. It is condition 1 and has no joiner.
2. **Add condition** appends a market filter (Price vs EMA / SMA, RSI, Price vs BB, ATR band, or Supertrend). Each added row picks **And** or **Or**.
3. And stays in the current group. Or starts a new group. Groups are OR'd. Conditions inside a group are AND'd. Cap is 12 conditions and 4 timeframes, including the trigger.
4. A level that stays true still fires once, on the edge, the same way the bot fires today.
5. One And filter is still stored on the old confirm columns so an older reader sees the same Secondary Entry. Any other stack is `entry_expr` on `futures_automation_rules`. Templates and backtests store that stack on the recipe when the confirm column cannot hold it.
6. Close long / Close short do not take the stack.

## Out of this step

- Exit condition stack, additional exposure, position leaves, pattern leaves
- DCA and Cash and Carry
- A scripting language, nesting deeper than And-inside-Or, chart drawing, a general pattern scanner
- Multi-pair or virtual lots
- Create Platform Templates (V1 item 8)
