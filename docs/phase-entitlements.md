# Entitlements, Upgrade UX, and downgrade grace

**Roadmap 8.** Spec written 16 Sep 2026. These were membership steps 9–11. Click moved them out so notifications (roadmap 6) could start first, and parked this phase **before internal webhooks** (roadmap 9).

Do not implement until Click starts this item. Membership billing, wallets, and affiliates stay [phase-membership.md](phase-membership.md) (roadmap 5, closed at step 8).

Never trust the browser for entitlements or admin permissions. Server actions reject.

## Status

Not started. Plan only.

## Purpose

Gates land on settled billing and notification surfaces. Free can test; paid unlocks Live, copy, backtest, and higher caps. Surfaces stay **visible and disabled** with an **Upgrade** banner. After a downgrade, extras stay operable through admin grace, then the worker Close/Disables oldest desk first.

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Entitlements + Upgrade UX | Agent | `assertEntitlement` on create desk, Live, copy, backtest, caps. Controls disable; page/inline **Upgrade** names the cheapest public plan that unlocks it. Cap notice: “You have 2 of 2 desks. Upgrade to add another.” Server actions reject. Billing page already exists. Stop. |
| 2 | Downgrade grace | Agent | Entitlements change at period end. Admin grace days (default 7, already saved on `/admin/affiliates`). Banner + operable extras. After grace, billing worker Close/Disable **oldest desk first**: forbidden features, then numeric caps. Upgrade during grace cancels the sweep. Ledgers stay. Stop. |
| 3 | Desk test | Click | Free gates visible/disabled. Upgrade Stripe test. Crypto top-up + leftover debit. Affiliate list/chart/stats. Hold then withdraw. Downgrade grace then oldest-first exit. Archive a used plan (cannot delete). |

Stop after each micro-step until Click says go. After step 3, stop and wait.

## How it works

### Gates

UI **never hides** a gated surface. Disable the control. Persistent **Upgrade** banner (and the same line on the control) names the plan that unlocks it. Hitting a cap does not hide Create desk — notice + disabled action. Server still rejects.

Plan-limit and Upgrade notices can use the notifications catalog when this phase starts. Do not add those templates in roadmap 6.

### Downgrade and over-quota

Upgrade is immediate access. Downgrade entitlements change at **period end**, then grace (admin days, default **7**).

During grace: banner lists what’s over and days left. Cannot add further extras. Existing extras stay operable so they can flatten themselves. Upgrade during grace **cancels** the auto-exit.

After grace, a billing worker (same Close / Disable paths as the user) walks **oldest desk first** (`created_at`):

1. Forbidden features (type, Live, venue, copy, …) — exit those desks oldest-first until none remain.
2. Numeric caps — disable the oldest extras until `assertEntitlement` would pass.

Per desk: cancel working orders, market-exit positions, disable bots, disable the desk. Oldest bot first when only the per-desk bot cap is over. Do not delete ledgers, fills, or history. Engine ticks honour the flags the worker set.

## Out of scope

- Notifications product (roadmap 6) — already its own phase
- Onboarding wizard refine (roadmap 7)
- Internal webhooks (roadmap 9)
- Scale-in (roadmap 11)

## After this

Internal webhooks is roadmap 9. Backup market data is roadmap 10.
