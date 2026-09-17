# Plans, payments, and affiliates

**Shipped.** Spec written 11 Sep 2026. **Closed at step 8** on 16 Sep 2026. Identity / 2FA / plan gates are later V1 items ([roadmap.md](roadmap.md)). Hyperliquid and copy leftover desk-test sit in V1 system test.

One combined phase: freemium plans, feature/cap gates, Stripe cards, a prepaid crypto credit wallet, and a multi-level affiliate program that pays a percent of **platform subscription** invoices only.

The paying customer is the **login** (`members`). One subscription covers every desk they are allowed to create. Never trust the browser for payment status, wallet balances, entitlements, or admin permissions. Corrections are new ledger rows, not edits in place. Do not mix billing or affiliate ledgers with desk money ledgers. Never use exchange API keys or venue withdraw for billing.

## Status

Steps 1–8 in repo 13 Sep 2026. Stripe cards + `/account/billing` + Checkout embed + two USD books + unique EVM deposit addresses + affiliate admin, portal, commissions, and payout queue. Develop is seeded with **Arbitrum Sepolia** + testnet USDT and watches **public RPCs** for now (Alchemy later). Encrypted **gas wallet** drips ETH onto a deposit address before sweep. A develop-only John affiliate tree is a migration (`docs/john-affiliate-demo.md`); do not take those rows to production. This phase is **complete at step 8**. Entitlements / Upgrade UX / grace are [phase-entitlements.md](phase-entitlements.md). Notifications are [phase-notifications.md](phase-notifications.md). Add `BILLING_CREDENTIALS_KEY` on Vercel Development / `.env.local` and Fly `tbp-engine-dev`. Create the HD seed and gas wallet on `/admin/billing`, then fund the gas wallet with testnet ETH.

## Purpose

Enough Free to test (Paper, a small desk cap, core Perps/DCA, Chart). Named upgrade when they want Live, copy, backtest, or more desks. Admin defines the catalog. Gates stay **visible and disabled** with an **Upgrade** banner. Every platform login is an affiliate. People can also join from public `/affiliates` without a platform membership. Dashboard tabs: Overview, Network, Campaigns, URLs, Commissions, Payouts, Settings. Paid out as USDT (or export / later Connect).

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | This file is the phase. Roadmap item 5 is the combined commercial stack. Cross-refs updated. **In repo 11 Sep 2026.** Stop. |
| 2 | Schema | Agent | Migrations: plans (archive, features, caps, per-plan L1/L2/L3 %), `members.plan_id` + billing fields, processor-agnostic invoices, USD credit ledger, referral tree, commission rows, payouts, program settings. Existing members land on seed **Free**. No Stripe SDK yet if it can wait for step 4. Push `develop` to migrate. **In repo 11 Sep 2026.** |
| 3 | Admin plans | Agent | `/admin/plans` create/edit/archive; `/account/plans` in-app catalog; public `/pricing`. Seed Free / Plus / Pro. L1–L5 cannot exceed 100%. Visibility: public / private / draft (+ draft preview on Plans for admins). Clone copies a plan as a new draft. Admin assigns a plan on `/admin/members` (comp, no invoice) so affiliate rates have a login to read. **In repo 11 Sep 2026.** |
| 4 | Stripe cards | Agent | Test keys on `develop`, live on `main`. `/account/billing` (plan, method, invoices, Stripe Portal). `/account/billing/checkout` for Upgrade: method left, Stripe embed or Crypto shell right. Members stay on TBP. Customer Portal, idempotent webhooks. One collection method per member (Card / Crypto; optional deduct from Crypto Credit). Comp plan from admin (no commission invoice). Wallet tile shows $0; Top-up waits for step 5. **In repo 12 Sep 2026.** |
| 5 | Credit wallet | Agent | Two USD books (Main + Affiliate). **EVM only.** Admin-defined chains/tokens. Encrypted **deposit HD seed** derives a unique address per member. Encrypted **gas wallet** drips ETH onto that address when a sweep needs gas (not the admin payout wallet). Watcher uses **public RPCs for now** (`eth_getLogs` on listed tokens; Alchemy later). Develop seed: Arbitrum Sepolia + testnet USDT. Sweep deposit → **admin address** (public only; admin seed/key never stored). Stables credit 1:1 to Main. Checkout can pay from Main; shortfall may transfer from payable Affiliate → Main first. Click sends USDT payouts by hand from the admin wallet and marks the queue. **In repo 12 Sep 2026.** |
| 6 | Affiliate program admin | Agent | `/admin/settings?tab=affiliates`: max depth (default 2, hard cap 5), hold days (default 30), min payout, default L1–L5 (non-members + unpaid). `/admin/affiliates` is the payout queue (export mark-paid, approve/reject withdraw). USDT withdraw chains are ticked on each billing chain (`Affiliate Payouts Allowed on this chain`). Plan rates stay on each plan row. **In repo 13 Sep 2026.** |
| 7 | Affiliate portal | Agent | Public `/affiliates` (header + signup). Signed-in uses account chrome + sidebar. Platform members see the usual account/desk links. Affiliate-only see Settings (profile + password) only. Tabs: Overview, Network, Campaigns, URLs, Commissions, Payouts, Settings. Custom `/r/{slug}` URLs (home or affiliate landing) + campaigns. Upgrade to Free platform membership. **In repo 13 Sep 2026.** |
| 8 | Commissions + payouts | Agent | Invoice → pending hold → payable (refund in hold = no earn). Per-plan %. Withdraw locks: no arrears, ≥ min. USDT out only. Tables ready for Stripe Connect later. Gas deducted from the send or covered by the minimum. **In repo 13 Sep 2026.** |
| 9–11 | Moved | — | Entitlements, Upgrade UX, downgrade grace, and the membership desk test are [phase-entitlements.md](phase-entitlements.md) (roadmap 7 after the 16 Sep 2026 reorder). **Moved 16 Sep 2026.** |

