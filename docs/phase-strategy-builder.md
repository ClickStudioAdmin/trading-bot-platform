# Strategy Builder

Current V1 item. Started 14 Oct 2026. See [roadmap.md](roadmap.md).

## Purpose

Perps bots become a strategy the user builds from conditions. One playbook owns one contract. Direction is Long, Short, or Both when the exchange can hold both sides. The app places the first order, later adds, and the exit. Signals only arm. DCA and Cash and Carry move onto that same shape after the Perps bot does. This replaces the parked position builder / scale-in desk.

## Status

In progress. First step is the entry stack on Perps bots.

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Entry stack | Agent | Perps bots can add conditions after the initial trigger, joined with And or Or. Each added row uses the same trigger dropdown (Price cross, Indicator, Trend, or Signal webhook). Conflicting choices are disabled. Direction is Long, Short, or Both when the exchange hedges. Both uses two sections, Long entry and Short entry, each with its own trigger and stack. The same form is the desk bot, New Backtest, and replay Modify. The engine, replay, and parameter lists (bot, backtest, template) read that stack. A saved Secondary Entry opens as one And filter. |
| 2 | Exit stack | — | Hard Exit becomes the first row of an exit condition stack. Not started. |
| 3 | Additional exposure | — | Caps, size per add, and its own condition stack. Not started. |
| 4 | Position and pattern leaves | — | Breakeven-limit, price versus fill, impulse then pullback. Not started. |
| 5 | Other playbooks | Agent | DCA entry uses the same Add Condition stack as Perps. Cash and Carry is not started. |
| 6 | Full test | Click | Desk, backtest, and replay on the finished builder. Not started. |

## How the entry stack works

1. The initial order trigger stays Price cross, Indicator, Trend, or Signal webhook. It is condition 1 and has no joiner.
2. **Add condition** appends another trigger: Price cross, Indicator, Trend, or Signal webhook, with the same fields as the initial order trigger. Each added row picks **And** or **Or**.
3. And stays in the current group. Or starts a new group. Groups are OR'd. Conditions inside a group are AND'd. A dropdown choice that cannot be true in that group is disabled: the same webhook twice, two price crosses joined with And, or two webhooks joined with And. And itself is disabled when that join would create one of those. Cap is 12 conditions and 4 timeframes, including the trigger. A saved Secondary Entry still opens as its filter row.
4. A level that stays true still fires once, on the edge, the same way the bot fires today.
5. One And filter is still stored on the old confirm columns so an older reader sees the same Secondary Entry. Any other stack is `entry_expr` on `futures_automation_rules`. Templates and backtests store that stack on the recipe when the confirm column cannot hold it.
6. Close long / Close short do not take the stack. Those choices stay only on a bot that already closes.
7. Direction matches DCA: Long, Short, or Both. Both is hidden on a one-way exchange. Both keeps the long leg on the existing columns and the short leg in `short_entry`. Each side has its own section, trigger, and stack. The same webhook may arm both sides. Conflict rules stay inside one section.
8. DCA uses that same stack on Long entry and Short entry. Each side has its own Initial Order Trigger. One And filter still writes `confirm_*` / `short_confirm_*`. Any other stack is `entry_expr` / `short_entry_expr`. Cash and Carry is unchanged.

## Out of this step

- Exit condition stack, additional exposure, position leaves, pattern leaves
- Cash and Carry
- A scripting language, nesting deeper than And-inside-Or, chart drawing, a general pattern scanner
- Multi-pair or virtual lots
- Create Platform Templates (V1 item 8)
