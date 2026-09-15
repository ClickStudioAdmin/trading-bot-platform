# Transactional notifications and email

**Roadmap 6.** Spec locked 16 Sep 2026. Click split this out of old roadmap 7 and started it after membership steps 1–8. Entitlements stay [phase-entitlements.md](phase-entitlements.md) (roadmap 8). Hyperliquid step 7 and copy step 10 stay Click desk-test.

Clone the FQX split: one catalog ID drives email, inbox, and settings; required-action badges are **computed live** from domain state; the inbox is the email mirror, not `event_logs`. TBP has no organisations. Inbox and prefs key on `user_id`.

No trade fills, adds, or closes in this phase.

Never trust the browser for payment status, desk health, or unread counts.

## Status

Steps 1–5 in repo 16 Sep 2026 (docs, schema, catalog + `notify()`, inbox + badges, settings). Next is step 6 (wire commercial `notify()`). Push `develop` to migrate. Do not add Resend until step 8.

## Purpose

Members and admins see numbered badges for work they must do, plus an inbox of notices that can also go out as email. Admin and each login control the switches. Critical live-desk failures page and persist ([click-list.md](click-list.md) item 12).

`desk_critical`, `update_card`, `sweep_failed`, and `gas_low` badge loaders return 0 until steps 6–7 write those signals.

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | This file is the phase. Roadmap split applied. **In repo 16 Sep 2026.** |
| 2 | Schema | Agent | `user_notifications`, `user_notification_preferences`, `email_dispatches`, `platform_settings.disabled_emails`. RPCs for insert / mark read / unread / claim dispatch / upsert prefs. Inbox by `user_id`. Service-role only. Push `develop` to migrate. **In repo 16 Sep 2026.** |
| 3 | Catalog + `notify()` | Agent | TypeScript catalog, locked copy, preference checks, dispatch claim. Email no-ops if Resend is unset. Tests for mutes, operator skip, idempotency keys. **In repo 16 Sep 2026.** |
| 4 | Inbox + badges | Agent | `/account/notifications`, Overview widget, amber `NavBadge`, header mix (actions + unread), extend Attention. Affiliate-only allowed on Inbox. Stop. **In repo 16 Sep 2026.** |
| 5 | Settings | Agent | `/account/settings` Notifications tab (Email / In-app per event). `/admin/settings` Notifications tab (platform email kill switches + Sent to). Stop. **In repo 16 Sep 2026.** |
| 6 | Wire commercial | Agent | `notify()` from billing, affiliate payouts, copy invites, password change. Stop. |
| 7 | Wire critical + operator | Agent | Deduped live-desk critical, sweep fail, gas low, operator mail. Absorb click-list 12. Stop. |
| 8 | Resend + desk test | Agent + Click | `RESEND_API_KEY` + `EMAIL_FROM` on Vercel and Fly (develop ≠ production). One `NoticeEmail` layout. Mute, unread, badge clear, no fill spam. Stop. |

Stop after each micro-step until Click says go. Do not start entitlements, onboarding refine, or internal webhooks.

## How it works

```
Domain action → notify(template, user)
                 → email (Resend; skip if muted or key missing)
                 → inbox row (skip operator templates and in-app mutes)

Live domain state → action counts → amber numbered badge (cap 99+)
Inbox unread     → Inbox nav + folded into header with actions
```

**Inbox** is informational history. **Badges** are the work queue. A read inbox row does not clear a badge.

No bell dropdown. Inbox page + nav. Theme tokens only.

Operator templates email admins only and never write a member inbox row.

`password_changed` email is not mute-able. Other member templates respect platform then user mutes.

Affiliate-only logins: Inbox + Settings; billing / affiliate / security subset; no desk-critical or unbound-live badges.

## Catalog

Same ID in email, inbox, and settings.

**Member — email + in-app default on:** `payment_failed`, `subscription_past_due`, `account_shortfall`, `payout_rejected`, `copy_invite_received`, `desk_sync_failed`, `desk_order_failed`, `exchange_verify_failed`, `password_changed` (email not mute-able).

**Member — in-app on, email off:** `invoice_issued`, `invoice_paid`, `deposit_credited`, `commission_released`, `payout_requested`, `payout_paid`, `copy_invite_revoked`.

