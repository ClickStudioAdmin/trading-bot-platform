# Onboarding wizard

**V1 item 5** ([roadmap.md](roadmap.md)). Click asked to build this on 9 Oct 2026. On 12 Oct 2026 Click moved it to item 5, ahead of entitlements. Item 4 (account blotter) is not closed by this work. Identity, 2FA, and UI refinement are accepted. This file is the design that implementation follows. Plan gates are item 6: the wizard calls the same create and apply actions, and the blocked-cell check stays empty until those gates exist.

The first-desk `/welcome` wizard was **removed** on 16 Sep 2026. `/welcome` stays a redirect to the signed-in home. First-run setup is a modal on the signed-in app, not that route.

## Shipped today

New members start with zero desks. After they confirm email they land on Overview (`/account`). Until this wizard, they created a desk from Manage desks when they wanted. After the first desk exists, at least one must remain. The modal below is what a new member sees instead of an open Overview.

Platform templates and folders can be flagged **Include in Starter Pack** on `/admin/templates`. That flag does **not** copy or apply anything yet. Stored JSON is still a `recipe`. See [templates.md](templates.md).

Create desk (`/account/desks/new`, Manage desks) already picks one type, a name, and Paper Trading or Connected Exchange. Connected can bind an existing trade-only key or bind later. Type and mode never change. Paper uses public marks and the in-app ledger. One live desk binds one key. Two desks cannot share a key or the same venue account.

## Purpose

First-run setup for a verified platform member who has not finished or skipped it. The signed-in app stays closed until they do. It asks four things, then writes the initial account:

1. Which desks to add. **Add Desk** opens the details, including the desk type.
2. Exchange keys, only if any chosen desk is Connected.
3. Which starter bots to load, only from platform folders an admin has flagged.
4. Whether they want a short guided tour.

There is no Skip setup. The member goes through Add Desks, Add Bots, Review, and Take a Tour. Each step can do nothing: no desks, no bots, or Not now on the tour. Creating a desk from Manage desks is not available while the modal is open.

## Locked decisions

| # | Choice | Decision |
| --- | --- | --- |
| 1 | Entry | A modal over the signed-in app. Header, sidenav, and page links do not work until the tour step is finished. Other app routes redirect to Overview, where the modal stays open. Affiliate-only logins never see it. `/account/setup` redirects to Overview. |
| 2 | Who | Verified platform member whose setup is not skipped or completed. A member with desks and no setup row is left alone. Creating a desk outside the wizard marks setup skipped. A Finish retry that already created desks keeps the modal until setup is completed or skipped. |
| 3 | Desk list | One table for every desk. **Add Desk** sits at the top and opens a sub-modal. The member picks the desk type there, then the name, mode, market or exchange, environment, and key. Several desks of one type are allowed, including more than one Paper desk and more than one Connected desk. No quantity field. Columns are type, name, mode, environment, market, and key. The plan desk cap is the limit once item 6 gates exist. |
| 4 | Demo vs Live | Not a third column. Connected is `mode = live`. Demo vs Live is the key’s venue environment, chosen on the exchange step. Display mode stays Paper / Demo / Live as today. |
| 5 | When rows are written | Desk names and details stay a draft until **Create** on Review. API secrets are never stored in that draft. A key the member saves in the create modal, or on the exchange step, is written immediately through the existing connection action (verify, trade-only, encrypt). The draft keeps the connection id only. |
| 6 | Keys | Same rules as Exchanges and create desk. Trade-only, no withdrawal permission. Server verifies. Browser never sees the secret again. One connection binds one desk. **Bind later** is allowed per connected desk. |
| 7 | Starter bots | Admin marks **Include in Starter Pack** on a platform folder or on a platform template. The wizard lists every template in a flagged folder, and every flagged template that is not already in one of those folders. Apply uses today’s apply path. A bot stays **Disabled** unless **Initial Status** is **Active**. Every bot uses those two words. For a DCA bot, Active runs the desk arm action, so an immediate start can place the first order. Perps bots and Cash and Carry use the desk enable action. Setup does not offer Stop adding or Reduce only. A Connected desk without a key cannot choose Active. |
| 8 | Library copy | Apply onto the new desks only. Do not also copy those rows into the member’s template library. |
| 9 | Tour | Asked on Take a Tour, after Continue on Review, including when they created nothing. Yes starts the tour. Not now lands on Overview. The tour only explains. It never presses Enable or an order button. |
| 10 | New desk later | Manage desks create stays the current form. When starter folders exist for that type, the form offers **Add starter bots** (same idle / disabled apply). Not a second full wizard. |

