# Onboarding wizard

**V1 item 6** ([roadmap.md](roadmap.md)). Click asked to build this on 9 Oct 2026, ahead of the locked order. Item 4 (account blotter) and item 5 (entitlements) are not closed by this work. Identity, 2FA, and UI refinement are accepted. This file is the design that implementation follows. Plan gates are still item 5: the wizard calls the same create and apply actions, and the blocked-cell check stays empty until those gates exist.

The first-desk `/welcome` wizard was **removed** on 16 Sep 2026. `/welcome` stays a redirect to the signed-in home. First-run setup is a modal on the signed-in app, not that route.

## Shipped today

New members start with zero desks. After they confirm email they land on Overview (`/account`). Until this wizard, they created a desk from Manage desks when they wanted. After the first desk exists, at least one must remain. The modal below is what a new member sees instead of an open Overview.

Platform templates and folders can be flagged **Include in Starter Pack** on `/admin/templates`. That flag does **not** copy or apply anything yet. Stored JSON is still a `recipe`. See [templates.md](templates.md).

Create desk (`/account/desks/new`, Manage desks) already picks one type, a name, and Paper Trading or Connected Exchange. Connected can bind an existing trade-only key or bind later. Type and mode never change. Paper uses public marks and the in-app ledger. One live desk binds one key. Two desks cannot share a key or the same venue account.

## Purpose

First-run setup for a verified platform member who has not finished or skipped it. The signed-in app stays closed until they do. It asks four things, then writes the initial account:

1. Which desks to create, as a type × mode table.
2. Exchange keys, only if any chosen desk is Connected.
3. Which starter bots to load, only from platform folders an admin has flagged.
4. Whether they want a short guided tour.

There is no Skip setup. The member goes through Desks, Bots, and Tour. Each step can do nothing: no desks, no bots, or Not now on the tour. Creating a desk from Manage desks is not available while the modal is open.

## Locked decisions

| # | Choice | Decision |
| --- | --- | --- |
| 1 | Entry | A modal over the signed-in app. Header, sidenav, and page links do not work until the tour step is finished. Other app routes redirect to Overview, where the modal stays open. Affiliate-only logins never see it. `/account/setup` redirects to Overview. |
| 2 | Who | Verified platform member whose setup is not skipped or completed. A member with desks and no setup row is left alone. Creating a desk outside the wizard marks setup skipped. A Finish retry that already created desks keeps the modal until setup is completed or skipped. |
| 3 | Desk grid | One row per desk type. Columns are **Paper** and **Connected**. A tick is one desk. Both columns may be ticked (two desks). No quantity field. More desks come later from Manage desks. |
| 4 | Demo vs Live | Not a third column. Connected is `mode = live`. Demo vs Live is the key’s venue environment, chosen on the exchange step. Display mode stays Paper / Demo / Live as today. |
| 5 | When rows are written | Desk names and ticks stay a draft until **Finish**. API secrets are never stored in that draft. A key the member saves on the exchange step is written immediately through the existing connection action (verify, trade-only, encrypt). The draft keeps the connection id only. |
| 6 | Keys | Same rules as Exchanges and create desk. Trade-only, no withdrawal permission. Server verifies. Browser never sees the secret again. One connection binds one desk. **Bind later** is allowed per connected desk. |
| 7 | Starter bots | Admin chooses **platform folders** with the existing **Include in Starter Pack** flag. The wizard lists only templates inside those folders. A template’s own flag does not put it in the wizard. Apply uses today’s apply path: DCA **idle**, Perps bots and Cash and Carry **disabled**. Never arm, never enable the engine, never place orders. |
| 8 | Library copy | Apply onto the new desks only. Do not also copy those rows into the member’s template library. |
| 9 | Tour | Asked after the other steps, including when they created nothing. Yes starts the tour after Finish. Not now still leaves **Take the tour** on Overview. The tour only explains. It never presses Arm, Enable, or an order button. |
| 10 | New desk later | Manage desks create stays the current form. When starter folders exist for that type, the form offers **Add starter bots** (same idle / disabled apply). Not a second full wizard. |

## Steps

The steps sit in a modal. Tokens from [ui-theme.md](ui-theme.md). Backdrop and Escape do not close it. The step list always shows **1. Desks**, **2. Bots**, and **3. Tour**. There is no second row of sub-step labels. Each of Desks and Bots starts with a choice. Exchanges follows the manual desk table, and only when a Connected cell is ticked, while the step list stays on Desks. Each desk that has starter folders is a sub-step of Bots when they choose to pick bots themselves. **Back** returns to the previous sub-step and can change the choice until they continue to the tour. Desks and bots are written then, before the tour question, so the tour can show those desks and bots. There is no Skip setup. Doing nothing is a choice on each step.

