# Desk roles — Perps vs Perps bots

Started 30 Aug 2026. Click asked to split manual ticket desks from bot desks so existing Perps books do not need a mixed retest.

## Decision

- Existing `perps` desks stay **ticket only**. No Automations or Webhooks nav. Buy / Sell / Close stay. Click cleared orders, positions, and bots on those desks before this landed.
- New type `perps_bots` (**Perps bots**) is automations only. Same `/strategies/futures` module and `futures_*` ledger. No buy / sell ticket. Close All still flattens. TradingView alerts stay on TradingView Strategy. Perps bot templates (`desk_type = perps`) apply only to `perps_bots` desks.
- Sidebar: **Automated desks** (Cash and Carry, TradingView Strategy, DCA, Perps bots) and **Manual trading desks** (Perps, no extra type heading).

Shared keys still share venue margin. The split is job and UI, not isolation.

## Status

In repo. Migration `20260830090000_perps_bots_desk_type.sql` allows the new type. Existing `perps` rows are unchanged.