## Steps

The steps sit in a modal. Tokens from [ui-theme.md](ui-theme.md). Backdrop and Escape do not close it. Before the numbered steps, the modal shows a placeholder for an explainer video. The step list stays hidden there. **Watch a short overview** sits in the same grey header bar as **Set up your account** on the later steps. **Watch** starts the placeholder. There is no video file yet. **Skip**, or **Continue** after watching, opens Desks and stores that the video was passed, so a refresh during setup does not show it again. **Back** from the first Desks screen returns to the video. When desks and bots are already written, a refresh stays on Review until Continue, then on Take a Tour. The video stays hidden. The step list always shows **1. Add Desks**, **2. Add Bots**, **3. Review**, and **4. Take a Tour**. There is no second row of sub-step labels. Each of Add Desks and Add Bots starts with a choice. **Add Desk** opens a sub-modal on the manual list. Exchanges stays on Add Desks and opens only when a Connected desk still needs a key. When they choose to pick bots themselves, every desk with starter folders or flagged templates is listed on the same Add Bots page. **Back** returns to the previous sub-step and can change the choice until they click **Create**. Review lists every desk and the bots that will be loaded on it. Desks and bots are written on Create, and Review stays up with that result. Continue opens Take a Tour, which only asks whether to take the tour. There is no Skip setup. Doing nothing is a choice on each step. **Reset Wizard** sits on the left of the footer on every step before the desks are written. It stays hidden after Create, on the Review result and on Take a Tour. Back, Continue, and Create sit on the right. It is the grey secondary button. A confirm explains that choices are cleared and that desks, bots, and keys created in this setup are removed. The wizard then opens again on the explainer video. Desks that were not created by this setup stay.

### 1. Add Desks

The first sub-step asks how to add desks:

1. Add a Paper Trading desk for each strategy type. Quickest way to see every desk type. Skips the list and the exchange sub-step.
2. Manually select desk types and modes. Opens one table. **Add Desk** at the top opens the sub-modal, where the member picks the type.
3. Don't add any desks. Skips the list. Bots then says bots need a desk, with Back or continue to Review.

Choosing again with Back replaces the draft selection. Nothing is inserted until they click **Create** on Review.

Question on the list, when they choose to select manually: “Add desks now?” The line “Add nothing to continue without desks.” sits under that title, above the table.

One table. **Add Desk** sits at the top. Columns are type, name, mode, environment, market, and key. An empty table says no desks yet. Types are Perps bots, DCA, Cash and Carry, TradingView Strategy, and Perps, chosen in the sub-modal.

The sub-modal asks for the details, then closes back to the table:

- Desk type, then name. The name defaults to `{Type} Paper` or `{Type} {Venue}`, max 40 characters, unique on the login (and unique inside the draft). Same validator as Manage desks. Changing the type updates the suggested name until the member edits it.
- Mode: Paper or Connected. Another desk of the same mode can be added. The suggested name stays unique.
- Paper on a type with more than one market (not Cash and Carry) shows **Market data** (Bybit or Hyperliquid). Default Bybit. Cash and Carry paper stays Bybit.
- Connected shows **Exchange** and **Environment** (Live or Demo / Testnet). Connected Cash and Carry is Bybit only. Then **Bind later** or **Add a trade-only key**. A key is checked and encrypted before the desk is added. The secret is not stored in the draft.
- **Add desk** closes the modal. That desk is a row in the one table. Paper leaves environment and key blank. The pencil **Edit** reopens the modal, including the type. The trash **Remove** drops that desk. Changing the type drops starter bots already chosen for the previous type.