**Operator — email only:** `operator_payout_requested`, `operator_sweep_failed`, `operator_gas_low`, `operator_payment_failed`, `operator_desk_critical`.

**Not this phase:** fills, blotter chatter, plan-limit / Upgrade / grace (roadmap 8), marketing, password-reset (current auth), `engine.tick`, `deposit_watched`, admin CRUD.

## Email templates

FQX `NoticeEmail` shape: subject = heading = preview; one or two short paragraphs; one button. Inbox title = subject. Inbox body = first paragraph. Amounts USD. From name Trading Bot Platform.

Member footer (step 8): “You can change these emails on Account Settings → Notifications.” Operator mail omits that footer.

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
| `exchange_verify_failed` | Exchange key failed — {connectionName} | We could not verify {connectionName} ({venue}). Live desks on this key will not place until you replace it. | Open Exchanges → `/account/exchanges` |
| `password_changed` | Your password was changed | The password for this Trading Bot Platform login was changed. If you did not do this, reset it and contact support. | Account settings → `/account/settings` |
| `operator_payout_requested` | Payout to send — {bookLabel} {amount} | {memberLabel} requested {amount} USDT ({bookLabel}) to {addressShort} on {network}. | Admin Affiliates or Billing withdrawals |
| `operator_sweep_failed` | Sweep failed — {chain} | A credited deposit on {chain} did not sweep ({detail}). The member credit stays. Retry on the next watch. | `/admin/billing` |
| `operator_gas_low` | Gas wallet low — {chain} | The gas wallet on {chain} is {balanceEth} ETH (threshold {thresholdEth}). Fund it so sweeps can pay gas. | `/admin/billing` |
| `operator_payment_failed` | Member payment failed — {memberLabel} | {memberLabel} ({planName}) failed to pay {amount}. {reason} | `/admin/members` |
| `operator_desk_critical` | Live desk issue — {deskName} | {memberLabel} desk {deskName} ({venue}) is failing: {detail} | `/admin/logs?level=error` |

Dispatch keys (step 3): `invoice:{invoiceId}`, `invoice-paid:{invoiceId}`, `payment-failed:{invoiceId\|intentId}:{day}`, `past-due:{userId}:{periodEnd}`, `deposit:{chain}:{txHash}:{logIndex}`, `shortfall:{userId}:{invoiceId}`, `commission:{commissionId}`, `payout:{payoutId}`, `payout-paid:{payoutId}`, `payout-rejected:{payoutId}`, `copy-invite:{shareId}`, `copy-invite-revoked:{shareId}`, `desk-sync:{accountId}:{day}`, `desk-order:{accountId}:{family}:{day}`, `exchange-verify:{connectionId}:{day}`, `password:{userId}:{changedAtMinute}`, `op-payout:{payoutId}`, `op-sweep:{depositTxId}`, `op-gas:{chain}:{day}`, `op-pay:{userId}:{invoiceId\|day}`, `op-desk:{accountId}:{family}:{day}`.

## Required-action badges

Computed. Never stored as todos.

**Member:** `past_due`, `account_shortfall` (collect window open), `unbound_live`, `shared_key` (already on Overview Attention), `desk_critical`, `copy_invite`, `update_card`.

**Admin:** `affiliate_payouts`, `wallet_withdraws`, `sweep_failed`, `gas_low`, `past_due_members`, `desk_critical`.

Header account badge = member actions + unread inbox. Header admin / Overview = admin action sum.

## Surfaces (from step 4)

- `/account/notifications` — Inbox (affiliate-only allowed)
- `/account/settings?tab=notifications`
- `/admin/settings?tab=notifications`
- Account sidenav Inbox unread; amber counts on Overview, Billing, Affiliates
- Admin Overview, Billing, Affiliates amber counts
- Overview Attention + recent notifications widget

Desk Activity and blotters stay. They are not the inbox.

## Out of scope

- Trade fill / opened / closed / unwound notices
- Entitlements, Upgrade UX, downgrade grace (roadmap 8)
- Onboarding wizard refine (roadmap 7)
- Internal webhooks (roadmap 9)
- Organisation / multi-seat notification roles (FQX-only)
- Bell dropdown
- Marketing mail

## After this

Onboarding is roadmap 7. Entitlements is roadmap 8. Internal webhooks is roadmap 9.
