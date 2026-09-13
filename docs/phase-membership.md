# Plans, payments, and affiliates

**Roadmap 5.** Spec written 11 Sep 2026. Steps 1–5 are in repo (docs, schema, admin + member plan pages, Stripe + payment-method shell, credit wallet rails). Click moved downgrade grace to after entitlements (13 Sep 2026). Upgrade UX / gates wait until step 9 so they land on settled surfaces. Hyperliquid step 7 and copy step 10 stay the current desk-test work.

One combined phase: freemium plans, feature/cap gates, Stripe cards, a prepaid crypto credit wallet, and a multi-level affiliate program that pays a percent of **platform subscription** invoices only.

The paying customer is the **login** (`members`). One subscription covers every desk they are allowed to create. Never trust the browser for payment status, wallet balances, entitlements, or admin permissions. Corrections are new ledger rows, not edits in place. Do not mix billing or affiliate ledgers with desk money ledgers. Never use exchange API keys or venue withdraw for billing.

## Status

Steps 1–8 in repo 13 Sep 2026. Stripe cards + `/account/billing` + Checkout embed + two USD books + unique EVM deposit addresses + affiliate admin, portal, commissions, and payout queue. Develop is seeded with **Arbitrum Sepolia** + testnet USDT and watches **public RPCs** for now (Alchemy later). Encrypted **gas wallet** drips ETH onto a deposit address before sweep. Upgrade UX / gates are step 9. Downgrade grace is step 10. Push `develop` to migrate. Add `BILLING_CREDENTIALS_KEY` on Vercel Development / `.env.local`. Create the HD seed and gas wallet on `/admin/billing`, then fund the gas wallet with testnet ETH.

## Purpose

Enough Free to test (Paper, a small desk cap, core Perps/DCA, Chart). Named upgrade when they want Live, copy, backtest, or more desks. Admin defines the catalog. Gates stay **visible and disabled** with an **Upgrade** banner. Every platform login is an affiliate. People can also join from public `/affiliates` without a platform membership. Dashboard tabs: Overview, Network, Referrals, Links, Payouts. Paid out as USDT (or export / later Connect).

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | This file is the phase. Roadmap item 5 is the combined commercial stack. Cross-refs updated. **In repo 11 Sep 2026.** Stop. |
| 2 | Schema | Agent | Migrations: plans (archive, features, caps, per-plan L1/L2/L3 %), `members.plan_id` + billing fields, processor-agnostic invoices, USD credit ledger, referral tree, commission rows, payouts, program settings. Existing members land on seed **Free**. No Stripe SDK yet if it can wait for step 4. Push `develop` to migrate. **In repo 11 Sep 2026.** |
| 3 | Admin plans | Agent | `/admin/plans` create/edit/archive; `/account/plans` in-app catalog; public `/pricing`. Seed Free / Plus / Pro. L1–L5 cannot exceed 100%. Visibility: public / private / draft (+ draft preview on Plans for admins). Clone copies a plan as a new draft. Admin assigns a plan on `/admin/members` (comp, no invoice) so affiliate rates have a login to read. **In repo 11 Sep 2026.** |
| 4 | Stripe cards | Agent | Test keys on `develop`, live on `main`. `/account/billing` (plan, method, invoices, Stripe Portal). `/account/billing/checkout` for Upgrade: method left, Stripe embed or Crypto shell right. Members stay on TBP. Customer Portal, idempotent webhooks. One collection method per member (Card / Crypto; optional deduct from Crypto Credit). Comp plan from admin (no commission invoice). Wallet tile shows $0; Top-up waits for step 5. **In repo 12 Sep 2026.** |
| 5 | Credit wallet | Agent | Two USD books (Main + Affiliate). **EVM only.** Admin-defined chains/tokens. Encrypted **deposit HD seed** derives a unique address per member. Encrypted **gas wallet** drips ETH onto that address when a sweep needs gas (not the admin payout wallet). Watcher uses **public RPCs for now** (`eth_getLogs` on listed tokens; Alchemy later). Develop seed: Arbitrum Sepolia + testnet USDT. Sweep deposit → **admin address** (public only; admin seed/key never stored). Stables credit 1:1 to Main. Checkout can pay from Main; shortfall may transfer from payable Affiliate → Main first. Click sends USDT payouts by hand from the admin wallet and marks the queue. **In repo 12 Sep 2026.** |
| 6 | Affiliate program admin | Agent | `/admin/settings?tab=affiliates`: max depth (default 2, hard cap 5), hold days (default 30), min payout, default L1–L5 (non-members + unpaid). `/admin/affiliates` is the payout queue (export mark-paid, approve/reject withdraw). USDT withdraw chains are ticked on each billing chain (`Affiliate Payouts Allowed on this chain`). Plan rates stay on each plan row. **In repo 13 Sep 2026.** |
| 7 | Affiliate portal | Agent | Public `/affiliates` (header + signup). Signed-in uses account chrome + sidebar. Platform members see the usual account/desk links. Affiliate-only see Settings (profile + password) only. Tabs: Overview, Network, Referrals, Links, Payouts. Custom `/r/{slug}` links (home or affiliate landing) + campaigns. Upgrade to Free platform membership. **In repo 13 Sep 2026.** |
| 8 | Commissions + payouts | Agent | Invoice → pending hold → payable (refund in hold = no earn). Per-plan %. Withdraw locks: no arrears, ≥ min. USDT out only. Tables ready for Stripe Connect later. Gas deducted from the send or covered by the minimum. **In repo 13 Sep 2026.** |
| 9 | Entitlements + Upgrade UX | Agent | After payments and affiliates, so gates land on settled UI. `assertEntitlement` on create desk, Live, copy, backtest, caps. Surfaces stay visible; controls disable; page/inline **Upgrade** names the cheapest public plan that unlocks it. Cap notice: “You have 2 of 2 desks. Upgrade to add another.” Server actions reject. Billing page already exists from step 4. |
| 10 | Downgrade grace | Agent | Entitlements change at period end. Admin grace days (default 7, already saved on `/admin/affiliates`). Banner + operable extras. After grace, billing worker Close/Disable **oldest desk first**: forbidden features, then numeric caps. Upgrade during grace cancels the sweep. Ledgers stay. Click moved this after step 9 on 13 Sep 2026. |
| 11 | Desk test | Click | Free gates visible/disabled. Upgrade Stripe test. Crypto top-up + leftover debit. Affiliate list/chart/stats. Hold then withdraw. Downgrade grace then oldest-first exit. Archive a used plan (cannot delete). |