This phase **stops at step 8**. Do not start entitlements here. Notifications is the current commercial phase ([phase-notifications.md](phase-notifications.md)).

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

Recommend **Chart free, backtest paid**. Scale-in feature flag stays off until V2.

### Features (on / off)

Desk types are ticks, not per-type counts. **Manual Desk Types:** Perps. **Automated Desk Types:** Perps, DCA, Cash & Carry, TradingView Strategy. Scale-in stays off the catalog until that desk type exists. Positions Chart and Starter Pack apply are not plan features.

Copy: Copy other Trader's Desks, Max Desk Copies, Desk Sharing - Public, Desk Sharing - Private.

Research: Backtesting Tool; Attach Results to Bot Template (Plus and Pro).

Signals and extras: inbound TradingView / Signal webhooks; Save Templates; Share Templates (on for existing plans); Import / Export Templates (Plus and Pro). Advanced DCA stays off the public catalog for now.

Affiliate: every login is an affiliate (not a plan tick). Referral code, earn multi-level, see downline stats. **Deduct Plan Payment from Earnings** stays a catalog tick. The member opt-in is a Crypto payment-method sub-setting on Billing (not Account Settings). Payable only — pending cannot move. Billing **transfers** the shortfall Affiliate → Main, then debits Main. That is still a paid subscription invoice: **upstream affiliates still earn** their L1–L5 on it. Not comp. The paying member does not earn on their own invoice.

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
| **Account Balance** (ledger book `main`) | Unused USD credit from 1:1 stablecoin top-ups (and any transfer in from Affiliate) | `deposit`, `transfer_in`, `debit_rent`, `withdraw`, `adjust` |
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

**Attribution.** Top-up shows that member’s unique address. The watcher confirms inbound to **that** address (listed token, confirmations, not already credited). Then Main gets the USD `deposit`. Idempotent on `tx_hash` + log index. After credit, the worker may drip ETH from the **gas wallet** onto the deposit address if it cannot pay gas, then sweep USDT to the admin address. Member credit does not wait on the drip or sweep. Each watch also retries credited rows that still have a null `sweep_tx_hash` (the log cursor does not have to see that transfer again). The Fly engine cycle watches **all** deposit addresses about every 60s (`billing_deposits` scan lease, `advanceCursor`), credits new confirmed stables, then drips gas and sweeps. A sweep is marked only after the transfer receipt is **success**; a revert leaves `sweep_tx_hash` null so the next watch retries. The same cycle issues/collects invoices, then **releases due affiliate commissions** (`releaseDueCommissions`) so hold expiry does not wait on someone opening Affiliates. Fly must have `BILLING_CREDENTIALS_KEY` (deploy-engine checks it). Member **Check for deposit** and admin **Scan deposits** still run the same watcher on demand. Checkout still polls so a paying member is not waiting on the next engine loop. Overview, Manage Payment Method top-up, and **Manage Account Balance** poll the ledger about every 10s and refresh Current Balance when the engine has credited a deposit.

