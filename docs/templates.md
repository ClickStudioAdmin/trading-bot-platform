# Automation templates and folders

Shipped. **Not Phase 12** (scale-in). Not backup market data.

Phase 11 is complete. See [phase-11.md](phase-11.md). This is a **login-scoped template library** that stamps idle bots onto a desk of the matching type. Migrations: `supabase/migrations/20260828100000_automation_templates.sql`, `supabase/migrations/20260828110000_automation_template_shares.sql` (apply on push to `develop`). Stored JSON is still called a `recipe` in code.

## Purpose

Users save a bot as a **template**, or several templates as a **folder** (stored as a template set). They create a new idle or disabled bot from one template, or stamp a whole folder onto a desk. Admins get extra controls to publish **platform** templates and folders, and an admin library that lists **every** template and folder (user and platform). Every member can apply their own templates and platform templates. Desk types that already have automations: **DCA**, **Perps**, **Cash and Carry**. TradingView Strategy desks have no bot form — out of scope.

Clone on Automations stays. Clone is an in-desk duplicate of one live row. Templates are a library, reusable across desks of the same type.

## Why not many pairs on one bot

A live DCA bot still owns one contract (`unique (account_id, symbol)`). Templates do not change that. A folder is the way to “install ETH + SOL + BTC with the same idea”: one template per pair (or one template applied three times with three contracts), each becoming its own bot. Runtime, GTC ladders, TP/SL, and Close bot stay per contract.

## Current facts this plan sits on

- Four desk types: `cash_and_carry`, `perps`, `signal_follower`, `dca`. Type is immutable.
- Automations today: C&C `paper_rules`; Perps `futures_automation_rules`; DCA `dca_playbooks`; TV Strategy is webhook-only.
- Live bot fields are **typed columns**, not JSON, on the live tables. The template library stores a `recipe` JSON snapshot. Clone today is a **client draft** (`dcaCloneIdleDraft`, `cloneFuturesAutomationForm`, `clonePaperLayerForm`) until Save.
- Writes go through server actions and the service role. Never trust the browser for permissions.
- Admin is `members.role = admin` or listed email (`click.studio.admin@gmail.com`). Extra UI is admin-only; apply to a desk is not admin-only.

## Locked decisions

| # | Choice | Decision |
| --- | --- | --- |
| 1 | Perps / C&C mode after apply | Always **`disabled`**. Source mode is not copied. A folder cannot surprise-trade. The user enables the bot on the desk. DCA apply stays **idle** (not armed). |
| 2 | Member library | **`/account/templates`**. Login-scoped. View and manage **own** templates and folders. Platform rows stay off this list; members apply them from Automations. Account nav gains Templates. |
| 3 | Publish to platform | **Copy**, do not promote. The user row stays. Platform is a snapshot with its own id. The member can keep iterating; admins can edit the platform copy without rewriting the user’s library. If the platform name is taken, the confirm dialog asks for another name. |
| 4 | Folder apply | **Skip failures, keep successes.** Not all-or-nothing. The wizard can remap a DCA symbol (or skip) **before** write. After write, a result list shows applied / skipped / failed. One taken contract must not roll back the rest of the folder. |
| 5 | Names | **Unique per owner + desk type**, case-insensitive. Same name is allowed for a different user, or for a different `desk_type`. Platform names are unique per `desk_type` among platform rows. Folders use the same uniqueness as templates. |
| 6 | Admin library | **`/admin/templates`**. Admins view and manage **user and platform** templates and folders. Left admin nav. Members never see this page. |

## Shape

### Template

A named snapshot of **one** idle bot for **one** `desk_type`.

Stored as versioned JSON (`recipe` + `recipe_version`) plus metadata. Live tables keep evolving with migrations; apply runs the same parsers the Save form uses (defaults for missing keys, reject unknown desk type). Do not create parallel copies of every `dca_playbooks` column.

**Snapshot includes:** name (as default for the new row), contract/symbol if present, sizing, start, averaging, exits, Perps action/trigger, C&C bot filters — the fields a user would type on Automations.

**Snapshot never includes:** API keys, webhook tokens, `webhook_id` (desk-specific door), runtime (`condition_true`, `clips_filled`, `long_*` / `short_*` status, `last_fired_at`, arm/disarm latches), position or working-order ids, reduce-only / desk caps.

After apply:

- DCA: new bot **idle** (not armed).
- Perps and Cash and Carry: new bot **`disabled`**. Never copy `mode` / `enabled` from the source.
- Signal webhook unbound (`webhook_id` null). Copy: “Bind a Signal on this desk after apply.”
- User must Save / Arm / Enable as today. Never place orders on apply.