Stop after each micro-step until Click says go. Next is step 9 (entitlements + Upgrade UX). Do not start Upgrade UX / gates until step 9. After acceptance of step 11, stop and wait.

## How it works

### Plans

Admin creates named tiers at `/admin/plans`. Clone makes a draft copy (new name `… copy`, not default, no Stripe price). The editor uses the same groups and row order as `/account/plans` (features, caps, and affiliate rates in one section each). Code reads entitlements only — no hardcoded “Pro” except the seed rows.

Each plan: name, sort, **visibility** (`public` on `/account/plans`, `private` assign-only — the assigned member still sees it on Plans, `draft` unpublished), optional draft **preview** (admins see it on Plans), price (`0` = Free), Stripe price id, **L1–L5 affiliate %**, feature flags, numeric caps (empty = unlimited). The default plan cannot be a draft.

**Archive, do not delete** once any member is or was on that plan. Archived: hidden from public upgrade, no new checkout, existing members stay until they change. Admin can un-archive. A never-used draft may be deleted.

Suggested seed (editable):

| Plan | Price | Point of the gate |
| --- | --- | --- |
| Free | $0 | 1–2 Paper desks, Bybit only, Perps + DCA, Chart, no Live, no copy, no backtest |
| Plus | paid | Live desks (small cap), copy follow + share + catalogue, webhooks, templates, maybe one venue |
| Pro | higher | Backtest, more desks |

Recommend **Chart free, backtest paid**. Scale-in feature flag stays off until roadmap 10.

### Features (on / off)

Desk types are ticks, not per-type counts. **Manual Desk Types:** Perps. **Automated Desk Types:** Perps, DCA, Cash & Carry, TradingView Strategy. Scale-in stays off the catalog until that desk type exists. Positions Chart and Starter Pack apply are not plan features.

Copy: Copy other Trader's Desks, Max Desk Copies, Desk Sharing - Public, Desk Sharing - Private.

Research: Backtesting Tool; Attach Results to Bot Template (Plus and Pro).