**Admin address.** Public only. The system never signs with it. No automated payout from the admin wallet. Parked: pin the production receive address in a server env so a database edit cannot redirect sweeps ([click-list.md](click-list.md) item 13).

Admin `/admin/affiliates` and public `/affiliates` (signup + dashboard) are in repo. Paid invoices (not `comp`) write pending commissions up the first-touch tree. After hold they credit the Affiliate book. Affiliates request USDT withdraws; admin approves, rejects, or marks paid.

**Billing tick (Deduct from).** Rent is always taken from **Main**. Order:

1. Use Main.
2. If Main is short and **Deduct Plan Payment from Earnings** is on, transfer the shortfall from **payable** Affiliate → Main (pending cannot move).
3. Debit the full plan price from Main.
4. If Main is still short, the invoice stays **unpaid**. The engine retries on every tick and again when a deposit credits. Downgrade / grace is step 10 — do not auto-move to Free here. Leftover Stripe/card is unchanged.

That write is still a **paid** invoice for the plan price (not `comp`). Upline L1–L5 still earn on it. The paying member does not earn on their own invoice. **Deduct payments from Your Wallets where possible** means “use Main first” (the USD credit book). Checkout **Pay with credit** runs that deduct now. The engine issues an **open** renewal invoice **7 days** before `period_end` (Card and Crypto). First Crypto collect attempt is **6 hours before** `period_end`. `due_at` is `period_end` plus a **6 hour** buffer so we do not treat the invoice as unpaid while the engine may still be collecting. If Main (plus payable Affiliate if that tick is on) covers it on or after that first attempt — including after a later deposit — take payment. Do not debit during the rest of the 7-day lead window. Card: Stripe `invoice.paid` marks the matching open invoice paid. If **Crypto** is the saved method, `invoice.paid` is ignored (no paid invoice, no commissions) and leftover open Stripe invoices for that login are voided. First checkout / upgrade still writes a paid invoice immediately. PDF invoices later.

One active **collection method** per member (`stripe` = Card or `wallet` = Crypto). **Save** talks to Stripe first, then writes the method. A successful Save voids open renewals tagged with the other method, then re-issues under the new method if already inside the 7-day lead window. Switching to Crypto sets Stripe `cancel_at_period_end` before TBP stores Crypto; if that Stripe call fails, the method does not change. Stripe subscription webhooks do not overwrite plan, `period_end`, `subscription_status`, or method while Crypto is saved (so a cancel-at-period-end update cannot flip them back to Card, and the later `canceled` / deleted event cannot drop them to Free). When that Stripe sub actually ends, TBP only clears `stripe_subscription_id`. Wallet renewals keep `subscription_status` **active**. On **Manage Payment Method**, a method change needs **Save new payment method** before the follow-up form appears: Crypto → Card collects the card only (setup embed). The current cycle stays paid; Stripe’s first charge is the **current TBP plan price** at `period_end`. Not a free trial and not a Stripe catalog price that does not match the plan. Card → Crypto shows Top up Account Balance in the right column while Crypto is saved. An existing live Stripe sub that was set to cancel at period end is resumed on save. A dead or missing Stripe sub is cleared, then a new one is created after a card is on file.

**Invoices** are processor-agnostic: `method` (stripe \| wallet \| comp), `external_id`, USD amount. Commission keys off the invoice. A mixed tick (Main, then Affiliate→Main, then debit) is one invoice. Only admin comp skips commission.