### Folder (template set)

The library UI calls these **folders**. Tables and code still use `automation_template_sets`.

An ordered list of templates. All members of a folder share one `desk_type`.

- A **user folder** may include the owner’s templates and/or platform templates.
- A **platform folder** may only include platform templates.

Applying a folder walks the list and applies each template to a **chosen desk** of that type. Collisions (DCA same symbol already on the desk) are handled in the apply wizard, not by merging into one bot. C&C stacked layers on the same pair stay allowed, same as today.

### Visibility

| Kind | Who writes | Who reads / applies |
| --- | --- | --- |
| User template / folder | Owning member; admins may rename, describe, or delete from `/admin/templates` | Owner applies to **their** desks. Other members cannot see it unless it is **shared** with them. Admins see every user row on the admin page. |
| Platform template / folder | Admin only | Every member can read and apply. Members cannot edit or delete. |
| Shared template / folder | Owner (or admin) grants access by recipient email; stored as `to_user_id` | Recipient can apply to **their** desks. Read-only on Shared tabs. Cannot edit, delete, or re-share. |

Share is a grant, not a copy. The owner keeps the template. Deleting the template or folder drops the shares. Platform templates are already public — do not share them.

## Export and import

`/account/templates` and `/admin/templates` both have **Export all** and **Import all**.

- Account export is the current member’s **user** templates and folders (not platform, not inbound shares).
- Admin export is every template and folder in the database.
- Import always creates **new user-owned copies** for the signed-in member. Name collisions get a ` (import)` suffix. Folders remap to the newly inserted templates. Invalid templates are skipped.

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
- `ON DELETE CASCADE` from template: deleting a template drops it from folders that listed it
- Trigger: template `desk_type` must match set `desk_type`; platform folder ⇒ platform template only

`automation_template_shares` / `automation_template_set_shares`

- `template_id` or `set_id`, `from_user_id`, `to_user_id`, `created_at`
- Unique `(template_id, to_user_id)` / `(set_id, to_user_id)`
- Cannot share with yourself. Cannot share platform rows.
- Service-role writes. Authenticated select if you are `from` or `to`.

**RLS (member client):** authenticated select own user rows **or** `visibility = platform`. Insert/update/delete own user rows only. Platform writes and admin reads of **other members’** user rows are **service role only** (server actions). Do not add an RLS policy that lets an admin JWT `select *` every template from the browser.

Save-as-template with a name the owner already uses for that desk type: dialog asks to rename. Do not overwrite in place unless the user confirms **Replace existing template**.

## Apply rules

1. Chosen desk `desk_type` must equal the template (or folder) `desk_type`. Wrong type is a hard error.
2. DCA: insert a new bot. If `(account_id, symbol)` is taken, the wizard asks for another contract or skip. Do not overwrite a live bot.
3. Perps / C&C: insert a new stacked rule, **`disabled`**. Name collision on the desk: suffix ` (from template)` or ask.
4. Rebind Signal webhook: leave `webhook_id` null.
5. Never arm, never enable the C&C engine, never place orders.
6. Paper vs Live: a template is a venue-agnostic snapshot. Apply to whichever mode the desk already has. Size vs ticket-size is the same Save guard as today.
7. Folder apply: remap/skip in the wizard first. Then write item by item. Successes stay. Failures (parse error, unique symbol after remap, missing template) are listed. No rollback of siblings.

Apply is on Automations only and uses the current `?desk=`. The library pages do not apply.

## UI

Tokens from [ui-theme.md](ui-theme.md).

### Automations (desk)

- Header: **Create New Bot**, **Add from Template**. One picker is a single folder tree: **Platform**, **Shared**, and **My templates** as top-level folders. Named folders and loose templates nest under that scope. Tick a folder or individual templates, then apply to **this** desk.
- Save Bots, Arm, Close bot, and Reduce only stay on the page. They do not reload or jump the scroll.
- Each bot card: **Save as template**. Name, description, **Add to folder** as a checkbox list of **your** folders (this desk type). **Save as platform template** lists **platform folders** only. Tick one or more, and/or **Create a new folder**.
- **Add from Template** on DCA: each selected template has a required empty **Select Contract** field. Apply stays disabled until every selected template has a contract. The template’s saved contract is not used.
- TradingView Strategy desk: no Add from Template. Webhook tokens are not templates.

### `/account/templates` (every member)

Login library. Not desk-scoped. Account nav: Templates, with Settings, Exchanges, Manage desks.