- An empty list is valid. Continue goes to Bots, which says bots need a desk, then the tour. Exchanges stays hidden.
- Perps is the ticket desk. TradingView Strategy has no bot recipes.
- Copy desks are not offered here.

When V1 item 6 gates exist, a type the plan cannot create is visible and disabled, with the same Upgrade (or verify / 2FA) line as Manage desks. Cap copy matches create desk (“You have 2 of 2 desks”). The server still rejects. Do not hide a type.

### Exchanges (sub-step of Desks)

Sub-step of Desks. Shown only when a Connected desk was added without a saved key and without **Bind later**. The main step list stays on **1. Add Desks** while this sub-step is open. The create modal is the usual place for the exchange, the environment, and the key.

One block per connected desk, in list order. Each block:

- Desk name and type (read-only).
- Venue, limited to venues that allow that desk type and connections. Cash and Carry: Bybit. Others: Bybit and Hyperliquid.
- Environment: that venue’s Live or Demo / Testnet. This is what makes the desk display as Live or Demo.
- Then one of: **Add a trade-only key**, or **Bind later**. There is no existing-connection picker. First-run setup has no keys yet, and a key saved here belongs to that desk.

Add a key uses the current Exchanges form and `saveExchangeConnection`: check, reject withdrawal permission, encrypt, store on the login. The secret is not written into the setup draft. A failed verify stays on this step; the desk is not created yet. After a successful save, that connection is selected for this desk.

Plain line on the step: two connected desks need two keys. One key cannot feed two desks.

**Bind later** creates the desk as Connected with no key. Desk Settings can bind afterwards. The tour mentions that when it applies.

Paper rows do not appear here.

### 2. Add Bots

Always step 2. It starts with the same kind of choice as desks:

1. Load starter bots onto each desk.
2. Manually select starter bots. Every new desk that has a matching starter folder or flagged template is listed on this same page.
3. Don't add any bots.

If they chose no desks, this step does not offer those three. It says bots need a desk, with Back or continue to Review.

The Load starter bots choice has no line under the title. If they chose only Perps and/or TradingView Strategy, or an automated type with no flagged folder or template, the same three choices still appear. Choosing manual then says there is nothing to load. Do not show an empty required picker. The done summary still says ticket and alert desks have no starter bots. Bot rows are applied when they click **Create**, after the desks exist.

Source:

- Platform folders (`automation_template_sets`, `visibility = platform`, `starter_pack = true`) whose `desk_type` matches a desk this run will create.
- Templates are the folder’s items, platform only, in folder order.
- Platform templates (`automation_templates`, `visibility = platform`, `starter_pack = true`) that are not already in one of those folders. They are listed on their own, under the matching desk type.
- User folders, shared folders, and backtested rows are not listed.

Admin already sets both flags on `/admin/templates` (**Include in Starter Pack** on a folder or on a template). No new admin screen. A flagged template does not need to sit in a flagged folder.

Picker:

- One table. One row per desk, the same shape as Review. Columns are Desk, Type, Mode, Bots, and Initial Status. The bots for that desk are listed together in the Bots column, each with its own tick. There is no folder column and no folder tick. A folder for the wrong desk type is not shown.
- **Initial Status** is the last column. Each bot has its own dropdown, lined up with that bot. Every bot offers Disabled and Active. Active is the default, including when they load every starter bot at once. Disabled leaves the bot off. Active starts that bot when setup creates it. For a DCA bot, Active runs the desk arm action, so an immediate start can place the first order. A Connected desk without a saved key cannot choose Active, so those bots stay Disabled.
- DCA uses each template’s saved contract. If two selected templates share a contract on the same desk, the second is skipped at apply and named in the summary. Do not ask them to remap contracts in this wizard.
- Perps bots and Cash and Carry stack as they do today. Name collisions get the existing ` (from template)` suffix.
- Empty selection on this step is valid (“don’t load bots”).

