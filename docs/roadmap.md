# Roadmap

Locked 29 Aug 2026. Click set this order. Do not reorder or implement a later item until Click starts that item.

Phases **1–11** are shipped. See [master-spec.md](master-spec.md) and [phase-11.md](phase-11.md). This file is the sequence **after** Phase 11. Write a phase doc when that item starts. Fly.io structure accepted: [phase-fly.md](phase-fly.md). Do not treat “Phase 12” as scale-in anymore.

Private exchange APIs stay on the server. The browser never sees decrypted keys. Paper desks stay on the in-app ledger.

Standing (unordered) desk-test and product notes: [click-list.md](click-list.md). Not a gate. Pick them up during later phases.

## Locked sequence

| # | Item | Notes |
| --- | --- | --- |
| 1 | **Fly.io engine worker** | Accepted and parked 29 Aug 2026: [phase-fly.md](phase-fly.md). Per-desk Postgres leases; Fly Sydney; Vercel stays UI. |
| 2 | **Second exchange: Hyperliquid** | Started 29 Aug 2026: [phase-hyperliquid.md](phase-hyperliquid.md). Venue-locked desks, capabilities registry, adapter, UI module. Bybit pages stay Bybit. Desk roles (Perps vs Perps bots) shipped during this item: [phase-desk-roles.md](phase-desk-roles.md). |
| 3 | **Copy trading** | Follow another account’s fills onto the member’s bound desk. Not a venue adapter. |
| 4 | **Internal (and maybe external) webhooks; event-driven bot signals** | Trigger bots/trades from our own events as well as inbound webhooks. Example: DCA playbook reaches 5 opens → signal a Perps desk bot to open a hedge. This is the cross-desk hedge path; not a separate “hedged DCA” desk type unless Click adds one later. |
| 5 | **Backup market data** | Consider failover when Bybit public klines fail (Binance/OKX public, then paid SLA if needed). Trading venue book stays truth for orders. |
| 6 | **New desk type: position builder / scale-in** | Numbered desk type after Hyperliquid and copy/signals. Spec not written until this item starts. |
| 7 | **Backtesting** | Replay a recipe on historical candles; blotter/stats, no placing. Consider TradingView charts in the same pass. |
| 8 | **Membership plans** | Levels with features and restrictions. Define the product gates before charging. |
| 9 | **Account and desk onboarding wizards; Starter Packs** | Refine `/welcome` and new-desk flow. Offer matching Starter Pack templates/folders (copy/apply idle, never arm). Plan: [phase-onboarding.md](phase-onboarding.md). |
| 10 | **Transactional notifications and email** | In-app and email for fills, sync failures, plan limits, and similar. |
| 11 | **Membership payments and affiliate system** | Charge for plans from item 8. Affiliates. |
| 12 | **Front-end website content** | Marketing/public site, not the desk app chrome. |
| 13 | **Support system** | Member help (tickets or equivalent). |
| 14 | **Explainer videos and platform docs** | User-facing, distinct from these engineering phase files. |
| 15 | **Soft launch (beta testers)** | Invite testers after the above product surface exists. |
| 16 | **Other exchanges** | MEXC and further CEXes. Write `phase-mexc.md` (or equivalent) when this item starts. Not in the Hyperliquid pass. |

## Parked (not in this sequence)

Keep the docs; do not schedule unless Click adds them.

- **Paper auto-switch** — [phase-auto-switch.md](phase-auto-switch.md)
- **Hedged DCA as its own managing playbook** — cross-desk hedge is roadmap 4 unless Click wants a dedicated type
- **XT** — named in older out-of-scope lists; falls under roadmap 16 if ever chosen