Signals and extras: inbound TradingView / Signal webhooks; Save Templates; Share Templates (on for existing plans); Import / Export Templates (Plus and Pro). Advanced DCA stays off the public catalog for now.

Affiliate: every login is an affiliate (not a plan tick). Referral code, earn multi-level, see downline stats. **Deduct Plan Payment from Earnings** stays a catalog tick. Same label on Account Settings as the opt-in. Payable only — pending cannot move. Billing **transfers** the shortfall Affiliate → Main, then debits Main. That is still a paid subscription invoice: **upstream affiliates still earn** their L1–L5 on it. Not comp. The paying member does not earn on their own invoice.

`/admin/*` is role-based, never a plan flag.

### Resource caps

Max Paper Trading, Exchange Connected - Demo Mode, Exchange Connected - Live Mode, Max Bots per Desk, Max Desk Copies, Max Followers per Desk, Max Saved Backtests, Max Backtest Timeframe in years (limits the date range they can run), optional per-plan earn depth (capped by program max). No per-desk-type counts, no combined max-desks or max Live-desks total, no max exchange connections, and no Paper / Live ticks. Demo covers exchange Demo / Testnet; Live-environment is exchange Live.

### Gates

UI **never hides** a gated surface. Disable the control. Persistent **Upgrade** banner (and the same line on the control) names the plan that unlocks it. Hitting a cap does not hide Create desk — notice + disabled action. Server still rejects.

### Payments

**Stripe (cards).** Test account on `develop`, live on `main`. Checkout + Customer Portal. Webhooks set `plan_id` and period end. Past_due: keep the paid plan until period end, then the new plan (usually Free) and grace.

**Two platform wallets (USD books).** The member never holds an on-chain token balance in-app. Both books are USD, append-only, separate ledgers, service-role only.

| Book | What sits there | Typical rows |
| --- | --- | --- |
| **Main Wallet** | Unused USD credit from 1:1 stablecoin top-ups (and any transfer in from Affiliate) | `deposit`, `transfer_in`, `debit_rent`, `withdraw`, `adjust` |
| **Affiliate earnings** | Held then payable commission | `commission`, `transfer_out`, `withdraw`, `void`, `adjust` |

A **transfer** is two linked rows (Affiliate `transfer_out` + Main `transfer_in`) with the same transfer id. Never edit a row in place. Never mix these books with desk money ledgers.

**Deposit rails — EVM only.** Locked: no Solana, Tron, native Bitcoin, or other non-EVM chains. Admin defines accepted **EVM chains and tokens** (chain id, public RPC URL, explorer, contract, decimals, kind, affiliate payouts) on `/admin/settings`. The watcher uses **public RPCs for now** (`eth_getLogs` / receipts / balances) against **per-member deposit addresses**. Develop is seeded with **Arbitrum Sepolia** (`421614`) and testnet USDT; production stays empty until Click adds mainnet rows. Alchemy can replace the public RPC later — do not put an Alchemy key in `NEXT_PUBLIC_`. BTC is **wrapped BTC (WBTC) on EVM**. Stables credit 1:1 USD. ETH / WBTC / other non-stables wait for a quote step. Overpay stays on Main.

**Three on-chain wallets (do not mix).**

| Wallet | Keys in TBP? | Role |
| --- | --- | --- |
| **Deposit HD** | Yes — one encrypted seed / `xprv` | Derive a unique EVM address per login (same address on every listed EVM chain). Watch those addresses. Sweep inbound funds **to** the admin address. |
| **Gas wallet** | Yes — one encrypted private key | Dedicated hot wallet. Drips native ETH onto a deposit address when a sweep needs gas. Same address on every listed EVM chain. Click funds it per chain. Not the admin payout wallet. Admin `/admin/billing` shows the public address and per-chain ETH balance. Low-ETH level (default 0.005) is on `/admin/settings`. The private key is shown once on create and is not revealed again. |
| **Admin wallet** | **Never.** No seed, mnemonic, or private key | Public receive address per chain (admin-stored). Click holds the keys offline. Pays USDT withdraws by hand and marks the queue. `/admin/billing` shows ETH and listed-token balances on that address, plus a snapshot of leftover balances still on member deposit addresses. |

