# Entitlements, identity, and plan gates

**Roadmap 7.** Spec written 16 Sep 2026. These were membership steps 9–11, then sat as roadmap 8. Click moved this phase to **immediately after notifications** on 16 Sep 2026 and added identity: email verification and optional 2FA. Onboarding is now roadmap 8. Internal webhooks stay roadmap 9.

Do not implement until Click starts this item. Membership billing, wallets, and affiliates stay [phase-membership.md](phase-membership.md) (roadmap 5, closed at step 8). Admin roles and role-routed operator mail stay notifications step **7a** ([phase-notifications.md](phase-notifications.md)).

Never trust the browser for entitlements, verification, 2FA, or admin permissions. Server actions reject.

## Status

Not started. Plan only.

## Purpose

Prove the login (verified email, optional 2FA) then gate product on the settled plan. Free can test; paid unlocks Live, copy, backtest, and higher caps. Surfaces stay **visible and disabled** with an **Upgrade** banner. A plan can require verified email and/or 2FA before those unlocks apply. After a downgrade, extras stay operable through admin grace, then the worker Close/Disables oldest desk first.

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Email verification | Agent | Signup (platform and affiliate-only) sends a one-time link or code. Unverified logins cannot reach paid unlocks or change security settings that assume a proven inbox. Changing password sends a confirmation to the current email and does not complete until that check passes. `password_changed` notice still fires after the change. Stop. |
| 2 | Optional 2FA | Agent | Member can enable TOTP 2FA on Account Settings. Recovery codes shown once. Sign-in asks for the code when enabled. A plan may **require** 2FA (admin plan flag). Required + not enabled: same visible/disabled + Upgrade (or “Turn on 2FA”) pattern as other gates. Server rejects. Stop. |
| 3 | Entitlements + Upgrade UX | Agent | `assertEntitlement` on create desk, Live, copy, backtest, caps, and identity flags from steps 1–2. Controls disable; page/inline **Upgrade** names the cheapest public plan that unlocks it. Cap notice: “You have 2 of 2 desks. Upgrade to add another.” Server actions reject. Billing page already exists. Stop. |
| 4 | Downgrade grace | Agent | Entitlements change at period end. Admin grace days (default 7, already saved on `/admin/affiliates`). Banner + operable extras. After grace, billing worker Close/Disable **oldest desk first**: forbidden features, then numeric caps. Upgrade during grace cancels the sweep. Ledgers stay. Stop. |
| 5 | Desk test | Click | Verify email on signup and on password change. Optional 2FA on/off; a plan that requires it. Free gates visible/disabled. Upgrade Stripe test. Crypto top-up + leftover debit. Affiliate list/chart/stats. Hold then withdraw. Downgrade grace then oldest-first exit. Archive a used plan (cannot delete). |

Stop after each micro-step until Click says go. After step 5, stop and wait.

## How it works

### Identity

Email verification uses a signed, single-use token (or short code) mailed through the notifications / Resend path once roadmap 6 step 8 is live. Until then this phase waits or no-ops send the same way `notify()` does today.

Password change: current password + new password, then email confirm. The password does not change if the confirm is missing or expired. Optional 2FA, when enabled, is also required to change the password.

2FA is TOTP on the login, not SMS. Secrets encrypted at rest with the same class of key as other credentials. Recovery codes are hashed. Do not put secrets in `NEXT_PUBLIC_` or the browser bundle beyond the enroll QR that the signed-in member asked for.

### Gates

UI **never hides** a gated surface. Disable the control. Persistent **Upgrade** banner (and the same line on the control) names the plan that unlocks it. Hitting a cap does not hide Create desk — notice + disabled action. Unverified email or missing required 2FA uses the same pattern with copy that says verify or turn on 2FA. Server still rejects.

Plan-limit and Upgrade notices can use the notifications catalog when this phase starts. Do not add those templates in roadmap 6.

### Downgrade and over-quota

Upgrade is immediate access. Downgrade entitlements change at **period end**, then grace (admin days, default **7**).

During grace: banner lists what’s over and days left. Cannot add further extras. Existing extras stay operable so they can flatten themselves. Upgrade during grace **cancels** the auto-exit.

After grace, a billing worker (same Close / Disable paths as the user) walks **oldest desk first** (`created_at`):

1. Forbidden features (type, Live, venue, copy, …) — exit those desks oldest-first until none remain.
2. Numeric caps — disable the oldest extras until `assertEntitlement` would pass.

Per desk: cancel working orders, market-exit positions, disable bots, disable the desk. Oldest bot first when only the per-desk bot cap is over. Do not delete ledgers, fills, or history. Engine ticks honour the flags the worker set.

## Out of scope

- Notifications product (roadmap 6) — already its own phase, including admin roles (step 7a)
- Onboarding wizard refine (roadmap 8)
- Internal webhooks (roadmap 9)
- Scale-in (roadmap 11)
- SMS 2FA, passkeys, WebAuthn (unless Click adds them later)
- Full KYC

## After this

Onboarding / Starter Packs is roadmap 8. Internal webhooks is roadmap 9. Backup market data is roadmap 10.