### 1. Desks

The first sub-step asks how to add desks:

1. Create a Paper Trading desk for each strategy type. Quickest way to see every desk type. Skips the table and the exchange sub-step.
2. Manually select desk types and modes. Opens the table below. Connected desks then get the exchange sub-step.
3. Don't add any desks. Skips the table. Bots then says bots need a desk, with Back or continue to the tour.

Choosing again with Back replaces the draft selection. Nothing is inserted until they continue to the tour.

Question on the table, when they choose to select manually: “Create a few desks now?”

Table, one row per type that exists today, in the same order as the account sidebar (automated desks, then the manual Perps desk):

| Desk | Paper | Connected |
| --- | --- | --- |
| Perps bots | tick | tick |
| DCA | tick | tick |
| Cash and Carry | tick | tick |
| TradingView Strategy | tick | tick |
| Perps | tick | tick |

Short line under the type uses the existing choice copy (ticket vs bots vs alerts vs app-owned orders vs spot + dated future).

- Unticked means that type+mode is not created.
- Zero ticks is valid on the manual table. Continue goes to Bots, which says bots need a desk, then the tour. Exchanges stays hidden.
- Each ticked cell shows an editable name, default `{Type} Paper` or `{Type} Connected`, max 40 characters, unique on the login (and unique inside the draft). Same validator as Manage desks.
- Paper on a type with more than one market (not Cash and Carry) shows **Market data** (Bybit or Hyperliquid). Default Bybit. Cash and Carry paper stays Bybit.
- Connected Cash and Carry is Bybit only. Other connected types pick the venue on the next step.
- Perps is the ticket desk. TradingView Strategy has no bot recipes. The table does not promise bots for those rows.
- Copy desks are not offered here.

When V1 item 5 gates exist, a cell the plan cannot create is visible and disabled, with the same Upgrade (or verify / 2FA) line as Manage desks. Cap copy matches create desk (“You have 2 of 2 desks”). The server still rejects. Do not hide a type.

### Exchanges (sub-step of Desks)

Sub-step of Desks. Shown only when at least one Connected cell is ticked. The main step list stays on **1. Desks** while this sub-step is open.

One block per connected desk, in table order. Each block:

- Desk name and type (read-only).
- Venue, limited to venues that allow that desk type and connections. Cash and Carry: Bybit. Others: Bybit and Hyperliquid.
- Environment: that venue’s Live or Demo / Testnet. This is what makes the desk display as Live or Demo.
- Then one of: **Select an existing connection**, **Add a trade-only key**, or **Bind later**.

Existing connections are the member’s active keys for that venue and environment that are not already bound and not already chosen for another desk in this draft. The picker hides a key that fails `applyDeskBindRules`, same as create desk.

Add a key uses the current Exchanges form and `saveExchangeConnection`: check, reject withdrawal permission, encrypt, store on the login. The secret is not written into the setup draft. A failed verify stays on this step; the desk is not created yet. After a successful save, that connection is selected for this desk.

Plain line on the step: two connected desks need two keys. One key cannot feed two desks.

**Bind later** creates the desk as Connected with no key. Desk Settings can bind afterwards. The tour mentions that when it applies.

Paper rows do not appear here.

### 2. Bots

Always step 2. It starts with the same kind of choice as desks:

1. Load starter bots onto each desk.
2. Manually select starter bots. One sub-step per new desk that has a matching starter folder.
3. Don't add any bots.

If they chose no desks, this step does not offer those three. It says bots need a desk, with Back or continue to the tour.

If they chose only Perps and/or TradingView Strategy, or an automated type with no flagged folder, the choice still appears and says there is nothing to load. Do not show an empty required picker. The done summary still says ticket and alert desks have no starter bots. Bot rows are applied when they continue to the tour, after the desks exist.

Source:

- Platform folders (`automation_template_sets`, `visibility = platform`, `starter_pack = true`) whose `desk_type` matches a desk this run will create.
- Templates are the folder’s items, platform only, in folder order.
- User folders, shared folders, loose platform templates, and backtested rows are not listed, even if a template’s own `starter_pack` flag is on.

Admin already sets the folder flag on `/admin/templates` (**Add New Folder** / **Edit**, **Include in Starter Pack**). No new admin screen. Put the templates in a folder, then flag the folder. That is the onboarding catalog. The template-level flag stays on the admin form for the existing column; the wizard ignores it.

Picker:

- Group by the new desk (name, type, Paper or Connected).
- Under each desk, list matching flagged folders. Ticking a folder selects its templates. The member can untick a template inside the folder.
- A folder for the wrong desk type is not shown on that desk.
- DCA uses each template’s saved contract. If two selected templates share a contract on the same desk, the second is skipped at apply and named in the summary. Do not ask them to remap contracts in this wizard.
- Perps bots and Cash and Carry stack as they do today. Name collisions get the existing ` (from template)` suffix.
- Empty selection on this step is valid (“don’t load bots”).