Deposit HD is encrypted at rest with `BILLING_CREDENTIALS_KEY` (server / billing worker only; develop ≠ production). Not `EXCHANGE_CREDENTIALS_KEY`. Never `NEXT_PUBLIC_`. Decrypt only on the billing worker. Persist **address + derivation index** per member (`membership_deposit_addresses`). Browser sees the public address only. Per-address private keys are not stored as rows — they are derived from the seed when sweeping.

**Attribution.** Top-up shows that member’s unique address. The watcher confirms inbound to **that** address (listed token, confirmations, not already credited). Then Main gets the USD `deposit`. Idempotent on `tx_hash` + log index. After credit, the worker may drip ETH from the **gas wallet** onto the deposit address if it cannot pay gas, then sweep USDT to the admin address. Member credit does not wait on the drip or sweep. Member **Check for deposit** and admin **Scan deposits** run the watcher on demand.

**Admin address.** Public only. The system never signs with it. No automated payout from the admin wallet. Parked: pin the production receive address in a server env so a database edit cannot redirect sweeps ([click-list.md](click-list.md) item 13).

Admin `/admin/affiliates` and public `/affiliates` (signup + dashboard) are in repo. Paid invoices (not `comp`) write pending commissions up the first-touch tree. After hold they credit the Affiliate book. Affiliates request USDT withdraws; admin approves, rejects, or marks paid.

**Billing tick (Deduct from).** Rent is always taken from **Main**. Order:

1. Use Main.
2. If Main is short and **Deduct Plan Payment from Earnings** is on, transfer the shortfall from **payable** Affiliate → Main (pending cannot move).
3. Debit the full plan price from Main.
4. If Main is still short → past_due → Free + grace. Leftover Stripe/card is unchanged.

That write is still a **paid** invoice for the plan price (not `comp`). Upline L1–L5 still earn on it. The paying member does not earn on their own invoice. **Deduct payments from Your Wallets where possible** means “use Main first” (the USD credit book). Checkout **Pay with credit** runs that deduct now. Recurring wallet ticks wait for a later step.

One active **collection method** per member (`stripe` = Card or `wallet` = Crypto). Switching to Crypto sets Stripe `cancel_at_period_end`.

**Invoices** are processor-agnostic: `method` (stripe \| wallet \| comp), `external_id`, USD amount. Commission keys off the invoice. A mixed tick (Main, then Affiliate→Main, then debit) is one invoice. Only admin comp skips commission.

**Leftover Main** stays on cancel / Free. Spend later or withdraw as USDT if ≥ minimum and no arrears — Click sends that USDT by hand. Affiliate withdraw is a separate payout from the Affiliate book (same manual send). Not forfeited.

**Billing page** `/account/billing` (account chrome, not the header browse row): plan, saved collection method (Card / Crypto + optional credit deduct), invoices, Main + Affiliate books, unique deposit address, Check for deposit, Stripe Portal. Plans **Upgrade** opens `/account/billing/checkout?plan=` — two columns: method on the left, Stripe **embedded** form or Crypto (address + Pay with credit) on the right. Members stay on TBP. Success returns to Billing.

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

Public site header (not the app chrome): Home · How it works · **Pricing** → `/pricing` · **Affiliates** → `/affiliates`, plus **Sign in** and **Start free** (`/sign-up`). Public `/sign-up` creates a Free platform membership (name, email, password, optional `?ref=`), then `/welcome`. Signed-in `/affiliates` uses account chrome (sidebar + compact footer). App header for platform members: Copy Trading · Backtesting Tool · **Plans** · **Affiliates**. Affiliate-only header: **Affiliates** only; sidebar is Settings (profile + password). `/account/settings` is allowed for affiliate-only; other `/account/*` routes stay off-limits.

Every platform login is an affiliate. People can also **sign up as an affiliate only** on `/affiliates` (name, email, password, optional referral code) without becoming a platform member. Affiliate-only logins stay off desks until they use **Upgrade account to full platform membership (free to start)** (default Free plan, then `/welcome`). Referral code + default share URL (`/affiliates?ref=`); **Links** tab for named `/r/{slug}` URLs (landing: home or public affiliate page) and optional **campaigns** (assign a campaign when creating a link). Referrals and commissions store `campaign_id` / `link_id` so later stats can filter by campaign. Downline **list** (alias or “Member”, level, attributed vs paid, month joined — never email, phone, Stripe ids, desks, keys, balances); **org chart** of the same tree (click node → list row); **stats** (attributed signups, paid conversions, conversion %, active paid downline, counts by level, referred subscription MRR, earnings this period / all-time, pending vs paid out, last payout); **current rates** table. Tiles + period table in v1. Advanced campaign filters come later.

