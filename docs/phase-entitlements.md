# Identity, entitlements, and plan gates

Identity is **V1 item 1**. Plan / 2FA gates are **V1 item 4**. Optional login 2FA is its own item: [phase-2fa.md](phase-2fa.md) (V1 item 2). Locked order: [roadmap.md](roadmap.md).

Membership billing, wallets, and affiliates stay [phase-membership.md](phase-membership.md) (shipped). Admin roles are V2 ([phase-admin-roles.md](phase-admin-roles.md)). The first-desk `/welcome` wizard was removed in identity; new users land on Overview after they verify.

Never trust the browser for entitlements, verification, 2FA, or admin permissions. Server actions reject.

## Status

**V1 item 1 (identity) in repo** 16 Sep 2026: verify on signup + forgot password + unverified wall. Stop. Do not start 2FA (V1 item 2) or gates (V1 item 4) until Click says go.

## Purpose

Prove the login (verified email; later optional 2FA) then, in V1 item 4, gate product on the settled plan. Free can test; paid unlocks Live, copy, backtest, and higher caps. Surfaces stay **visible and disabled** with an **Upgrade** banner. A plan can require verified email and/or 2FA before those unlocks apply. After a downgrade, extras stay operable through admin grace, then the worker Close/Disables oldest desk first.

## V1 items this file covers

| V1 | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Email verification + forgot password | Agent | Signup (platform and affiliate) creates the login, signs them in, and mails a one-time verify link. Unverified logins hit a **verify wall** (below). Public forgot-password mails a one-time reset link. Existing members are grandfathered verified. First-desk `/welcome` wizard removed; verified new users land on `/account`. **In repo 16 Sep 2026.** |
| 4a | Entitlements + Upgrade UX | Agent | `assertEntitlement` on create desk, Live, copy, backtest, caps, and identity flags. A plan may **require** verified email and/or 2FA (admin plan flag). Controls disable; page/inline **Upgrade** (or “Turn on 2FA”) names the cheapest public plan that unlocks it. Cap notice: “You have 2 of 2 desks. Upgrade to add another.” Server actions reject. Billing page already exists. Stop. |
| 4b | Downgrade grace | Agent | Entitlements change at period end. Admin grace days (default 7, already saved on `/admin/affiliates`). Banner + operable extras. After grace, billing worker Close/Disable **oldest desk first**: forbidden features, then numeric caps. Upgrade during grace cancels the sweep. Ledgers stay. Stop. |
| 4c | Desk test | Click | Free gates visible/disabled. A plan that requires 2FA. Upgrade Stripe test. Crypto top-up + leftover debit. Affiliate list/chart/stats. Hold then withdraw. Downgrade grace then oldest-first exit. Archive a used plan (cannot delete). |

2FA enroll + sign-in only is [phase-2fa.md](phase-2fa.md), not a row here. Stop after each V1 item until Click says go.

## How it works

### Identity (V1 item 1 — in repo)

TBP already has email/password on `members` and a signed session cookie. There is no Supabase Auth. Keep that. Add proof of inbox, then a public reset path.

**Auth mail is not the inbox catalog.** Verify and reset links never write `user_notifications` and are not muteable. They use the same Resend + `NoticeEmail` layout and `APP_BASE_URL`. If Resend is unset, send no-ops (develop can still click a logged or admin-shown link only if we add a develop-only resend on `/account/verify` — no token in the browser by default). `password_changed` still fires after a successful reset or signed-in change.

#### Email verify on signup

1. Public `/sign-up` and affiliate `/affiliates` signup stay as they are: create the row, hash the password, create the session.
2. New rows have `email_verified_at` null.
3. Send a one-time link to that address: `{APP_BASE_URL}/verify-email?token=…`.
4. Land them on `/account/verify` (“Check your email”), not Overview and not the affiliate portal.
5. Later sign-in with an unverified login also lands on `/account/verify`. Password can still be used to sign in — we do not lock them out of the session.
6. The mail link opens `/verify-email?token=` and asks them to click **Confirm email** (mail scanners cannot consume the token). That sets `email_verified_at`, consumes the token, then sends them on: `/account` if they have no desk, else desk home; affiliate-only to `/affiliates`.
7. Resend from `/account/verify` (rate-limited). Same always-ok copy if we add a public “didn’t get it” later.

**Tokens.** Table `member_email_tokens`: `id`, `user_id`, `purpose` (`verify` | `reset`), `token_hash`, `expires_at`, `used_at`. Store SHA-256 of a random secret, never the raw token. Verify link lasts **24 hours**. One unused token per user+purpose — a resend replaces the old one. Service-role only. Never `NEXT_PUBLIC_`.