Apply runs when they continue to the tour, after the desks exist, through the same server apply used by Automations. Results are applied / skipped / failed per template. Successes stay. No rollback of siblings. No orders.

### 3. Tour

Continuing to this step writes the desks and bots first. The modal stays up. Question: “Want a short tour of the platform?”

- **Yes** — Setup is marked completed and the tour starts on Overview. The tour includes the new desks and, when a starter bot was loaded, that desk’s Bots page.
- **Not now** — Setup is marked completed and lands on Overview, with the setup summary and **Take the tour**. The last desk created becomes the active desk.

Back is not offered after the desks are written. There is no Skip setup. A retry does not create a second copy.

Partial failure: desks and binds already committed stay. The setup row records created desk ids and which template applies succeeded, so a retry does not create a second copy. Keys already saved stay on the login. The member sees which step failed in the same words the underlying action already returns.

Done summary (Overview card that dismisses, or the first tour step): desks created, which connected desks are bound vs bind-later, bots loaded and that they are idle or disabled, and that nothing is trading.

## Guided tour

A small overlay in the app. No tour library. Steps are a fixed list in code, not an admin CMS. Each step spotlights one existing region (`data-tour` on that control). The card is a `surface` panel with a `plan-header` bar that reads **Tour · n of total**. The heading is the instruction. The place name stays on the spotlighted control. The primary button is **Next**. The last step is **Done**. **Back** and **Skip tour** stay text buttons. An arrow runs from the card to the control. The same dim layer covers the header, sidebar, and page on every step. That control stays undimmed, inside a purple ring. On Bots, Webhooks, Positions, and Desk Settings, that desk's sidebar row stays undimmed too. The arrow still points only at the step's control. A step never spotlights a whole page. Overview, Manage Desks, and Bot Templates spotlight the account sidenav item, and the Account group opens if it was collapsed. Skip marks the tour skipped. The last step marks it completed.

Progress is stored per member (step index plus not started / in progress / completed / skipped / declined). Refresh resumes the current step. Completing or skipping never shows the offer modal again. **Take the tour** on Overview starts or resumes until the tour is completed or skipped from the overlay. **Platform Tour** stays at the bottom of the account sidenav for every platform member and starts the tour again from the first step, including after it was completed or skipped.

Steps that do not apply are omitted (no desk yet, no bot desk, no TradingView desk).

| # | Focus | When | What to say |
| --- | --- | --- | --- |
| 1 | Overview in the account menu | Always | This is your home. |
| 2 | Manage Desks | Always | Desks are created here. Type and mode stay as they were set. |
| 3 | Exchanges (Manage desks, Exchanges tab) | Always | Keys are trade-only. One key binds one desk. Demo and Live are the key’s environment. |
| 4 | Desk list in the sidenav | They have a desk | Open a desk from this list. Paper, Demo, and Live are marked here. |
| 5 | Bots on that desk | A new or existing DCA, Perps bots, or Cash and Carry desk | Bots loaded in setup are idle or disabled. Arm or Enable is a separate action. The app places orders only after that. |
| 6 | Webhooks | A TradingView Strategy desk, and step 5 did not run | Alerts arrive here. Setup does not turn them on. |
| 7 | Positions | They have a desk | Open positions for this desk. |
| 8 | Desk Settings | They have a desk | Bind a key and set desk limits. Do this if the desk is still unbound. |
| 9 | Bot Templates | Always | This is your library. Starter bots in setup came only from platform folders an admin marked Include in Starter Pack. |

The tour walks to the route that owns the target, then spotlights it. It does not open a bot form, bind a key, or change a mode. Narrow widths: if the target is off-screen or inside a collapsed group, show the same copy in a card and point at the control by name.

Copy, Backtesting, Billing, and Admin are not tour stops. Those stay header or admin destinations.

## Later desks

Manage desks → create one desk stays the current form (type, name, mode, market data or key).

If the member’s plan allows templates and a flagged starter folder exists for that type, add one optional control: **Add starter bots**. Default off. On opens the same folder/template ticks as step 3, for this desk only, and applies idle or disabled after the desk is created. Perps and TradingView Strategy do not show it.

## Data

Migration when this item starts. Service role writes. The browser never selects another member’s row.

`member_onboarding`