**Leftover Main** stays on cancel / Free. Spend later or withdraw as USDT from the **Manage Account Balance** tab if ≥ the **Main Wallet minimum** (admin setting on Settings → Crypto, default **$100**, separate from the affiliate $50 min) and no arrears. The Manage Account Balance tab stays while Crypto is the saved method, or while Main still has leftover after a switch to Card, until the balance is zero. Each request needs a receive address typed in — not the affiliate payout address. The withdraw debits Main immediately (available credit drops; Crypto collect uses the same signed book total, so a requested withdraw cannot be spent on rent). Account Balance displays the available amount and, when a request is still open, ` (+ $x pending withdraw)`. Click generates a payout list on `/admin/billing` **Wallet withdrawal requests**, sends USDT by hand, then marks the file paid. Affiliate withdraw is a separate queue on `/admin/affiliates` (Affiliate book). Not forfeited.

**Billing & Account** `/account/billing` (account chrome, not the header browse row): Overview is **Subscription Details** (current plan, monthly payment, payment method under the amount — Crypto shows as **Crypto (account balance)** — billing cycle, next payment due) with **Account Balance** to the right (current Main USD, amber shortfall when Main is below the next cycle price, and a link to Manage Account Balance). **Manage Payment Method** sits after Invoices (hidden on a new Free login with status none): Current payment method in the left column; after **Save**, the right column is the Stripe subscription embed (Card, until a card is on file), then a saved-card brief (brand, last4, expiry) plus **Update Card** that opens the manage-card embed — not a blank Stripe form first — or Top up Account Balance (Crypto, stays while Crypto is saved; amber notice when Main is short for the next cycle). No separate Card tab. **Manage Account Balance** tab shows when Crypto is saved, or while Main still has leftover after switching to Card, until the balance is zero. It has Account Balance USDT withdraw (address typed each request) and Top up Account Balance (deposit address only when Crypto is the saved method). **Account Ledger** is last in the tab row (after Manage Account Balance): the running Account Balance book (deposits, plan payments, withdrawals, Affiliate → Account Balance transfers). Hidden on Free unless Main already has rows (downgrade leftover). **Invoices** and **Account Ledger** paginate 20 rows per page (`?page=`). Amber top-up shortfall names the next cycle price, e.g. `($19)`. Member **Check for deposit** reports only deposits credited on that click, not earlier ones. Payable affiliate earnings stay on Affiliates. Plans **Upgrade** opens `/account/billing/checkout?plan=`. Summary card is **Subscription Details**: **Current Plan**, **Upgrading to**, **Due Today**, **Then**, plus **Payment Method** when the method is already saved. First paid checkout (Free or subscription none): Card / Crypto picker plus Stripe **embedded** form or Crypto deposit. Method saves as they switch (no Save method). Crypto shows amount due, a note to send extra for later months, and the deposit address — no wallet balance. The page polls for deposits every 10s and pays the plan when enough credit confirms, then stays on Checkout with a success message (no auto-redirect). A green credit notice appears only when that poll finds a new deposit, not leftover Account Balance. Deduct from Affiliate if required is **on** by default. Paid upgrade: no method picker; due-today is the prorate. Crypto upgrade shows Current balance, Amount due, and **Account shortfall** (Due Today − Account Balance), plus **Pay with credit** when Main covers Due Today; otherwise a short notice, the deposit address, and copy that starts **Transfer at least the account shortfall to cover today's payment** (first checkout still says transfer at least the amount due today). Amber top-up copy on Manage Payment Method and Manage Account Balance names the next cycle price, e.g. `($19)`. Switching Card → Crypto on Manage Payment Method requires **Save method** before Top up Account Balance appears (and before the deposit address unlocks on Manage Account Balance). Switching Crypto → Card requires **Save method** before the Stripe subscription embed appears under the method form. Members stay on TBP. Success returns to Billing. Admin `/admin/billing` tabs: Overview (deposit rails), **Invoices** (every member invoice), Wallet withdrawal requests.

Hosted crypto-subscription auto-pull is not the primary model (it fights leftover credit). Re-evaluate Stripe stablecoins / OpenSettle as optional top-up helpers when this item starts.

### Downgrade and over-quota

