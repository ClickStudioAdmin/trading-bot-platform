# Plans, payments, and affiliates

**Roadmap 5.** Spec written 11 Sep 2026. Steps 1–3 are in repo (docs, schema, admin + member plan pages). Do not start Stripe or the chain watcher until Click starts step 5 / 6. Hyperliquid step 7 and copy step 10 stay the current desk-test work.

One combined phase: freemium plans, feature/cap gates, Stripe cards, a prepaid crypto credit wallet, and a multi-level affiliate program that pays a percent of **platform subscription** invoices only.

The paying customer is the **login** (`members`). One subscription covers every desk they are allowed to create. Never trust the browser for payment status, wallet balances, entitlements, or admin permissions. Corrections are new ledger rows, not edits in place. Do not mix billing or affiliate ledgers with desk money ledgers. Never use exchange API keys or venue withdraw for billing.

## Status

Steps 1–3 in repo 11 Sep 2026. Click started schema + admin/member plan pages. Stop after step 3 until Click says go on step 4. Push `develop` to migrate.

## Purpose

Enough Free to test (Paper, a small desk cap, core Perps/DCA, Chart). Named upgrade when they want Live, copy, backtest, more desks, or affiliates. Admin defines the catalog. Gates stay **visible and disabled** with an **Upgrade** banner. Affiliates get `/account/affiliates` (list, org chart, stats) and earn a held percent of referred subscription invoices, paid out as USDT (or export / later Connect).

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | This file is the phase. Roadmap item 5 is the combined commercial stack. Cross-refs updated. **In repo 11 Sep 2026.** Stop. |
| 2 | Schema | Agent | Migrations: plans (archive, features, caps, per-plan L1/L2/L3 %), `members.plan_id` + billing fields, processor-agnostic invoices, USD credit ledger, referral tree, commission rows, payouts, program settings. Existing members land on seed **Free**. No Stripe SDK yet if it can wait for step 5. Push `develop` to migrate. **In repo 11 Sep 2026.** |
| 3 | Admin plans | Agent | `/admin/plans` create/edit/archive; `/account/plans` public catalog. Seed Free / Plus / Pro. L1–L5 cannot exceed 100%. **In repo 11 Sep 2026.** |
| 4 | Entitlements + Upgrade UX | Agent | `assertEntitlement` on create desk, Live, copy, backtest, enroll, caps. Surfaces stay visible; controls disable; page/inline **Upgrade** names the cheapest public plan that unlocks it. Cap notice: “You have 2 of 2 desks. Upgrade to add another.” `/account/billing` shell (plan, invoices placeholder). Server actions reject. |
| 5 | Stripe cards | Agent | Test keys on `develop`, live on `main`. Checkout upgrade, Customer Portal, idempotent webhooks (`checkout.session.completed`, `customer.subscription.updated`, invoice paid/refunded). One collection method per member. Comp plan from admin (no commission invoice). |
| 6 | Credit wallet | Agent | Unique deposit address per member. Admin-listed majors and EVM nets (incl. Arbitrum). Quote → confirm → **USD credit** (not a multi-currency wallet). Billing tick deducts plan price. Leftover stays. Withdraw leftover as **USDT** only, ≥ min payout, no arrears. Treasury keys on a billing worker only. |
| 7 | Downgrade grace | Agent | Entitlements change at period end. Admin grace days (default 7). Banner + operable extras. After grace, billing worker Close/Disable **oldest desk first**: forbidden features, then numeric caps. Upgrade during grace cancels the sweep. Ledgers stay. |
| 8 | Affiliate program admin | Agent | `/admin/affiliates`: max depth (default 2, hard cap 5), hold days (default 30), min payout, USDT networks, payout queue (export mark-paid, approve/reject withdraw). Rates stay on each plan row. |
| 9 | Affiliate portal | Agent | `HEADER_LINKS` after Backtesting Tool → `/account/affiliates`. Referral kit, downline list (no private data), org chart, stats tiles. Never-enrolled = teaser + Upgrade. Lost enroll = full view, actions disabled, keep earning at last paid enroll-plan rates. Optional referral code on signup. |
| 10 | Commissions + payouts | Agent | Invoice → pending hold → payable (refund in hold = no earn). Per-plan %; snapshot last enroll plan if enroll is off. Withdraw locks: enroll on, no arrears, ≥ min. USDT out only. Tables ready for Stripe Connect later. Gas deducted from the send or covered by the minimum. |
| 11 | Desk test | Click | Free gates visible/disabled. Upgrade Stripe test. Crypto top-up + leftover debit. Affiliate list/chart/stats. Hold then withdraw. Downgrade grace then oldest-first exit. Archive a used plan (cannot delete). |

