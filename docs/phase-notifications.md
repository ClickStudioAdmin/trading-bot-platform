# Transactional notifications and email

**Shipped** (V1 plan: [roadmap.md](roadmap.md)). Spec locked 16 Sep 2026. Admin roles are V2 ([phase-admin-roles.md](phase-admin-roles.md)). Hyperliquid and copy leftover desk-test sit in V1 system test.

Clone the FQX split: one catalog ID drives email, inbox, and settings; required-action badges are **computed live** from domain state; the inbox is the email mirror, not `event_logs`. TBP has no organisations. Inbox and prefs key on `user_id`.

No trade fills, adds, or closes in this phase.

Never trust the browser for payment status, desk health, or unread counts.

## Status

Steps 1–8 in repo 16 Sep 2026. Add `RESEND_API_KEY` + `EMAIL_FROM` on Vercel and Fly (develop ≠ production). Click desk-tests mute, unread, badge clear, and no fill spam. 2FA is in repo. Do not start gates or admin roles until Click says go.

## Purpose

Members and admins see numbered badges for work they must do, plus an inbox of notices that can also go out as email. Admin and each login control the switches. Critical live-desk failures page and persist ([click-list.md](click-list.md) item 12).

`update_card` is live when collection is Card (Stripe) and the subscription is `past_due`. `desk_critical`, `sweep_failed`, and `gas_low` are live from step 7.

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | This file is the phase. Roadmap split applied. **In repo 16 Sep 2026.** |
| 2 | Schema | Agent | `user_notifications`, `user_notification_preferences`, `email_dispatches`, `platform_settings.disabled_emails` / `disabled_badges` / `demo_badge_counts`. RPCs for insert / mark read / unread / claim dispatch / upsert prefs. Inbox by `user_id`. Service-role only. Push `develop` to migrate. **In repo 16 Sep 2026.** |
| 3 | Catalog + `notify()` | Agent | TypeScript catalog, locked copy, preference checks, dispatch claim. Email no-ops if Resend is unset. Tests for mutes, operator skip, idempotency keys. **In repo 16 Sep 2026.** |
| 4 | Inbox + badges | Agent | `/account/notifications`, Overview widget, amber `NavBadge`. Header Inbox = unread only. Action counts stay on Overview / Billing / Affiliates. Extend Attention. Affiliate-only allowed on Inbox. Stop. **In repo 16 Sep 2026.** |
| 5 | Settings | Agent | `/account/settings` Notifications tab (Email / In-app per event). `/admin/settings` Notifications & Alerts tab: one Member list and one Admin list; Email / In-app / Alert on the same trigger row. Locked `NoticeEmail` previews on `/admin/email-templates`. Affiliate-only members see Affiliates + Security only. Stop. **In repo 16 Sep 2026.** |
| 6 | Wire commercial | Agent | `notify()` from billing, affiliate payouts, copy invites, password change. `update_card` live on Stripe `past_due`. Stop. **In repo 16 Sep 2026.** |
| 7 | Wire critical + operator | Agent | Deduped live-desk critical, sweep fail, gas low, operator mail. Absorb click-list 12. Stop. **In repo 16 Sep 2026.** |
| 8 | Resend + desk test | Agent + Click | `RESEND_API_KEY` + `EMAIL_FROM` on Vercel and Fly (develop ≠ production). One `NoticeEmail` HTML layout. Member footer. Mute, unread, badge clear, no fill spam. Operator mail still every admin. Stop. **In repo 16 Sep 2026.** Click adds keys and desk-tests. |

Stop after each micro-step until Click says go. Do not start entitlements, onboarding refine, or internal webhooks.

## How it works

```
Domain action → notify(template, user)
                 → email (Resend; skip if muted or key missing)
                 → inbox row (skip operator templates and in-app mutes)

Live domain state → action counts → amber numbered badge on Overview / Billing / Affiliates (cap 99+)
Inbox unread     → header Inbox badge only
```

**Inbox** is informational history. **Action badges** are the work queue. Do not mix them. A read inbox row does not clear an action badge.

No bell dropdown. Inbox page + header Inbox link. Theme tokens only.

Operator templates email admins only and never write a member inbox row. Role routing is [phase-admin-roles.md](phase-admin-roles.md), not this phase.

`password_changed` email is not mute-able. Other member templates respect platform then user mutes.

Affiliate-only logins: Inbox + Settings. Settings show Affiliates (commission + withdraws) and Security (`password_changed`) only — no Billing, Copy, or Desks. No desk-critical or unbound-live badges.

## Catalog

Same ID in email, inbox, and settings.

**Member — email + in-app default on:** `payment_failed`, `subscription_past_due`, `account_shortfall`, `payout_rejected`, `copy_invite_received`, `desk_sync_failed`, `desk_order_failed`, `exchange_verify_failed`, `password_changed` (email not mute-able).

