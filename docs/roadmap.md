# Roadmap

Click locked this V1 / V2 split **16 Sep 2026**. Do not reorder V1 or start a later V1 item until Click says go. V2 has **no order** — do not start any V2 item until Click picks one.

Phases **1–11** are shipped. See [master-spec.md](master-spec.md) and [phase-11.md](phase-11.md). Older phase files still say “roadmap 2” / “roadmap 5”; those numbers are historical. **This file is the plan.**

Private exchange APIs stay on the server. The browser never sees decrypted keys. Paper desks stay on the in-app ledger.

Standing desk-test notes: [click-list.md](click-list.md). Work them during V1 system test or whenever Click picks one up. Not a gate.

## Shipped (not V1 work)

Keep building on these; do not reopen them as a phase unless Click asks.

| Item | Notes |
| --- | --- |
| Phases 1–11 | Desk product: C&C, Perps / Perps bots, TradingView Strategy, DCA |
| Fly.io engine worker | Accepted: [phase-fly.md](phase-fly.md) |
| Hyperliquid venue | Adapter and UI in repo: [phase-hyperliquid.md](phase-hyperliquid.md). Leftover desk-test is V1 system test |
| Copy trading | Steps 1–9 in repo: [phase-copy-trading.md](phase-copy-trading.md). Leftover desk-test is V1 system test |
| Charts and member backtests | [phase-charts.md](phase-charts.md), [phase-backtesting.md](phase-backtesting.md) |
| Plans, payments, affiliates | Closed at step 8: [phase-membership.md](phase-membership.md) |
| Notifications and Resend | Steps 1–8 in repo: [phase-notifications.md](phase-notifications.md) |

## Current (V1 item 4)

**Account Positions, Bots, and Automations lists.** Started 21 Sep 2026. Work only what Click asks. Spec: [phase-account-blotter.md](phase-account-blotter.md). Isolation already shipped in item 3 — this item is the directory UI only.

**In progress**

- Desk Automations (C&C, Perps bots, DCA): Theme table of bots, Create / Template / Clone on the toolbar, View/Edit opens the existing bot form (`?edit=`). `#bot-…` still opens that form. Automations is the first desk tab; Positions is second.

**Still locked / do not start until Click asks**

- Account-wide Positions and Bots sidenav lists.
- Virtual lots / same-pair stacking / mixed desk types. Typed desks stay one type, one bind, one UI. Virtual deals stay V2.
- Entitlements / plan gates (item 5) and onboarding (item 6).

## V1 (locked order)

Stop after each item until Click says go.

| # | Item | Notes |
| --- | --- | --- |
| 1 | **Identity** | **Accepted 17 Sep 2026.** Email verify on signup + forgot password + unverified wall. Wizard removed; new users land on Overview after confirm. Spec: [phase-entitlements.md](phase-entitlements.md) (identity slice). |
| 2 | **2FA** | **Accepted 17 Sep 2026.** Settings enroll + sign-in challenge only. Google Authenticator TOTP, recovery codes shown once. **Not** a plan gate yet. Spec: [phase-2fa.md](phase-2fa.md). |
| 3 | **UI refinement and cleanup** | **Accepted 21 Sep 2026.** Light is live (chrome vs content). Isolation shipped 19 Sep 2026. Breadcrumbs on orphans. `/account/book` removed. |
| 4 | **Account Positions, Bots, and Automations lists** | **Current.** Started 21 Sep 2026. Spec: [phase-account-blotter.md](phase-account-blotter.md). Isolation already in repo (item 3). Desk Automations list first; account Positions / Bots wait until Click asks. Virtual lots stay V2. |
| 5 | **Entitlements and plan / 2FA gates** | `assertEntitlement`, visible/disabled + Upgrade, a plan may require verified email and/or 2FA, downgrade grace. Spec: [phase-entitlements.md](phase-entitlements.md) (gates). |
| 6 | **Onboarding wizards and Starter Packs** | Reimagine first-run and new-desk. Starter Packs copy/apply idle, never arm. Spec: [phase-onboarding.md](phase-onboarding.md). |
| 7 | **Full system test and refinement** | Whole product, **including Hyperliquid** leftover desk-test and copy leftover desk-test. Fix what Click finds. Not a new feature phase. |
| 8 | **Front-end website** | Marketing / public site, not desk chrome. |
| 9 | **Invite friends to test** | Closed testers before the public soft launch. |
| 10 | **Explainer videos, docs, support** | User-facing help (videos, platform docs, tickets or equivalent). Distinct from these engineering phase files. |
| 11 | **Soft launch / beta and promote affiliates** | Public beta. Push the affiliate program. |

## V2 (consideration, no order)

Parked or not in V1. Keep the docs. Click picks the next one when V1 is done (or earlier if they say so).

- **Internal (and maybe external) webhooks; event-driven bot signals** — cross-desk hedge path (example: DCA 5 opens → Perps bot hedge)
- **Backup market data** — failover when Bybit public klines fail ([master-spec.md](master-spec.md))
- **New desk type: position builder / scale-in**
- **Other exchanges** — MEXC, XT, further CEXes. Write `phase-mexc.md` (or equivalent) when that item starts
- **Admin roles** — [phase-admin-roles.md](phase-admin-roles.md). Operator mail stays every admin until then
- **Paper auto-switch** — [phase-auto-switch.md](phase-auto-switch.md)
- **Hedged DCA as its own managing playbook** — unless Click wants it instead of the webhook path
- **Adaptive DCA wave 3 (cooldown)** — [phase-adaptive.md](phase-adaptive.md). Waves 1–2 are on the playbook
- **Admin backtest studies / research wizard** — [phase-backtesting.md](phase-backtesting.md)
- **More chart homes** — Automations / Pairs / Activity chart buttons
- **Change-email flow**
- **SMS 2FA, passkeys, WebAuthn**
- **Fill / blotter notification catalog**
- **Bybit TradFi** — [click-list.md](click-list.md)
- **Public member template catalog**
- **Multi-pair / virtual-size / virtual lots** — 3Commas-style deals on one venue net. Same-pair stacking on one UID stays parked; TBP has no deal ledger.
- **Near-only live DCA grid**
- **Production sweep receive-address pin**
- **Public `/affiliates` sell-page copy**
- **Full KYC**
