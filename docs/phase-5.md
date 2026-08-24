# Phase 5 — Trading accounts

## Purpose

Give each login one or more trading accounts. An account is Paper or Live at create and never changes. Rules, settings, positions, orders, and logs belong to that account only. Nothing is copied across accounts.

No Bybit orders. No exchange API keys. No Fly.io. No browser Bybit calls.

## Status

Complete. Accepted after desk testing. Current work is Phase 7 — [phase-7.md](phase-7.md). Paper auto-switch is postponed — [phase-auto-switch.md](phase-auto-switch.md).

## What shipped

- `trading_accounts` plus `account_id` on settings, rules, carries, orders, and event logs
- Backfill one Demo Account (paper) per member
- `tbp_account` cookie; account switch and manage link in the user menu
- `/account` desk area with a left nav: Desk Overview, Settings, Manage sub-accounts (`/account/sub-accounts`); current book Overview (`/account/book`) and Exchanges. Desk Overview is login and books. Book Overview is positions, automations, and keys. Create, rename, and delete live on Manage sub-accounts. The last account cannot be deleted. Delete is blocked while the book has open or closing positions or automations are on
- Tick loops accounts. Paper uses the Phase 4 paper ledger. Live is skipped

## Runtime

Same tick door as Phase 4 (`POST /api/engine/tick` and admin **Tick**). One Bybit public scan. Each **paper** account applies its own usable-book share and rules.

A Live account is a separate book for later execution. It must not receive `paper_carries` writes.

## Out of scope (then)

- Bybit orders, encrypted keys, Fly.io, exchange demo
- Auto-switch (postponed — [phase-auto-switch.md](phase-auto-switch.md))
- Maker future ask
- Copy or convert accounts
- Mapping a TBP account onto a Bybit sub-account
