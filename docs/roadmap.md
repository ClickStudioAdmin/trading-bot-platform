# Roadmap

Locked 29 Aug 2026. Click set the first order. Click reordered the commercial stack **11 Sep 2026**: old items 8 (plans) and 11 (payments + affiliates) are one phase at **item 5**. Click split membership steps 9–11 into their own phase and moved notifications ahead **16 Sep 2026**. Click moved the plan-gate phase to **item 7** (after notifications, before onboarding) and added identity (email verification + optional 2FA) **16 Sep 2026**. Do not reorder or implement a later item until Click starts that item. Backtesting moved to item 4 on 30 Aug 2026 (after copy trading). Charts sit in that same major phase.

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
| 5 | **Plans, payments, and affiliates** | Combined old 8 + 11. Spec: [phase-membership.md](phase-membership.md). **Closed at step 8** (16 Sep 2026). Schema, plan pages, Stripe + `/account/billing`, two USD books, unique EVM deposits, affiliate admin/portal/commissions. Entitlements / plan gates moved to item 7. |
| 6 | **Transactional notifications and email** | Started 16 Sep 2026: [phase-notifications.md](phase-notifications.md). FQX-style inbox + computed badges + Resend. Billing, affiliate, copy invites, critical desk failures. **No fills** this pass. Admin roles postponed to a later parked phase. |
| 7 | **Entitlements, identity, and plan gates** | Was membership steps 9–11, then roadmap 8. Moved after notifications **16 Sep 2026**. Spec: [phase-entitlements.md](phase-entitlements.md). Step 1 in repo (verify + forgot password + verify wall). `/welcome` wizard removed in that step; new users land on Overview after verify. 2FA, Upgrade gates, and downgrade grace stay later. Stop after each micro-step. |
| 8 | **Account and desk onboarding wizards; Starter Packs** | Reimagine later. The first-desk `/welcome` wizard is gone; verified new users land on Overview and create a desk from Manage desks when they want. Plan: [phase-onboarding.md](phase-onboarding.md). |
| 9 | **Internal (and maybe external) webhooks; event-driven bot signals** | Trigger bots/trades from our own events as well as inbound webhooks. Example: DCA playbook reaches 5 opens → signal a Perps desk bot to open a hedge. This is the cross-desk hedge path; not a separate “hedged DCA” desk type unless Click adds one later. |
| 10 | **Backup market data** | Consider failover when Bybit public klines fail (Binance/OKX public, then paid SLA if needed). Trading venue book stays truth for orders and for backtests. |
| 11 | **New desk type: position builder / scale-in** | Numbered desk type after Hyperliquid, copy, charts/backtest, and the commercial stack. Spec not written until this item starts. |
| 12 | **Front-end website content** | Marketing/public site, not the desk app chrome. |
| 13 | **Support system** | Member help (tickets or equivalent). |
| 14 | **Explainer videos and platform docs** | User-facing, distinct from these engineering phase files. |
| 15 | **Soft launch (beta testers)** | Invite testers after the above product surface exists. |
| 16 | **Other exchanges** | MEXC and further CEXes. Write `phase-mexc.md` (or equivalent) when this item starts. Not in the Hyperliquid pass. |

## Parked (not in this sequence)

Keep the docs; do not schedule unless Click adds them.

- **Paper auto-switch** — [phase-auto-switch.md](phase-auto-switch.md)
- **Hedged DCA as its own managing playbook** — cross-desk hedge is roadmap **9** unless Click wants a dedicated type
- **XT** — named in older out-of-scope lists; falls under roadmap 16 if ever chosen
- **Adaptive DCA filters and exits** — [phase-adaptive.md](phase-adaptive.md). Wave 1 (ATR spacing + ATR take profit) is on the playbook. Wave 2 + 2b (Confirm + Exit-if) are in progress. Stop after those waves. Wave 3 cooldown stays parked.
- **Admin roles** — [phase-admin-roles.md](phase-admin-roles.md). Was notifications 7a. Click postponed 16 Sep 2026. Operator mail stays every admin until this phase.