Stop after each micro-step until Click says go. Next is step 4 (entitlements + Upgrade UX). After acceptance of step 11, stop and wait.

## How it works

### Plans

Admin creates named tiers at `/admin/plans`. Code reads entitlements only — no hardcoded “Pro” except the seed rows.

Each plan: name, sort, public (upgrade catalog), price (`0` = Free), Stripe price id, **L1–L5 affiliate %**, feature flags, numeric caps (empty = unlimited).

**Archive, do not delete** once any member is or was on that plan. Archived: hidden from public upgrade, no new checkout, existing members stay until they change. Admin can un-archive. A never-used draft may be deleted.

Suggested seed (editable):

| Plan | Price | Point of the gate |
| --- | --- | --- |
| Free | $0 | 1–2 Paper desks, Bybit only, Perps + DCA, Chart, no Live, no copy, no backtest, no affiliate |
| Plus | paid | Live desks (small cap), copy follow + share + catalogue, webhooks, templates, maybe one venue |
| Pro | higher | Backtest, more desks, affiliate enroll |

Recommend **Chart free, backtest paid**. Scale-in feature flag stays off until roadmap 10.

### Features (on / off)

Desk types are numeric caps, not ticks. **Manual Desks:** Perps. **Automated Desks:** Perps, DCA, Cash & Carry, TradingView Strategy. Empty = unlimited. Scale-in stays off the catalog until that desk type exists.

Copy: follow, Private Sharing, Public sharing.

Research: backtesting tool; attach results to Bot templates (Plus and Pro); Positions Chart.

Signals and extras: inbound TradingView / Signal webhooks; Save Templates; Share Templates (on for existing plans); Import / Export Templates (Plus and Pro); Starter Pack apply (usually Free). Advanced DCA stays off the public catalog for now.

Affiliate: enroll + referral code; earn multi-level (implies enroll); see downline stats.

`/admin/*` is role-based, never a plan flag.

### Resource caps

Per desk type: max Perps, Cash and Carry, Perps bots, TradingView Strategy, DCA. Also max Paper desks, Exchange Connected Desks (Demo Mode), Exchange Connected Desks (Live Mode), max bots/playbooks per desk, max copy follows, max followers when sharing, max stored backtests, max backtest timeframe in years (limits the date range they can run), optional per-plan earn depth (capped by program max). No combined max-desks or max Live-desks total, no max exchange connections, and no Paper / Live ticks. Demo covers exchange Demo / Testnet; Live-environment is exchange Live.

### Gates

UI **never hides** a gated surface. Disable the control. Persistent **Upgrade** banner (and the same line on the control) names the plan that unlocks it. Hitting a cap does not hide Create desk — notice + disabled action. Server still rejects.

### Payments

**Stripe (cards).** Test account on `develop`, live on `main`. Checkout + Customer Portal. Webhooks set `plan_id` and period end. Past_due: keep the paid plan until period end, then the new plan (usually Free) and grace.

**Platform credit wallet.** One **USD** credit on the login. Incoming BTC / ETH / USDT / USDC / listed majors on admin-listed networks (Ethereum, Arbitrum, Base, Polygon, …) are **deposit rails**. Quote locks to USD; confirm credits one number (stables 1:1). The member never holds an ETH stack. Overpay stays as credit; a billing tick (not the trading engine) deducts rent. Low credit at renewal = past_due → Free + grace. Unique deposit address per member. Treasury may sit on mixed inventory until swept to USDT — ops, not a per-user multi-currency book.

One active **collection method** per member (`stripe` or `wallet`). They can switch.

**Invoices** are processor-agnostic: `method` (stripe \| wallet), `external_id`, USD amount. Commission keys off the invoice.

**Leftover credit** stays on cancel / Free. Spend later or withdraw as USDT if ≥ minimum payout and no arrears. Not forfeited.

**Billing page** `/account/billing` (account chrome, not the header browse row): plan, method, invoices, wallet, top-up, pay arrears, Stripe Portal.

Hosted crypto-subscription auto-pull is not the primary model (it fights leftover credit). Re-evaluate Stripe stablecoins / OpenSettle as optional top-up helpers when this item starts.

### Downgrade and over-quota

Upgrade is immediate (Stripe proration or extra wallet debit). Downgrade entitlements change at **period end**, then grace (admin days, default **7**).