**Who is already verified**

- Migration: existing `members` get `email_verified_at = created_at` so current logins are not walled.
- Admin-created members: verified at create (admin typed the address). Admin can still force a re-verify later if we add that control; not this step.
- Listed owner first-login bootstrap: verified when the row is created.

#### Forgot password

Public pages, no session required.

1. `/forgot-password` — email only. Always “If that login exists, we sent a link.” Do not reveal whether the email is known.
2. Mail a one-time link `{APP_BASE_URL}/reset-password?token=…` (**1 hour**). Same token table, purpose `reset`.
3. `/reset-password` — new password + confirm. Invalid/expired token shows a generic fail and a link back to forgot.
4. On success: set the hash, mark `email_verified_at` (they proved the inbox), consume the token, fire `password_changed`, send them to `/sign-in`. Do not auto-create a session from the token alone after reset (they sign in with the new password).
5. Rate-limit sends (about one per 2 minutes per email). Same always-ok copy.

**Signed-in password change** (same step, Settings → Password): current password + new password. Apply immediately as today, then `password_changed`. A second confirm-before-apply mail is **not** this slice — forgot-password covers a lost inbox. Unverified users cannot reach Settings to change password (they are on the wall).

#### Verify wall (how they are restricted)

Until `email_verified_at` is set, the login is signed in but **cannot use the product**. Same rule for platform and affiliate-only.

**Allowed**

- `/account/verify` (status, resend)
- `/verify-email` (consume the link)
- `/forgot-password`, `/reset-password`
- `/sign-in`, `/sign-up`, `/sign-out`
- Public marketing (`/`, `/pricing`, `/r/…`)
- Session cookie / sign-out

**Blocked** (redirect to `/account/verify`; server actions reject)

- Desk create and every desk route (Positions, Automations, Activity, …)
- `/account/*` except verify (Overview, Inbox, Settings, Billing, Exchanges, Copy, Backtests)
- `/affiliates` portal after the public sell page — an unverified affiliate-only login does not get the dashboard, payouts, or settings
- `/admin/*`
- Tick, webhooks, engine actions as that user (they have no desk yet on a fresh signup; existing grandfathered users are already verified)

UI may show the verify page only — do not leave gated desk chrome visible “disabled” for this wall. That Upgrade-and-disable pattern is for plan gates in V1 item 4. This wall is “prove the inbox first.”

Never trust the browser. `requireVerifiedEmail()` on every mutating server action that is not verify/resend/sign-out.

#### Out of this slice

- Change-email flow (V2)
- 2FA enroll + sign-in ([phase-2fa.md](phase-2fa.md), V1 item 2)
- `assertEntitlement` / Upgrade banners (V1 item 4)
- Downgrade grace (V1 item 4)
- Onboarding wizard refine (V1 item 5)

### Gates

UI **never hides** a gated surface. Disable the control. Persistent **Upgrade** banner (and the same line on the control) names the plan that unlocks it. Hitting a cap does not hide Create desk — notice + disabled action. Unverified email or missing required 2FA uses the same pattern with copy that says verify or turn on 2FA. Server still rejects.

Plan-limit and Upgrade notices can use the notifications catalog when V1 item 4 starts. Do not add those templates during identity.

### Downgrade and over-quota

Upgrade is immediate access. Downgrade entitlements change at **period end**, then grace (admin days, default **7**).

During grace: banner lists what’s over and days left. Cannot add further extras. Existing extras stay operable so they can flatten themselves. Upgrade during grace **cancels** the auto-exit.

After grace, a billing worker (same Close / Disable paths as the user) walks **oldest desk first** (`created_at`):

1. Forbidden features (type, Live, venue, copy, …) — exit those desks oldest-first until none remain.
2. Numeric caps — disable the oldest extras until `assertEntitlement` would pass.

Per desk: cancel working orders, market-exit positions, disable bots, disable the desk. Oldest bot first when only the per-desk bot cap is over. Do not delete ledgers, fills, or history. Engine ticks honour the flags the worker set.

## Out of scope

- Notifications product — already shipped. Admin roles are V2 ([phase-admin-roles.md](phase-admin-roles.md))
- Onboarding wizard refine (V1 item 5)
- Internal webhooks, scale-in, SMS 2FA, passkeys, WebAuthn, KYC (V2)

## After this

V1 item 2 is 2FA ([phase-2fa.md](phase-2fa.md)). V1 item 3 is UI cleanup. V1 item 4 is the gates in this file. Then onboarding (V1 item 5). See [roadmap.md](roadmap.md).
