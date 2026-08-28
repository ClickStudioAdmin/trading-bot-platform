# Automation templates and template sets

Shipped. **Not Phase 12** (scale-in). Not backup market data.

Phase 11 is complete. See [phase-11.md](phase-11.md). This is a **login-scoped recipe library** that stamps idle automations onto a desk of the matching type. Migrations: `supabase/migrations/20260828100000_automation_templates.sql`, `supabase/migrations/20260828110000_automation_template_shares.sql` (apply on push to `develop`).

## Purpose

Users save a playbook or automation as a **template**, or several templates as a **template set**. They create a new idle recipe from one template, or stamp a whole set onto a desk. Admins get extra controls to publish **platform** templates and sets, and an admin library that lists **every** template and set (user and platform). Every member can apply their own templates and platform templates. Desk types that already have automations: **DCA**, **Perps**, **Cash and Carry**. TradingView Strategy desks have no recipe form — out of scope.

Clone on Automations stays. Clone is an in-desk duplicate of one live row. Templates are a library, reusable across desks of the same type.

## Why not many pairs on one playbook

A live DCA playbook still owns one contract (`unique (account_id, symbol)`). Templates do not change that. A set is the way to “install ETH + SOL + BTC with the same idea”: one template per pair (or one template applied three times with three contracts), each becoming its own playbook. Runtime, GTC ladders, TP/SL, and Close playbook stay per contract.

## Current facts this plan sits on

- Four desk types: `cash_and_carry`, `perps`, `signal_follower`, `dca`. Type is immutable.
- Automations today: C&C `paper_rules`; Perps `futures_automation_rules`; DCA `dca_playbooks`; TV Strategy is webhook-only.
- Recipes are **typed columns**, not JSON, on the live tables. Clone today is a **client draft** (`dcaCloneIdleDraft`, `cloneFuturesAutomationForm`, `clonePaperLayerForm`) until Save.
- Writes go through server actions and the service role. Never trust the browser for permissions.
- Admin is `members.role = admin` or listed email (`click.studio.admin@gmail.com`). Extra UI is admin-only; apply to a desk is not admin-only.

## Locked decisions

| # | Choice | Decision |
| --- | --- | --- |
| 1 | Perps / C&C mode after apply | Always **`disabled`**. Source mode is not copied. A set cannot surprise-trade. The user enables the rule on the desk. DCA apply stays **idle** (not armed). |
| 2 | Member library | **`/account/templates`**. Login-scoped. View and manage own templates and sets; browse platform (read-only except Apply). Account nav gains Templates. |
| 3 | Publish to platform | **Copy**, do not promote. The user row stays. Platform is a snapshot with its own id. The member can keep iterating; admins can edit the platform copy without rewriting the user’s library. If the platform name is taken, the confirm dialog asks for another name. |
| 4 | Set apply | **Skip failures, keep successes.** Not all-or-nothing. The wizard can remap a DCA symbol (or skip) **before** write. After write, a result list shows applied / skipped / failed. One taken contract must not roll back the rest of the set. |
| 5 | Names | **Unique per owner + desk type**, case-insensitive. Same name is allowed for a different user, or for a different `desk_type`. Platform names are unique per `desk_type` among platform rows. Sets use the same uniqueness as templates. |
| 6 | Admin library | **`/admin/templates`**. Admins view and manage **user and platform** templates and sets. Left admin nav. Members never see this page. |

## Shape

### Template

A named snapshot of **one** idle recipe for **one** `desk_type`.

Stored as versioned JSON (`recipe` + `recipe_version`) plus metadata. Live tables keep evolving with migrations; apply runs the same parsers the Save form uses (defaults for missing keys, reject unknown desk type). Do not create parallel copies of every playbook column.

**Snapshot includes:** name (as default for the new row), contract/symbol if present, sizing, start, averaging, exits, Perps action/trigger, C&C set filters — the fields a user would type on Automations.

**Snapshot never includes:** API keys, webhook tokens, `webhook_id` (desk-specific door), runtime (`condition_true`, `clips_filled`, `long_*` / `short_*` status, `last_fired_at`, arm/disarm latches), position or working-order ids, reduce-only / desk caps.

After apply:

- DCA: new playbook **idle** (not armed).
- Perps and Cash and Carry: new rule **`disabled`**. Never copy `mode` / `enabled` from the source.
- Signal webhook unbound (`webhook_id` null). Copy: “Bind a Signal on this desk after apply.”
- User must Save / Arm / Enable as today. Never place orders on apply.

### Template set

An ordered list of templates. All members of a set share one `desk_type`.

- A **user set** may include the owner’s templates and/or platform templates.
- A **platform set** may only include platform templates.