During grace: banner lists what’s over and days left. Cannot add further extras. Existing extras stay operable so they can flatten themselves. Upgrade during grace **cancels** the auto-exit.

After grace, a billing worker (same Close / Disable paths as the user) walks **oldest desk first** (`created_at`):

1. Forbidden features (type, Live, venue, copy, …) — exit those desks oldest-first until none remain.
2. Numeric caps — disable the oldest extras until `assertEntitlement` would pass.

Per desk: cancel working orders, market-exit positions, disable bots, disable the desk. Oldest bot first when only the per-desk bot cap is over. Do not delete ledgers, fills, or history. Engine ticks do not invent a second ruleset; they honour the flags the worker set.

### Affiliates

Pay on **platform subscription only**. Not trading PnL, not copy AUM. Copy take-rate stays parked in [phase-copy-trading.md](phase-copy-trading.md).

Header, right of Backtesting Tool: Copy Trading · Backtesting Tool · **Affiliates** → `/account/affiliates`.

- Never enrolled: teaser, Upgrade, list/chart/payouts disabled.
- Enrolled: referral code + share URL; downline **list** (alias or “Member”, level, attributed vs paid, month joined — never email, phone, Stripe ids, desks, keys, balances); **org chart** of the same tree (click node → list row); **stats** (attributed signups, paid conversions, conversion %, active paid downline, counts by level, referred subscription MRR, earnings this period / all-time, pending vs paid out, last payout). Tiles + period table in v1.
- Lost enroll: still **see** list/chart/stats. All actions disabled (codes, invite copy, withdraw). **Keep earning** at a snapshot of the **last paid enroll plan** rates. Payouts unlock only when enroll is on, **all outstanding subscription invoices are paid**, and payable ≥ minimum.

Attribution: first-touch referral code (optional cookie later with the marketing site). Locked when the referred member first **pays**. Free attributed signups do not pay commission until the first paid invoice. No self-referral, no cycles. Instant enroll when the plan allows. Comp / admin-granted plans do not create a commission invoice.

**Rates are per plan** (L1–L5). Higher plans can earn more. New invoices use the referrer’s current plan rates, or the last-enroll snapshot if enroll is off. Rate edits apply to new invoices only. Program **max depth** default 2, hard cap 5. A plan may zero L2–L5.

**Hold then earn.** Commission starts pending for admin hold days (default **30**). Refund / chargeback / wallet reversal in the hold → never payable. After the hold, payable. Do not edit a paid row in place.

**Payouts.** Method catalog: manual/export, Stripe Connect (schema-ready, can ship after export), **USDT withdraw** from treasury to the affiliate’s address on an admin-listed USDT network. They pick address + network, not a coin. After hold, payable commission credits the same platform wallet (may pay their own rent or withdraw). Pending cannot pay rent and cannot withdraw.

Withdraw locks (all): enroll on; no outstanding subscription invoices; payable ≥ min. Failures: visible disabled control + notice.

Admin `/admin/affiliates`: max depth, hold days, min payout, payout coin (USDT), USDT networks, payout queue, downgrade grace days. Admin downline may show email; the member portal never does.

KYC / travel-rule / money-transmitter: Click owns compliance. V1 is admin-approved crypto withdraws. No full KYC flow in this item.

## What this phase includes

- Admin plan catalog with features, caps, per-plan affiliate %, archive
- `assertEntitlement` + visible-but-disabled Upgrade UX + `/account/billing`
- Stripe card subscriptions (develop test / main live)
- USD credit wallet, crypto top-up rails, billing tick, USDT withdraw
- Grace then oldest-first auto-exit
- Affiliate portal (list, org chart, stats) and program admin
- Commission ledger (hold → payable) and payout queue

## Out of scope

- Paying the plan from a Bybit / Hyperliquid / exchange balance or withdrawal key
- Paying affiliates on trader PnL or copy AUM
- Usage billing per fill
- Multi-currency member balances
- Hosted crypto-sub auto-pull as the primary model
- Yearly prices, vanity referral slugs, promo coupons (unless Click asks)
- Marketing website (roadmap 11)
- Onboarding wizard refine (roadmap 6) — Starter Pack still never arms
- Transactional email (roadmap 7) — failed payment / low credit is in-app first
- Internal webhooks (roadmap 8), backup candles (roadmap 9), scale-in (roadmap 10)
- MEXC and further CEXes (roadmap 15)
- Fly scale-from-admin (parked)
- Full KYC product

## After this

Onboarding / Starter Packs is roadmap 6. Notifications (including billing email) is roadmap 7.
