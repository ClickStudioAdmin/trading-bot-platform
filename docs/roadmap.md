# Roadmap

Locked 29 Aug 2026. Click set the first order. Click reordered the commercial stack **11 Sep 2026**: old items 8 (plans) and 11 (payments + affiliates) are one phase at **item 5**. Do not reorder or implement a later item until Click starts that item. Backtesting moved to item 4 on 30 Aug 2026 (after copy trading). Charts sit in that same major phase.

Phases **1–11** are shipped. See [master-spec.md](master-spec.md) and [phase-11.md](phase-11.md). This file is the sequence **after** Phase 11. Write a phase doc when that item starts. Fly.io structure accepted: [phase-fly.md](phase-fly.md). Do not treat “Phase 12” as scale-in anymore.

Private exchange APIs stay on the server. The browser never sees decrypted keys. Paper desks stay on the in-app ledger.

Standing (unordered) desk-test and product notes: [click-list.md](click-list.md). Not a gate. Pick them up during later phases.

## Locked sequence

| # | Item | Notes |
| --- | --- | --- |
| 1 | **Fly.io engine worker** | Accepted and parked 29 Aug 2026: [phase-fly.md](phase-fly.md). Per-desk Postgres leases; Fly Sydney; Vercel stays UI. |
| 2 | **Second exchange: Hyperliquid** | Started 29 Aug 2026: [phase-hyperliquid.md](phase-hyperliquid.md). Venue-locked desks, capabilities registry, adapter, UI module. Bybit pages stay Bybit. Desk roles (Perps vs Perps bots) shipped during this item: [phase-desk-roles.md](phase-desk-roles.md). |
| 3 | **Copy trading** | Started 31 Aug 2026: [phase-copy-trading.md](phase-copy-trading.md). Follow another account’s fills onto the member’s bound desk. Not a venue adapter. Not a new desk type. |
| 4 | **Charts and backtesting** | Started 30 Aug 2026. Two plans, one kit. **A:** Positions **Chart** popup: [phase-charts.md](phase-charts.md). **B:** `/account/backtests` user tool: [phase-backtesting.md](phase-backtesting.md). Admin studies are parked. Perps bot ticket exits and DCA replay are in this item. Automations / Pairs / Activity chart buttons stay later. |
| 5 | **Plans, payments, and affiliates** | Combined old 8 + 11. Spec: [phase-membership.md](phase-membership.md). Steps 1–3 in repo (schema, `/admin/plans`, `/account/plans`). No Stripe until step 4. Upgrade UX / gates are step 10. |
| 6 | **Account and desk onboarding wizards; Starter Packs** | Refine `/welcome` and new-desk flow. Offer matching Starter Pack templates/folders (copy/apply idle, never arm). Plan: [phase-onboarding.md](phase-onboarding.md). |
| 7 | **Transactional notifications and email** | In-app and email for fills, sync failures, plan limits, failed payment, and similar. |
| 8 | **Internal (and maybe external) webhooks; event-driven bot signals** | Trigger bots/trades from our own events as well as inbound webhooks. Example: DCA playbook reaches 5 opens → signal a Perps desk bot to open a hedge. This is the cross-desk hedge path; not a separate “hedged DCA” desk type unless Click adds one later. |
| 9 | **Backup market data** | Consider failover when Bybit public klines fail (Binance/OKX public, then paid SLA if needed). Trading venue book stays truth for orders and for backtests. |
| 10 | **New desk type: position builder / scale-in** | Numbered desk type after Hyperliquid, copy, charts/backtest, and the commercial stack. Spec not written until this item starts. |
| 11 | **Front-end website content** | Marketing/public site, not the desk app chrome. |
| 12 | **Support system** | Member help (tickets or equivalent). |
| 13 | **Explainer videos and platform docs** | User-facing, distinct from these engineering phase files. |
| 14 | **Soft launch (beta testers)** | Invite testers after the above product surface exists. |
| 15 | **Other exchanges** | MEXC and further CEXes. Write `phase-mexc.md` (or equivalent) when this item starts. Not in the Hyperliquid pass. |

## Parked (not in this sequence)

Keep the docs; do not schedule unless Click adds them.

- **Paper auto-switch** — [phase-auto-switch.md](phase-auto-switch.md)
- **Hedged DCA as its own managing playbook** — cross-desk hedge is roadmap **8** unless Click wants a dedicated type
- **XT** — named in older out-of-scope lists; falls under roadmap 15 if ever chosen
- **Adaptive DCA filters and exits** — [phase-adaptive.md](phase-adaptive.md). Wave 1 (ATR spacing + ATR take profit) is on the playbook. Wave 2 + 2b (Confirm + Exit-if) are in progress. Stop after those waves. Wave 3 cooldown stays parked.