Attribution: first-touch. A `?ref=` (or `?referralCode=`) on any public page writes an httpOnly `tbp_ref` cookie if one is not already set. A custom `/r/{slug}` link sets `tbp_ref` plus `tbp_ref_link` when no first-touch cookie exists, then redirects to the chosen landing. Cookie days are an admin setting on `/admin/settings` Affiliates (default **30**). Signup uses the form value if present, otherwise the cookie. A later `?ref=` or `/r/` visit does not replace the first cookie. Locked when the referred member first **pays**. Free attributed signups do not pay commission until the first paid invoice. No self-referral, no cycles. Comp / admin-granted plans do not create a commission invoice. A subscription paid (in full or in part) by deducting the member’s own payable affiliate earnings **does** create a commission invoice for their upline. Same hold, refund-in-hold, and rate rules. The source of funds does not skip L1–L5.

**Rates.** Platform members on a current plan use that plan’s L1–L5. Affiliates who are **not** platform members, and members whose subscription is **past due**, use the **program default rates** on `/admin/settings` Affiliates (not the Free plan). Already-written commission rows keep the rate they were stamped with. Rate edits apply to new invoices only. Program **max depth** default 2, hard cap 5. A plan may zero L2–L5.

**Hold then earn.** Commission starts pending for admin hold days (default **30**). Refund / chargeback / wallet reversal in the hold → never payable. After the hold, payable. Do not edit a paid row in place.

**Payouts.** Method catalog: manual/export, Stripe Connect (schema-ready, can ship after export), **USDT withdraw** (Click sends from the **admin wallet** outside this app — that wallet’s seed/key is never stored — then marks the queue paid). They pick address + a chain that allows affiliate payouts, not a coin. After hold, commission is **payable on the Affiliate book** (not Main). If the plan has **Deduct Plan Payment from Earnings** and `members.pay_subscription_from_affiliate` is on, the billing tick may **transfer** payable Affiliate → Main, then debit Main. Pending cannot pay rent, cannot transfer, and cannot withdraw.

Withdraw locks (all): no outstanding subscription invoices; payable ≥ min. Failures: visible disabled control + notice.

Admin `/admin/settings` Affiliates: max depth, hold days, referral cookie days (default 30), min payout, payout coin (USDT), default L1–L5, downgrade grace days. `/admin/affiliates` is the payout queue and downline lookup. Allowed USDT withdraw chains are ticked per billing chain on `/admin/settings` Crypto. Admin downline may show email; the member portal never does.

KYC / travel-rule / money-transmitter: Click owns compliance. V1 is admin-approved crypto withdraws. No full KYC flow in this item.

## What this phase includes

- Admin plan catalog with features, caps, per-plan affiliate %, archive
- Admin assigns `plan_id` on a member profile (comp). Affiliate earnings read that plan’s L1–L5.
- `assertEntitlement` + visible-but-disabled Upgrade UX (after payments/affiliates)
- Stripe card subscriptions (develop test / main live) and `/account/billing`
- Two USD books (Main + Affiliate), unique EVM deposit addresses from an encrypted HD seed, encrypted gas wallet for automated drips, public-RPC watch (Alchemy later), sweep to admin address (admin key never stored), checkout pay-from-credit, manual USDT payouts
- Grace then oldest-first auto-exit
- Affiliate portal (list, org chart, stats) and program admin
- Commission ledger (hold → payable) and payout queue

## Out of scope

- Paying the plan from a Bybit / Hyperliquid / exchange balance or withdrawal key
- Paying affiliates on trader PnL or copy AUM
- Usage billing per fill
- Multi-currency member balances (on-chain inventory is ops, not a per-user book)
- Native Bitcoin (WBTC on EVM only)
- Non-EVM rails (Solana, Tron, Lightning, etc.)
- Alchemy as the only allowed RPC (public endpoints are the temporary watcher; switch later)
- Storing or using the **admin wallet** seed or private key; automated payout from the admin wallet
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