Apply runs when they click **Create** on Review, after the desks exist, through the same server apply used by Automations. Results are applied / skipped / failed per template. Successes stay. No rollback of siblings.

### 3. Review

One page after Add Bots. Before Create, a table lists each desk and the starter bots that will be loaded on it. Columns are Desk, Type, Mode, Bots, and Initial Status. Each bot lists Disabled or Active. A desk with no starter bots shows an em dash and sits after every desk that has bots. A desk type with no desk added is listed after those, with a blank name and mode. Create does not write that type. The line “These desks and bots are created when you click Create.” shows only when that table has rows. No desks shows that nothing will be created. **Back** returns to Add Bots. **Create** writes the desks and bots and stays on Review. While that write runs, the button reads **Creating…** and shows a spinning loader in place of the plus.

After Create, Review shows the result. The heading is **Your account is ready.**, or **Setup finished with errors.** when a bot failed to load or a ticked bot did not start. The same table lists what was written, with desks that have no bots at the bottom. Each bot lists Disabled or Active. A failure that stops the write stays on Review before that result, in the footer. **Continue** does not write again. Back and Reset Wizard stay hidden.

### 4. Take a Tour

**Continue** on Review opens this step. It asks whether to take the tour. It does not repeat the result table.

**Not now** and **Start the Tour now** sit on the right of the footer. **Not now** is the text button. **Start the Tour now** is the primary button.

- **Start the Tour now** — Setup is marked completed and the wizard closes straight into the tour on Overview. It does not pass through another step or an error. The tour includes the new desks and, when a starter bot was loaded, that desk’s Bots page. A click here does not run Create again.
- **Not now** — Setup is marked completed and lands on Overview, with the setup summary. The last desk created becomes the active desk.

Back and Reset Wizard are not offered after the desks are written. There is no Skip setup. A retry does not create a second copy.

Partial failure: desks and binds already committed stay. The setup row records created desk ids and which template applies succeeded, so a retry does not create a second copy. Keys already saved stay on the login. Each failed bot is named on the wizard, with the same words the apply action returned. Review and the Overview card say setup finished with errors. They do not use the success heading while any error is present.

Done summary (Overview card that dismisses, or the first tour step): desks created, which connected desks are bound vs bind-later, bots loaded, and whether each one stayed idle or was enabled. Errors from this setup are listed above that.

## Guided tour

A small overlay in the app. No tour library. Steps are a fixed list in code, not an admin CMS. Each step spotlights one existing region (`data-tour` on that control). The card is a `surface` panel with a `plan-header` bar that reads **Tour · n of total**. The heading is the instruction. The place name stays on the spotlighted control. The primary button is **Next**. The last step is **Done**. **Back** and **Skip tour** stay text buttons. An arrow runs from the card to the control. The same dim layer covers the header, sidebar, and page on every step. That control stays undimmed, inside a purple ring. On Bots, Webhooks, Positions, and Desk Settings, that desk's sidebar row stays undimmed too. The arrow still points only at the step's control. A step never spotlights a whole page. Overview, Manage Desks, and Bot Templates spotlight the account sidenav item, and the Account group opens if it was collapsed. Skip marks the tour skipped. The last step marks it completed.

Progress is stored per member (step index plus not started / in progress / completed / skipped / declined). Refresh resumes the current step. Completing or skipping never shows the offer modal again. **Platform Tour** stays at the bottom of the account sidenav for every platform member and starts the tour again from the first step, including after it was completed or skipped.

Steps that do not apply are omitted (no desk yet, no bot desk, no TradingView desk).