- Tabs: **My Templates**, **My Folders**, **Shared Templates**, **Shared Folders**. Table with columns, search, desk-type filter, folder filter, click-to-sort, and row checkboxes. Bulk: **Add to folder** (templates), **Publish** / **Unpublish** (admin), **Delete**. **Edit** folder uses **In Folder** / **Not in Folder** columns; Save writes membership. Apply is on Automations.
- **Export all** / **Import all** JSON library file.
- **Folders tab:** same table. Create a folder at the bottom with a name and desk type. Templates are optional; add them now or later.
- **Platform rows** do not appear on My Templates / My Folders. Members apply them from Automations. **Shared** tabs: **Remove** drops the grant, not the owner’s copy.
- Empty states: no templates yet; point at Automations **Save as template**. No folders yet; create on the Folders tab (templates optional).

### `/admin/templates` (admins only)

Admin nav next to Members / Logs. Members who are not admins get the usual admin gate.

Two groups on the page (filters, not hidden from each other), shown as **tables** (search, sort, desk type, platform/user, bulk checkboxes):

1. **Platform** — templates and folders the product ships. **Edit** to rename, description, delete, edit folder membership (platform templates only) on the **Folders** tab or from a template’s Edit dialog. Publish is the usual path in; admins can also **Save as platform template** from a desk they own.
2. **User** — every member’s templates and folders. Columns: name, desk type, owner email, folder, shared with, updated. **Edit** for name, folder, sharing. Delete (confirm: owner loses it). Share by email. **Publish copy to platform** (new platform row; user row unchanged). Cannot apply a user template onto **that member’s** desks from here (no impersonation). An admin applies only to **their own** desks, from Automations.
3. **Shared Templates / Shared Folders** — inbound grants to the signed-in admin, same as the account library.

Admin does **not** rewrite a user’s `recipe` JSON in place. Support path: publish copy → edit the platform snapshot, or delete the user row if it is junk. Prevents a silent change to what the member thinks they saved.

Creating a platform folder: on the **Folders** tab, pick platform templates of one desk type, order them.

## Permissions (never in the browser)

| Action | Member | Admin |
| --- | --- | --- |
| Save bot as my template | Yes | Yes |
| Save / edit / delete platform template or folder | No | Yes |
| Publish copy of a user template to platform | No | Yes |
| Rename / describe / delete another member’s user template or folder | No | Yes (`/admin/templates` only) |
| See another member’s user templates on `/account/templates` | No, unless shared | No, unless shared (admin still sees them on `/admin/templates`) |
| Share a user template/folder by email | Own rows | Own rows, or any user row from `/admin/templates` |
| Apply my, platform, or shared-with-me template/folder to **my** desk | Yes | Yes |
| Apply to someone else’s desk | No | No |
| List all user + platform rows | No | Yes (service role, admin page) |

## Recipe JSON (per type, version 1)

Each type has a documented allow-list of keys matching today’s parse functions. Apply maps JSON → `FormData` or the existing `parseDcaPlaybookForm` / Perps / paper parsers, then the same insert as Save. Force Perps/C&C `mode` to disabled after parse.

- **dca:** fields from `parseDcaPlaybookForm` (not leg runtime). `startKind`, symbol, direction, clip, averaging, TP/SL, indicator, not `webhookId`.
- **perps:** fields from the automation form (symbol, action, trigger, size). Not `webhookId`, not `conditionTrue`, not source `mode`.
- **cash_and_carry:** fields from a paper layer (name, pair filters, sizes, exits). Not `enabled` on `paper_engine_settings`, not source `mode`.

Bump `recipe_version` when a breaking key is renamed. Old templates: parser fills defaults; if required fields missing, apply returns a readable error (“This template is from an older app version. Re-save it from a bot.”).

## Micro-steps

| # | Step | Status |
| --- | --- | --- |
| 1 | Spec + migrations | Done |
| 2 | Snapshot / apply DCA | Done |
| 3 | Perps rules | Done |
| 4 | Cash and Carry | Done |
| 5 | Folders (template sets) | Done |
| 6 | `/account/templates` | Done |
| 8 | Export / import JSON library | Done |
| 9 | Member-to-member share by email | Done |

Stop after acceptance. Do not start scale-in, Hyperliquid, or backup klines in the same pass unless Click says so.

## Out of scope

- Multi-contract live bots
- Templates for Order/Signal **webhook tokens** or TV Strategy desks
- Auto-arm / auto-enable on apply
- Overwrite in place of a running bot
- Admin impersonation apply onto another member’s desk
- In-place edit of another member’s `recipe` JSON
- Marketplace
- Fly.io, private APIs from the browser
- Phase 12 scale-in