**Member — in-app on, email off:** `invoice_issued`, `invoice_paid`, `deposit_credited`, `commission_released`, `payout_requested`, `payout_paid`, `copy_invite_revoked`.

**Operator — email only:** `operator_payout_requested`, `operator_sweep_failed`, `operator_gas_low`, `operator_payment_failed`, `operator_desk_critical`.

**Not this phase:** fills, blotter chatter, plan-limit / Upgrade / grace, marketing, `engine.tick`, `deposit_watched`. Identity and password-reset are V1 item 1. 2FA is V1 item 2. Admin **roles** are V2 ([phase-admin-roles.md](phase-admin-roles.md)).

## Email templates

FQX `NoticeEmail` shape: subject = heading = preview; one or two short paragraphs; one button. Inbox title = subject. Inbox body = first paragraph. Amounts USD. From name and overline are Admin Settings → General → Platform name (default Trading Bot Platform). Optional uploaded logo on the same form. Locked previews live on `/admin/email-templates`. Settings only has on/off switches. Resend send uses the same layout (inline HTML + text). Button links use `APP_BASE_URL` + the inbox path. A dispatch is not complete until mail sends or is muted/skipped; Resend errors and a missing key stay retryable. Existing rows from before that change were marked complete.

Member footer (step 8): “You can modify your email preferences on Account Settings → Notifications.” Notifications links to `/account/settings?tab=notifications`. Operator mail omits that footer.

| ID | Subject | Body | Button |
| --- | --- | --- | --- |
| `invoice_issued` | Invoice ready — {planName} {amount} | Your {planName} renewal invoice for {amount} is open. Payment is due {dueAt}. / If you pay with Crypto, we collect from Account Balance in the hours before the due time. | View invoice → `/account/billing?tab=invoices` |
| `invoice_paid` | Payment received — {planName} {amount} | We recorded {amount} for {planName}. Your next period ends {periodEnd}. | View invoice → `/account/billing?tab=invoices` |
| `payment_failed` | Payment failed — {planName} | We could not collect {amount} for {planName}. {reason} / Update your card or top up Account Balance, then we will retry. | Open billing → `/account/billing` |
| `subscription_past_due` | Your subscription is past due | Your {planName} payment is overdue. Withdraws stay locked until this is paid. / Open Billing to pay or change method. | Open billing → `/account/billing` |
| `deposit_credited` | Account Balance credited — {amount} | {amount} was credited to Account Balance from your {token} deposit. | View Account Balance → `/account/billing?tab=wallet` |
| `account_shortfall` | Account Balance is short for your next payment | Your next {planName} payment is {amount}. Account Balance is {mainUsd} (short {shortUsd}). / Top up before we collect or the invoice will stay unpaid. | Top up → `/account/billing?tab=wallet` |
| `commission_released` | Commission released — {amount} | {amount} left hold and was credited to your Affiliate book. You can withdraw any amount at or above the minimum. | Open Affiliates → `/affiliates?tab=payouts` |
| `payout_requested` | Withdraw requested — {amount} | We queued {amount} USDT to {addressShort} on {network}. Click sends it from the admin wallet and marks the list paid. | Payouts (Affiliates or Billing by book) |
| `payout_paid` | Withdraw paid — {amount} | {amount} USDT was marked paid to {addressShort} on {network}. | Payouts (by book) |
| `payout_rejected` | Withdraw rejected — {amount} | Your {amount} USDT withdraw was rejected.{optionalNote} / The amount is back on your {bookLabel}. | Payouts (by book) |
| `copy_invite_received` | Copy invite — {deskName} | {traderAlias} invited you to copy {deskName}. Open Copy Trading to accept or ignore. | Open Copy Trading → `/account/copy` |
| `copy_invite_revoked` | Copy invite withdrawn — {deskName} | The invite to copy {deskName} was withdrawn. | Open Copy Trading → `/account/copy` |
| `desk_sync_failed` | Desk sync failed — {deskName} | {deskName} could not sync with {venue}. {detail} / The bot stays as it is until this is fixed. Check the desk Activity log. | Desk Activity |
| `desk_order_failed` | Live order failed — {deskName} | {deskName} hit a repeating {venue} reject ({detail}). / Open the desk, fix the bind or size, or disarm the bot. | Desk |
| `exchange_verify_failed` | Exchange key failed — {connectionName} | We could not verify {connectionName} ({venue}). Live desks on this key will not place until you replace it. | Open Exchanges → `/account/sub-accounts?tab=exchanges` |
| `password_changed` | Your password was changed | The password for this {platformName} login was changed. If you did not do this, reset it and contact support. | Account settings → `/account/settings` |
| `operator_payout_requested` | Payout to send — {bookLabel} {amount} | {memberLabel} requested {amount} USDT ({bookLabel}) to {addressShort} on {network}. | Admin Affiliates or Billing withdrawals |
| `operator_sweep_failed` | Sweep failed — {chain} | A credited deposit on {chain} did not sweep ({detail}). The member credit stays. Retry on the next watch. | `/admin/billing` |
| `operator_gas_low` | Gas wallet low — {chain} | The gas wallet on {chain} is {balanceEth} ETH (threshold {thresholdEth}). Fund it so sweeps can pay gas. | `/admin/billing` |
| `operator_payment_failed` | Member payment failed — {memberLabel} | {memberLabel} ({planName}) failed to pay {amount}. {reason} | `/admin/members` |
| `operator_desk_critical` | Live desk issue — {deskName} | {memberLabel} desk {deskName} ({venue}) is failing: {detail} | `/admin/logs?level=error` |