| # | Focus | When | What to say |
| --- | --- | --- | --- |
| 1 | Overview in the account menu | Always | This is your home. |
| 2 | Manage Desks | Always | Desks are created here. Type and mode stay as they were set. |
| 3 | Exchanges (Manage desks, Exchanges tab) | Always | Keys are trade-only. One key binds one desk. Demo and Live are the key’s environment. |
| 4 | Desk list in the sidenav | They have a desk | Open a desk from this list. Paper, Demo, and Live are marked here. |
| 5 | Bots on that desk | A new or existing DCA, Perps bots, or Cash and Carry desk | Bots stay Disabled unless Initial Status is Active. The app places orders only after that. |
| 6 | Webhooks | A TradingView Strategy desk, and step 5 did not run | Alerts arrive here. Setup does not turn them on. |
| 7 | Positions | They have a desk | Open positions for this desk. |
| 8 | Desk Settings | They have a desk | Bind a key and set desk limits. Do this if the desk is still unbound. |
| 9 | Bot Templates | Always | This is your library. Starter bots in setup came from platform templates and folders marked Include in Starter Pack. |

The tour walks to the route that owns the target, then spotlights it. It does not open a bot form, bind a key, or change a mode. Narrow widths: if the target is off-screen or inside a collapsed group, show the same copy in a card and point at the control by name.

Copy, Backtesting, Billing, and Admin are not tour stops. Those stay header or admin destinations.

## Later desks

Manage desks → create one desk stays the current form (type, name, mode, market data or key).

If the member’s plan allows templates and a flagged starter folder exists for that type, add one optional control: **Add starter bots**. Default off. On lists those starter bots for this desk only, and applies Disabled after the desk is created. Perps and TradingView Strategy do not show it.

## Data

Migration when this item starts. Service role writes. The browser never selects another member’s row.

`member_onboarding`

- `user_id` uuid primary key, references the member
- `status` `pending` \| `skipped` \| `completed`
- `draft` jsonb null — desks added in the sub-modal, names, paper venue, connection ids, bind-later flags, selected template ids per desk. No secrets.
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
- Starter query is platform folders with `starter_pack`, plus platform templates with their own `starter_pack` that are not already in one of those folders. Reject any other template id.
- Never trust the browser for plan, 2FA, bind, or whether a bot may start.
- Never call private exchange APIs from the browser. Verify stays on the server.
- Do not create a Demo Account automatically.
- Do not edit ledgers. Setup inserts desks, connections, and bots. A bot stays Disabled unless Initial Status is Active. Perps bots and Cash and Carry use the desk enable action. DCA still runs the desk arm action, and it can place an order.
- Idempotent Finish: a second submit returns the desks already stored on the onboarding row.

## Entitlements

Item 6 comes after this wizard. This wizard does not add plan features or caps.

Each desk added from the sub-modal and each Finish create goes through the same create and apply actions as Manage desks (desk type, paper, live, non-Bybit venue, desk caps). Bot apply respects the bot cap. When item 6 gates exist, a type the plan cannot create stays on screen, disabled, with Upgrade, and server actions reject. Until those gates ship, the blocked-cell check stays empty and these actions still run so the gates attach in one place later.

## UI

