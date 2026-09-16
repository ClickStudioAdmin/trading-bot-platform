# Admin roles

**Later phase.** Spec written 16 Sep 2026 as notifications step 7a. Click postponed it **16 Sep 2026** so notifications could finish Resend without role routing. Not in the locked sequence until Click places it. Operator mail stays every admin until this phase.

Do not implement until Click starts this item. Notifications stay [phase-notifications.md](phase-notifications.md). Entitlements stay [phase-entitlements.md](phase-entitlements.md).

Never trust the browser for admin permissions.

## Status

Not started. Plan only.

## Purpose

Admins create and assign **admin roles**. Each operator template is sent only to the roles ticked on that template (default: every admin role). `/admin` nav and server actions gate on the role’s permissions. Listed owner email stays a full-access role that cannot be locked out.

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Roles + gates | Agent | Role CRUD, `requireAdmin(permission)`, nav hide, operator **Send to roles**. Seed Admin + Owner. Stop. |

Stop after the micro-step until Click says go.

## How it works

Admins create named **admin roles**. Each role has a permission set that matches today’s admin surfaces: Overview, Settings, Plans, Billing & Wallets, Affiliates, Members, Templates, Logs, Theme, and **Roles** (who can edit roles). Existing `members.role = admin` land on a seed **Admin** role with every permission. `click.studio.admin@gmail.com` (and any later listed owner) is an **Owner** role: all permissions, cannot be deleted, cannot lose Roles or be demoted by a lesser admin.

`requireAdmin` becomes `requireAdmin(permission)`. The nav hides links the role cannot use. Server actions still reject. Never trust the browser.

Each operator template has **Send to roles** (multi-select). Empty / all-on means every admin role. Off for a role skips that mail. Platform email kill switch still wins. Member inbox is unchanged.

Role CRUD lives on `/admin/members` or `/admin/settings` (lock the screen with Click when this phase starts). Assign a role when promoting a member to admin.

## Out of scope

- Notifications product (roadmap 6) except applying role routing to operator mail
- Entitlements / identity (roadmap 7)
- Organisation / multi-seat **member** roles (FQX-only)
