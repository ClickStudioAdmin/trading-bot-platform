# Desk roles — Manual vs Flex

Started 30 Aug 2026. Click asked to split manual ticket desks from bot desks so existing ticket books do not need a mixed retest. The ticket type is `manual` (shown as Manual). The bot type is `flex` (shown as Flex).

## Decision

- `manual` desks are **ticket only**. No Automations or Webhooks nav. Buy / Sell / Close stay.
- `flex` is automations only. Same `/strategies/futures` module and `futures_*` ledger. No buy / sell ticket. Close All still flattens. Signal webhooks stay as a When trigger on the bot. TradingView strategy alerts that place orders stay on TradingView Strategy. Flex templates (`desk_type = flex`, recipe `kind = flex`) apply only to `flex` desks.
- Sidebar: **Automated desks** (Flex, DCA, Cash and Carry, TradingView Strategy) and **Manual trading desks** (Manual, no extra type heading).

Shared keys still share venue margin. The split is job and UI, not isolation.

## Status

In repo. `20260830090000_perps_bots_desk_type.sql` added the bot type. `20261017150000_flex_manual_desk_types.sql` renames the ticket to `manual` and the bot type to `flex`.