Applying a set walks the list and applies each template to a **chosen desk** of that type. Collisions (DCA same symbol already on the desk) are handled in the apply wizard, not by merging into one playbook. C&C stacked layers on the same pair stay allowed, same as today.

### Visibility

| Kind | Who writes | Who reads / applies |
| --- | --- | --- |
| User template / set | Owning member; admins may rename, describe, or delete from `/admin/templates` | Owner applies to **their** desks. Other members cannot see it unless it is **shared** with them. Admins see every user row on the admin page. |
| Platform template / set | Admin only | Every member can read and apply. Members cannot edit or delete. |
| Shared template / set | Owner (or admin) grants access by recipient email; stored as `to_user_id` | Recipient can apply to **their** desks. Read-only on Shared tabs. Cannot edit, delete, or re-share. |

Share is a grant, not a copy. The owner keeps the recipe. Deleting the template or set drops the shares. Platform recipes are already public — do not share them.

## Export and import

`/account/templates` and `/admin/templates` both have **Export all** and **Import all**.

- Account export is the current member’s **user** templates and sets (not platform, not inbound shares).
- Admin export is every template and set in the database.
- Import always creates **new user-owned copies** for the signed-in member. Name collisions get a ` (import)` suffix. Sets remap to the newly inserted templates. Invalid recipes are skipped.

The file format is `tbp.automation-templates` version 1 JSON. No API keys or webhook tokens.

## Data (proposed)

GitHub migrations when this work starts. Names are indicative.

`automation_templates`

- `id` uuid
- `user_id` uuid null (null only when `visibility = platform`)
- `visibility` `user` \| `platform`
- `desk_type` `dca` \| `perps` \| `cash_and_carry`
- `name` text
- `description` text null
- `recipe` jsonb not null
- `recipe_version` integer not null
- `created_at` / `updated_at`
- Check: platform ⇒ `user_id` is null; user ⇒ `user_id` is set
- Partial unique: `(user_id, lower(name), desk_type)` where `visibility = user`
- Partial unique: `(lower(name), desk_type)` where `visibility = platform`

`automation_template_sets`

- `id`, `user_id` (same null rule), `visibility`, `desk_type`, `name`, `description`, timestamps
- Same uniqueness as templates

`automation_template_set_items`

- `set_id`, `template_id`, `sort_order`
- Unique `(set_id, template_id)`
- `ON DELETE CASCADE` from template: deleting a template drops it from sets that listed it
- Trigger: template `desk_type` must match set `desk_type`; platform set ⇒ platform template only

`automation_template_shares` / `automation_template_set_shares`

- `template_id` or `set_id`, `from_user_id`, `to_user_id`, `created_at`
- Unique `(template_id, to_user_id)` / `(set_id, to_user_id)`
- Cannot share with yourself. Cannot share platform rows.
- Service-role writes. Authenticated select if you are `from` or `to`.

**RLS (member client):** authenticated select own user rows **or** `visibility = platform`. Insert/update/delete own user rows only. Platform writes and admin reads of **other members’** user rows are **service role only** (server actions). Do not add an RLS policy that lets an admin JWT `select *` every recipe from the browser.

Save-as-template with a name the owner already uses for that desk type: dialog asks to rename. Do not overwrite in place unless the user confirms **Replace existing template**.

## Apply rules

1. Chosen desk `desk_type` must equal the template (or set) `desk_type`. Wrong type is a hard error.
2. DCA: insert a new playbook. If `(account_id, symbol)` is taken, the wizard asks for another contract or skip. Do not overwrite a live playbook.
3. Perps / C&C: insert a new stacked rule, **`disabled`**. Name collision on the desk: suffix ` (from template)` or ask.
4. Rebind Signal webhook: leave `webhook_id` null.
5. Never arm, never enable the C&C engine, never place orders.
6. Paper vs Live: a template is venue-agnostic recipe. Apply to whichever mode the desk already has. Size vs ticket-size is the same Save guard as today.
7. Set apply: remap/skip in the wizard first. Then write item by item. Successes stay. Failures (parse error, unique symbol after remap, missing template) are listed. No rollback of siblings.

Apply from Automations uses the current `?desk=`. Apply from `/account/templates` uses a **desk picker** (member’s desks of that type only).

## UI

Tokens from [ui-theme.md](ui-theme.md).

### Automations (desk)

- Header: **Add**, **From template**, **From set**. Picker: Platform group, then My templates. Preview name, description, contract. Confirm apply to **this** desk.
- Each recipe card: **Save as template**. Admins also see **Save as platform template** (confirm: visible to every member).
- TradingView Strategy desk: no From template. Webhook tokens are not templates.

