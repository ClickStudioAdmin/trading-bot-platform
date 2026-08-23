# Phase 5 — Trading accounts

## Purpose

Give each login one or more trading accounts. An account is Paper or Live at create and never changes. Rules, settings, positions, orders, and logs belong to that account only. Nothing is copied across accounts.

No Bybit orders. No exchange API keys. No Fly.io. No browser Bybit calls.

## Current micro-step

**Accounts + switcher**

Existing paper rows become the first Demo Account (paper). A second empty Paper account must share nothing with it. Live accounts can be created and can hold rules; the tick does not execute them.

## What shipped

- `trading_accounts` plus `account_id` on settings, rules, carries, orders, and event logs
- Backfill one Demo Account (paper) per member
- `tbp_account` cookie; account switch and manage link in the user menu
- `/account` manage area with a left nav. Manage sub-accounts is the first page. Create and delete live there. The last account cannot be deleted. Paper books can be deleted any time. Live delete is blocked while the book has open or closing positions or automations are on
- Tick loops accounts. Paper uses the Phase 4 ledger. Live is skipped

## Runtime

Same tick door as Phase 4 (`POST /api/engine/tick` and admin Tick). One Bybit public scan. Each **paper** account applies its own usable-book share and rules.

A Live account is a separate book for later execution. It must not receive `paper_carries` writes.

## Out of scope

- Bybit orders, encrypted keys, Fly.io, exchange demo
- Auto-switch
- Maker future ask
- Copy or convert accounts
- Mapping a TBP account onto a Bybit sub-account