Upgrade is immediate access. **First paid checkout** (Free → paid) charges the full first period and can still pick Card or Crypto if no method is saved. **Paid-to-paid upgrade** uses the saved method only. If the current plan has a price (including Comp Plus), due today is the difference: remaining-cycle prorate when `period_end` is in the future (`(new − old) × time left / 30 days`), or the full difference when there is no open cycle (Comp / no `period_end`) and a new 30-day cycle starts. The new monthly rent starts at that `period_end`. Card is a one-off PaymentIntent, then Stripe’s recurring price changes with no mid-cycle proration. After that PI succeeds, TBP records it (idempotent on the PI id) and applies the plan. A retry completes the apply without charging again. Wallet debits Main for the prorate and keeps `period_end`. Top-up appears on Checkout only when Crypto is short. Downgrade entitlements change at **period end**, then grace (admin days, default **7**).

During grace: banner lists what’s over and days left. Cannot add further extras. Existing extras stay operable so they can flatten themselves. Upgrade during grace **cancels** the auto-exit.

After grace, a billing worker (same Close / Disable paths as the user) walks **oldest desk first** (`created_at`):

1. Forbidden features (type, Live, venue, copy, …) — exit those desks oldest-first until none remain.
2. Numeric caps — disable the oldest extras until `assertEntitlement` would pass.

Per desk: cancel working orders, market-exit positions, disable bots, disable the desk. Oldest bot first when only the per-desk bot cap is over. Do not delete ledgers, fills, or history. Engine ticks do not invent a second ruleset; they honour the flags the worker set.

### Affiliates

Pay on **platform subscription only**. Not trading PnL, not copy AUM. Copy take-rate stays parked in [phase-copy-trading.md](phase-copy-trading.md).

Public site header (not the app chrome): Home · How it works · **Pricing** → `/pricing` · **Affiliates** → `/affiliates`, plus **Sign in** and **Start free** (`/sign-up`). Public `/sign-up` creates a Free platform membership (name, email, password, optional `?ref=`), then `/account/verify`. After confirm they land on Overview. Signed-in `/affiliates` uses account chrome (sidebar + compact footer). App header for platform members: Copy Trading · Backtesting Tool · **Plans** · **Affiliates**. Affiliate-only header: **Affiliates** only; sidebar is Settings (profile + password). `/account/settings` is allowed for affiliate-only; other `/account/*` routes stay off-limits.

Every platform login is an affiliate. People can also **sign up as an affiliate only** on `/affiliates` (name, email, password, optional referral code) without becoming a platform member. Affiliate-only logins stay off desks until they **Convert** in the left nav (default Free plan, then Overview). The nav explains the account type in text; the button only says Convert. **Campaigns** tab creates and archives named campaigns (table: URLs, signups, status). **URLs** tab lists a **System** Default row (`/affiliates?ref=CODE`, cannot be archived) plus **Custom** `/r/{slug}` URLs (landing: home or public affiliate page) that can attach to a campaign. Custom URLs and campaigns **archive** (`archived_at`); they leave the picker and active list. Historical `campaign_id` / `link_id` stay on referrals and commissions. Old `/r/` URLs still resolve. Active campaign names stay unique per login. Caps count active rows only. Referrals and commissions store `campaign_id` / `link_id` so later stats can filter by campaign. Downline **list** (affiliate alias, otherwise account name, otherwise “Member”; newest signups first; level, signup vs paid, month joined — never email, phone, Stripe ids, desks, keys, balances); **org chart** of the same tree (`d3-org-chart` nodes and lines: pan, zoom, expand/collapse, expand all / collapse all / fit, fullscreen; You plus directs first; click node → list row, including the paged list); portal list tables (downline, campaigns, URLs, commissions, payouts) page **20** rows; **stats** (signups, paid conversions, conversion %, active paid downline, counts by level, referred subscription MRR, earnings this period / all-time, pending vs paid out, last payout); **current rates** table. Tiles + period table in v1. Advanced campaign filters come later.

Attribution: first-touch. A `?ref=` (or `?referralCode=`) on any public page writes an httpOnly `tbp_ref` cookie if one is not already set. A custom `/r/{slug}` link sets `tbp_ref` plus `tbp_ref_link` when no first-touch cookie exists, then redirects to the chosen landing. Cookie days are an admin setting on `/admin/settings` Affiliates (default **30**). Signup uses the form value if present, otherwise the cookie. A later `?ref=` or `/r/` visit does not replace the first cookie. Locked when the referred member first **pays**. Free attributed signups do not pay commission until the first paid invoice. No self-referral, no cycles. Comp / admin-granted plans do not create a commission invoice. A subscription paid (in full or in part) by deducting the member’s own payable affiliate earnings **does** create a commission invoice for their upline. Same hold, refund-in-hold, and rate rules. The source of funds does not skip L1–L5.