### `/account/templates` (every member)

Login library. Not desk-scoped. Account nav: Templates, with Settings, Exchanges, Manage desks.

- Tabs: **Templates**, **Sets**, **Shared Templates**, **Shared Sets**. Filter by desk type (All / DCA / Perps / Cash and Carry).
- **Export all** / **Import all** JSON library file.
- **My templates:** rename, description, delete, share by email (stored as the recipient’s user id). Create a set from checkboxes (same `desk_type` only).
- **Platform:** read-only cards. **Apply** opens a desk picker (matching type). Members cannot edit or delete platform rows here.
- **Shared Templates / Shared Sets:** recipes another member shared with this login. Label shows who shared them. Apply only. **Remove** drops the grant, not the owner’s copy.
- **My sets:** name, description, order items, add/remove (own templates and platform templates), share by email, delete, Apply (desk picker).
- Empty states: no templates yet; point at Automations **Save as template**.

### `/admin/templates` (admins only)

Admin nav next to Members / Logs. Members who are not admins get the usual admin gate.

Two groups on the page (filters, not hidden from each other):

1. **Platform** — templates and sets the product ships. Create, rename, description, delete, edit set membership (platform templates only). Publish is the usual path in; admins can also **Save as platform template** from a desk they own.
2. **User** — every member’s templates and sets. Columns: name, desk type, owner email, updated. View recipe preview (no secrets in JSON). Rename, description, delete (confirm: owner loses it). Share by email. **Publish copy to platform** (new platform row; user row unchanged). Cannot apply a user template onto **that member’s** desks from here (no impersonation). An admin applies only to **their own** desks, from Automations or `/account/templates`.
3. **Shared Templates / Shared Sets** — inbound grants to the signed-in admin, same as the account library.

Admin does **not** rewrite a user’s `recipe` JSON in place. Support path: publish copy → edit the platform snapshot, or delete the user row if it is junk. Prevents a silent change to what the member thinks they saved.

Creating a platform set: pick platform templates of one desk type, order them.

## Permissions (never in the browser)

| Action | Member | Admin |
| --- | --- | --- |
| Save recipe as my template | Yes | Yes |
| Save / edit / delete platform template or set | No | Yes |
| Publish copy of a user template to platform | No | Yes |
| Rename / describe / delete another member’s user template or set | No | Yes (`/admin/templates` only) |
| See another member’s user templates on `/account/templates` | No, unless shared | No, unless shared (admin still sees them on `/admin/templates`) |
| Share a user template/set by email | Own rows | Own rows, or any user row from `/admin/templates` |
| Apply my, platform, or shared-with-me template/set to **my** desk | Yes | Yes |
| Apply to someone else’s desk | No | No |
| List all user + platform rows | No | Yes (service role, admin page) |

## Recipe JSON (per type, version 1)

Each type has a documented allow-list of keys matching today’s parse functions. Apply maps JSON → `FormData` or the existing `parseDcaPlaybookForm` / Perps / paper parsers, then the same insert as Save. Force Perps/C&C `mode` to disabled after parse.

- **dca:** fields from `parseDcaPlaybookForm` (not leg runtime). `startKind`, symbol, direction, clip, averaging, TP/SL, indicator, not `webhookId`.
- **perps:** fields from the automation form (symbol, action, trigger, size). Not `webhookId`, not `conditionTrue`, not source `mode`.
- **cash_and_carry:** fields from a paper layer (name, pair filters, sizes, exits). Not `enabled` on `paper_engine_settings`, not source `mode`.

Bump `recipe_version` when a breaking key is renamed. Old templates: parser fills defaults; if required fields missing, apply returns a readable error (“This template is from an older app version. Re-save it from a playbook.”).

## Micro-steps

| # | Step | Status |
| --- | --- | --- |
| 1 | Spec + migrations | Done |
| 2 | Snapshot / apply DCA | Done |
| 3 | Perps rules | Done |
| 4 | Cash and Carry | Done |
| 5 | Template sets | Done |
| 6 | `/account/templates` | Done |
| 8 | Export / import JSON library | Done |
| 9 | Member-to-member share by email | Done |

Stop after acceptance. Do not start scale-in, Hyperliquid, or backup klines in the same pass unless Click says so.

## Out of scope

- Multi-contract live playbooks
- Templates for Order/Signal **webhook tokens** or TV Strategy desks
- Auto-arm / auto-enable on apply
- Overwrite in place of a running playbook
- Admin impersonation apply onto another member’s desk
- In-place edit of another member’s `recipe` JSON
- Marketplace
- Fly.io, private APIs from the browser
- Phase 12 scale-in