- `user_id` uuid primary key, references the member
- `status` `pending` \| `skipped` \| `completed`
- `draft` jsonb null — ticked desks, names, paper venue, connection ids, bind-later flags, selected template ids per desk. No secrets.
- `created_account_ids` uuid[] — desks this run already inserted, for retry
- `applied_template_keys` text[] — desk id + template id already applied, for retry
- `tour` `declined` \| `in_progress` \| `completed` \| `skipped` null
- `tour_step` integer not null default 0
- `updated_at`

No new template tables. Folder flag stays `automation_template_sets.starter_pack`.

Add a row to [database.md](database.md) in the same change as the migration.

## Safety

- Reuse `createTradingAccount`, `saveExchangeConnection`, and template apply. Do not add a second create path with weaker checks.
- Assert the signed-in member owns every desk and connection id in the draft.
- Starter query is platform folders with `starter_pack` only. Reject a template id that is not an item of such a folder.
- Never trust the browser for plan, 2FA, bind, or “this bot may arm”.
- Never call private exchange APIs from the browser. Verify stays on the server.
- Do not create a Demo Account automatically.
- Do not edit ledgers. Setup only inserts desks, connections, and idle or disabled bots.
- Idempotent Finish: a second submit returns the desks already stored on the onboarding row.

## Entitlements

Item 5 is expected to be in place first. This item consumes it. It does not add plan features or caps.

Each ticked cell and each Finish create goes through the same entitlement check as Manage desks (desk type, paper, live, non-Bybit venue, desk caps). Bot apply respects the bot cap. A disabled cell stays on screen with Upgrade. Server actions reject. If item 5 has not shipped when this starts, still call the create and apply actions so the gates attach in one place later.

## UI

- The modal uses `bg-surface` `border-line` and the account width (`max-w-7xl`). Desks, Bots, and Tour span that width: a numbered mark, the label, and a line between steps. The current step uses the accent fill. Sub-steps share the row under it. The step content scrolls inside the dialog. Back and Continue stay visible at the bottom. Cards inside the steps use the same surface.
- Desk and bot choices are full-width sections. The selected section uses the accent border. The desk table still uses checkboxes and the Theme table pattern. No new colours. Paper / Demo / Live dots may use the existing `mode-paper`, `mode-demo`, and `mode-live` tokens.
- The modal is the only setup entry. It closes when the tour step is finished. **Take the tour** on Overview remains until the tour is completed or skipped. **Platform Tour** in the account sidenav stays available.
- The tour card uses `bg-surface` with a `bg-plan-header` bar. The bar reads Tour and the step count. The heading is the instruction. The primary button is **Next**. No new colours.
- Light and dark follow header UI preferences. Do not put light tokens on `html` / `body`.

## Micro-steps

Stop after each until Click says go. Do not start inside item 4 or item 5.

| # | Step | Done when |
| --- | --- | --- |
| 1 | State | Migration + database.md. Pending / skipped / completed. Skip with zero desks. A desk created outside the wizard marks skipped. |
| 2 | Desk draft | Table, names, paper market data, disabled cells when gates say so. Nothing written until Finish except the draft json. |
| 3 | Exchanges | Connected desks only. Existing key, new trade-only key, or bind later. One key cannot be chosen twice. Secrets not in the draft. |
| 4 | Finish desks | Finish creates and binds. Retry does not duplicate. Summary lists bound vs bind later. |
| 5 | Starter bots | Flagged folders only. Apply idle / disabled. TV and Perps ticket skip the step. Failures listed, siblings kept. |
| 6 | Tour | Offer, overlay, persistence, Take the tour, conditional steps. |
| 7 | New desk | Optional **Add starter bots** on the existing create form. |

## Tests

- Skip leaves zero desks and does not show the modal again.
- Ticking DCA Paper and Perps bots Connected creates those two modes and no others. Names that collide are rejected before Finish.
- Connected with bind later inserts `mode = live` and no connection.
- Two connected rows cannot select the same connection id.
- A key with withdrawal permission never saves.
- The bot list contains only templates from flagged platform folders. A template with its own flag and no flagged folder is absent.
- Apply leaves DCA idle and Perps / Cash and Carry disabled. No order rows.
- TradingView Strategy and Perps still show step 2, with nothing to load.
- Finish retry does not insert a second desk or a second bot.
- Tour decline does not start the overlay. Skip tour persists. A missing desk omits the desk steps.
- A gated cell does not create that desk when the server rejects.

## Out of scope

- Putting `/welcome` back as a block on the product
- Auto Demo Account
- Auto-arm, auto-enable, marketplace, or copying starter rows into the member library
- Admin-edited tour scripts, videos, or a help center (V1 item 10)
- Account-wide Positions / Bots (item 4, still waiting on Click)
- Building plan gates (item 5). This wizard only calls them
- Copy desks, scale-in, MEXC, paper auto-switch
- Changing type or mode after create
- Private exchange calls from the browser
- A public member template catalog (V2)