Dispatch keys (step 3): `invoice:{invoiceId}`, `invoice-paid:{invoiceId}`, `payment-failed:{invoiceId\|intentId}:{day}`, `past-due:{userId}:{periodEnd}`, `deposit:{chain}:{txHash}:{logIndex}`, `shortfall:{userId}:{invoiceId}`, `commission:{commissionId}`, `payout:{payoutId}`, `payout-paid:{payoutId}`, `payout-rejected:{payoutId}`, `copy-invite:{shareId}`, `copy-invite-revoked:{shareId}`, `desk-sync:{accountId}:{day}`, `desk-order:{accountId}:{family}:{day}`, `exchange-verify:{connectionId}:{day}`, `password:{userId}:{changedAtMinute}`, `op-payout:{payoutId}`, `op-sweep:{depositTxId}`, `op-gas:{chain}:{day}`, `op-pay:{userId}:{invoiceId\|day}`, `op-desk:{accountId}:{family}:{day}`.

## Required-action badges

Computed. Never stored as todos.

**Member:** `past_due`, `account_shortfall` (collect window open), `unbound_live`, `desk_critical`, `copy_invite`, `update_card` (Card collection + `past_due`). A key on more than one desk is warned at bind time only — not an alert.

**Admin:** `affiliate_payouts`, `wallet_withdraws`, `sweep_failed`, `gas_low`, `past_due_members`, `desk_critical`. `desk_critical` counts live desks with a critical log in the last 30 minutes (same window as repeating-reject mail).

Header Inbox = unread inbox only. Overview / Billing / Affiliates = action counts. Footer admin / Admin Overview = admin action sum. The same count also sits on the destination tab: member Billing Overview (`past_due`), Manage Payment Method (`update_card`), Manage Account Balance (`account_shortfall`); admin Billing Overview (`sweep_failed` + `gas_low`) and Wallet withdrawal requests (`wallet_withdraws`). Copy invites sit on header Copy Trading and the All tab.

Platform kill switches: `platform_settings.disabled_emails` and `disabled_badges`. Off email or alert is a platform kill. Off does not clear the live work. Develop-only `demo_badge_counts` can overlay sample numbers so the chrome looks populated; production ignores that column. Admin Settings → Notifications & Alerts groups the same trigger on one row. Every section uses the same Email / In-app / Alert columns; admin In-app is a dash.

## Surfaces (from step 4)

- `/account/notifications` — Inbox (affiliate-only allowed). Status / Scope / Event filters (same Apply / Clear bar as desk Activity). 20 per page (`?page=`), same Previous / Next as Billing. Message / Date / Actions table with checkbox bulk Mark read / Mark unread. Desk notices open Activity with `?desk=` so the layout does not bounce.
- `/account/settings?tab=notifications`
- `/admin/settings?tab=notifications` (Member list + Admin list; Email / In-app / Alert)
- `/admin/email-templates` — locked `NoticeEmail` previews (same layout Resend sends). **Send test email** posts the sample via Resend (no inbox row). To defaults to the signed-in admin. From is Admin Settings → General (`platform_settings.email_from`, display name from `platform_name`).
- Header Inbox (unread only); amber action counts on Overview, Billing, Affiliates, and the destination tab / Copy Trading link
- Admin Overview, Billing, Affiliates amber counts
- Overview Attention + recent notifications widget. Admin Overview Attention lists gated admin alerts with links to Affiliates, Billing, Members, and Logs.

Desk Activity and blotters stay. They are not the inbox.

## Out of scope

- Trade fill / opened / closed / unwound notices
- Identity / 2FA / entitlements / Upgrade / grace (later V1 items)
- Onboarding wizard refine (V1 item 5)
- Internal webhooks (V2)
- Organisation / multi-seat **member** notification roles (FQX-only). Admin roles are [phase-admin-roles.md](phase-admin-roles.md).
- Bell dropdown
- Marketing mail

## After this

See [roadmap.md](roadmap.md). Identity and 2FA are accepted. Next V1 item is UI cleanup. Admin roles are V2 ([phase-admin-roles.md](phase-admin-roles.md)).