**Rates.** Platform members on a current plan use that plan’s L1–L5. Affiliates who are **not** platform members, and members whose subscription is **past due**, use the **program default rates** on `/admin/settings` Affiliates (not the Free plan). Already-written commission rows keep the rate they were stamped with. Rate edits apply to new invoices only. Program **max depth** default 2, hard cap 5. A plan may zero L2–L5. The Current rates table shows a dash for a zeroed or unused level, not `0%`.

**Hold then earn.** Commission starts pending for admin hold days (default **30**). Refund / chargeback / wallet reversal in the hold → void pending (never payable). After the hold, the Affiliate book is credited. A later refund adds a **negative commission list row** and an Affiliate book debit. If that commission is already on a payout list, leave the file alone — treat the original as paid and still add the deduction. Do not edit a paid row in place.

**Payouts.** Method catalog: manual/export, Stripe Connect (schema-ready, can ship after export), **USDT withdraw** (Click sends from the **admin wallet** outside this app — that wallet’s seed/key is never stored — then marks the queue paid). Once a commission is no longer pending, they may withdraw **any amount** up to the Affiliate book (min ≤ amount ≤ book — not whole commission rows, not assumed to be the full payable). Chain and address are saved on the affiliate **Settings** tab and pre-filled on each request. Affiliate **alias** is also on Settings (`members.affiliate_alias`); the network shows that instead of their account name. Without an alias it shows the account name, then “Member”. It is not the copy-trading trader alias on Account Settings. Optional **auto payouts**: when the Affiliate book is over an amount they set (must be **more than** the program minimum), the app opens a **requested** payout for the full book balance to the saved address. Same path as Request withdraw. New affiliate withdraws debit the book immediately and do not attach `membership_payout_items`. Admin **generates payout lists** on `/admin/affiliates` (CSV `address,amount` for an airdrop tool). Generate takes chain, **max rows per list**, and optional max amount; same address stays on one file and extras split to the next list. That marks those requests **pending** and attaches them to a `membership_payout_files` row. After the airdrop, mark the **file** paid — every request on it becomes paid. No automatic send. After hold, commission is **payable on the Affiliate book** (not Main). If the plan has **Deduct Plan Payment from Earnings** and `members.pay_subscription_from_affiliate` is on, the billing tick may **transfer** Affiliate book credit → Main, then debit Main. Pending commission cannot pay rent, cannot transfer, and cannot withdraw.

Withdraw locks (all): subscription is not `past_due`; book ≥ min; requested amount ≥ min and ≤ book. An open renewal invoice for the next cycle does not block withdraw (grace / window is step 10). Failures: visible disabled control + notice.

Admin `/admin/settings` Affiliates: max depth, hold days, referral cookie days (default 30), min payout, payout coin (USDT), default L1–L5, downgrade grace days. Settings → Crypto also has **Main Wallet minimum withdraw** (default $100). `/admin/affiliates` is affiliate payout files (generate / view details / download / mark file paid), the request queue (reject before a file), and downline lookup. `/admin/billing` **Wallet withdrawal requests** is the same queue for Main Wallet withdraws (`membership_payouts.book = main`). View details opens the full payment list for that file, pending or paid. Allowed USDT withdraw chains are ticked per billing chain on `/admin/settings` Crypto. Admin downline may show email; the member portal never does.

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
- Marketing website (V1 item 7)
- Transactional notifications and email (shipped) — [phase-notifications.md](phase-notifications.md)
- Identity / 2FA / entitlements / plan gates (V1 items 1, 2, 4) — [phase-entitlements.md](phase-entitlements.md), [phase-2fa.md](phase-2fa.md)
- Onboarding wizard refine (V1 item 5) — Starter Pack still never arms
- Internal webhooks, backup candles, scale-in, MEXC (V2)
- Fly scale-from-admin (parked)
- Full KYC product

## After this

See [roadmap.md](roadmap.md). Notifications are shipped. Identity and 2FA are accepted. Next V1 item is UI cleanup.