- The modal uses `bg-surface` `border-line` and three quarters of the account width (`max-w-7xl` is 80rem). It is the only card. Step copy sits in the dialog, not in a second surface box. The account title bar and the footer use `bg-surface-raised`, the same grey as table headers. One line sits under the account title and the step list. One line sits above the footer buttons. The step content is padded `px-6 py-5`, the same on the top and the bottom. Add Desks, Add Bots, Review, and Take a Tour span that width: a numbered mark, the label, and a line between steps. The current step uses the accent fill. The step content scrolls inside the dialog. Choice rows keep a border so the selected row can use the accent. Each Add Desks and Add Bots choice has an icon before the title. The desk list is one table. **Add Desk** is the primary plus button at the top. Columns are type, name, mode, environment, market, and key. The sub-modal asks for the desk type. Edit and Remove are the pencil and trash icon actions. The create sub-modal uses `bg-surface` and `border-line`, with the same grey header and footer. The video screen uses that same header bar for **Watch a short overview**, without the step list. Its frame is `bg-canvas` with `border-line` and the play icon. Skip and Watch or Continue use the same footer buttons. **Reset Wizard** is the secondary button (`bg-surface`, `border-line`, `text-ink-muted`) on the left of that footer before the desks are written. It stays hidden after Create, on the Review result and on Take a Tour. Back, Continue, and Create sit on the right. After Create, Review uses Continue. On Take a Tour, **Not now** and **Start the Tour now** use that same right side. Each footer label has an icon before the word, except Continue, whose arrow sits after the word.
- Desk and bot choices are full-width sections. The selected section uses the accent border. Desk rows keep a bottom rule. No new colours. Paper / Demo / Live dots may use the existing `mode-paper`, `mode-demo`, and `mode-live` tokens.
- The modal is the only setup entry. It closes when the tour step is finished. **Platform Tour** in the account sidenav stays available.
- The tour card uses `bg-surface` with a `bg-plan-header` bar. The bar reads Tour and the step count. The heading is the instruction. The primary button is **Next**. No new colours.
- Light and dark follow header UI preferences. Do not put light tokens on `html` / `body`.

## Development reset

**Reset Wizard** in the setup footer is available in every environment until the desks are written. It stays hidden after Create, on the Review result and on Take a Tour. It removes only the desks and keys this setup created, clears the draft, and starts the explainer again.

Outside production, **Reset Account** sits above **Platform Tour** in the account sidenav. It is hidden when `VERCEL_ENV` is `production`, and the server action refuses there too. It deletes every desk on this login, including open paper rows and copy desks, then the exchange keys, then the onboarding row. The sign-in, plan, and template library stay. The setup wizard opens again.

## Micro-steps

Stop after each until Click says go. Do not start inside item 4 or item 6.

| # | Step | Done when |
| --- | --- | --- |
| 1 | State | Migration + database.md. Pending / skipped / completed. Skip with zero desks. A desk created outside the wizard marks skipped. |
| 2 | Desk draft | Add Desk sub-modal, names, paper market data, disabled rows when gates say so. Nothing written until Finish except the draft json. |
| 3 | Exchanges | Connected desks only. New trade-only key, or bind later. No existing-connection picker. Secrets not in the draft. |
| 4 | Finish desks | Finish creates and binds. Retry does not duplicate. Summary lists bound vs bind later. |
| 5 | Starter bots | Flagged folders only. Apply idle / disabled. TV and Perps ticket skip the step. Failures listed, siblings kept. |
| 6 | Tour | Offer, overlay, persistence, Platform Tour, conditional steps. |
| 7 | New desk | Optional **Add starter bots** on the existing create form. |

## Tests

- Skip leaves zero desks and does not show the modal again.
- Adding DCA Paper and Perps bots Connected creates those two modes and no others. Names that collide are rejected before Finish.
- Connected with bind later inserts `mode = live` and no connection.
- Two connected rows cannot select the same connection id.
- A key with withdrawal permission never saves.
- The manual bot page lists every created desk that has starter content. It contains templates from flagged platform folders, plus flagged platform templates that are not already in those folders.
- Apply leaves a bot Disabled when Initial Status is Disabled. Active starts the bot. For DCA, Active is the arm action. Disabled creates no order.
- TradingView Strategy and Perps still show step 2, with nothing to load.
- Finish retry does not insert a second desk or a second bot.
- Tour decline does not start the overlay. Skip tour persists. A missing desk omits the desk steps.
- A gated cell does not create that desk when the server rejects.

## Out of scope

- Putting `/welcome` back as a block on the product
- Auto Demo Account
- Starting a bot the member did not tick, marketplace, or copying starter rows into the member library
- Admin-edited tour scripts, videos, or a help center (V1 item 13)
- Account-wide Positions / Bots (item 4, still waiting on Click)
- Building plan gates (item 6). This wizard only calls them
- Copy desks, scale-in, MEXC, paper auto-switch
- Changing type or mode after create
- Private exchange calls from the browser
- A public member template catalog (V2)
