# UI theme

Living reference: [/admin/theme](../app/admin/theme/page.tsx) on the deployed site (`/admin/theme`).

Style: dark modern business portal. Tokens live in `app/globals.css` (`@theme`). Use those names in Tailwind (`bg-canvas`, `text-ink`, `border-line`, `bg-accent`). Do not introduce new brand hex values in components.

Light is live. Header **UI preferences** (hover) sets Dark / Light for the whole app, then separately for **chrome** (sidebar, header, footer) and **content** (main page). Prefs persist on `tbp.ui.chrome` and `tbp.ui.content` cookies. Do not put light tokens on `html` / `body` — wrappers use `.theme-light`. `/admin/theme` still has a sample Dark / Light preview (`.theme-preview-light` / `.theme-dark`).

## Colour

| Token | Hex | Use |
| --- | --- | --- |
| `canvas` | `#0B0E14` | Page background |
| `surface` | `#161B22` | Cards, sidebar, header |
| `surface-raised` | `#1C222C` | Hover, active nav, raised controls |
| `line` | `#2A313C` | Default borders |
| `line-strong` | `#3A4352` | Focus / stronger dividers |
| `ink` | `#F4F6F8` | Primary text and values |
| `ink-muted` | `#9AA3B2` | Labels, secondary copy |
| `ink-faint` | `#6B7382` | Inactive nav, hints |
| `accent` | `#A78BFA` | Active states, links, primary actions, charts |
| `accent-strong` | `#8B6CF6` | Primary button fill |
| `plan-header` | `#764DED` | Plan compare card headers |
| `success` | `#34D399` | Positive change |
| `danger` | `#F07167` | Negative change, alerts, badges |
| `warning` | `#F5B942` | Caution, pending, secondary chart segment |
| `mode-paper` | `#8B93A1` | Desk mode Paper (sidebar dot and filter) |
| `mode-demo` | `#C9B44A` | Desk mode Demo / testnet. Dusty yellow, not paper grey and not pending amber. |
| `mode-live` | `#4AACA7` | Desk mode Live. Dusty teal, not danger red and not accent purple. |

Light (live chrome/content + Theme page preview):

| Token | Hex | Use |
| --- | --- | --- |
| `canvas` | `#F4F6F8` | Page background |
| `surface` | `#FFFFFF` | Cards, sidebar, header |
| `surface-raised` | `#EBEEF2` | Hover, active nav, raised controls |
| `line` | `#D4DAE3` | Default borders |
| `line-strong` | `#B7C0CC` | Focus / stronger dividers |
| `ink` | `#12161C` | Primary text and values |
| `ink-muted` | `#3F4754` | Labels, secondary copy |
| `ink-faint` | `#66707E` | Inactive nav, hints |
| `accent` | `#4E32B8` | Active states, links (deeper so small purple text meets contrast on white) |
| `accent-strong` | `#6D4FE0` | Primary button fill. Label is white (`#F4F6F8`), not light-scheme `ink`. |
| `plan-header` | `#5B3CC9` | Plan compare card headers |
| `success` | `#0D7A4F` | Positive text and badges (deeper so it reads on white) |
| `danger` | `#C4473E` | Negative text, alerts, badges |
| `warning` | `#9A6F0A` | Caution, pending |
| `mode-*` | same as dark | Desk mode dots unchanged |

Light callout and badge tints use a stronger mix than the dark `/10` `/15` washes so they separate from white `surface`. Solid `accent-strong`, `plan-header`, `success`, `danger`, and `warning` fills keep white labels. Portaled listboxes (AppSelect / AppMultiSelect), hints, and confirm overlays follow the nearest chrome or content scheme.

## Type

Geist. Page title 30–36px semibold. Section 18–20px semibold. Body 14px. Labels 14px ink, sentence case (`text-sm text-ink`). Bot form field labels are muted (`text-sm text-ink-muted`) so they sit behind card and group titles. Helpers under a field are 12px muted. Hints 13px faint (`text-hint`), sentence case — live helpers use this step. KPI values 24–32px semibold tabular.

## Surfaces

Cards: `bg-surface`, `border-line`, radius 16px, padding 20–24px. No heavy drop shadows. Soft border only.

## Layout

Desk chrome (header, footer, strategy nav, strategy pages, `/account`, `/admin`) uses `max-w-7xl` (~1280px). Narrow forms stay `max-w-lg` or `max-w-3xl`.

Breadcrumbs (`components/breadcrumbs.tsx`) are for pages that are not a nav item — a list row, create, or edit. Sample on **Theme**. Live on backtest results, copy trader/desk, checkout, admin member/plan edit and create, payout files, and desk Automations create / View/Edit. Hint size, muted parent links, faint current page, chevron separators. Sit in the top-left of the page, above the title. Do not add them on pages already in a sidenav, header, or desk subnav.

## Controls

Primary: `bg-accent-strong` / `text-ink`. On light chrome or content, purple fills keep white labels. Desk **Create New Bot**, **Create New Bot from Template**, and **Clone existing bot** use that same primary. Secondary: surface + `border-line`. Ghost: ink-muted, no fill. Danger: `danger` text or fill for destructive only. Confirmations use the in-app modal (`ConfirmModal`), not the browser `confirm()` dialog. Destructive confirms (disable, delete, unfollow) use Cancel plus a danger action. Publish / unpublish use the primary action.

Geist is the next/font face on `--font-geist` (not a local family named `Geist`). Field wells (text, `AppSelect`, `AppMultiSelect`) use `canvas`, `border-line`, and `focus:border-line-strong` — same class as Theme → Forms (`BILLING_FIELD_CLASS`). Dropdowns use the shared `AppSelect` listbox (`components/app-select.tsx`): surface panel, raised hover, accent on the selected row, Geist. Search stays pinned at the top of the listbox while options scroll. Desk **Clone existing bot** is `variant="action"` (same purple fill as the other desk buttons). Do not use a native `<select>` option menu. Multi-pick fields use `AppMultiSelect` (pills + search). File fields use the shared dropzone (`components/file-drop.tsx`); image fields keep the 56px preview. Samples live on **Theme → Controls** and **Theme → Forms**.

**Bot form** is the **Bot form** tab on this page (`/admin/theme?tab=bot`) and the live Perps, DCA, and C&C form opened from Automations → View/Edit (`?edit=`). Desk Automations itself is a Theme table of bots, not a wall of cards. Positions and Performance sit left of Actions: count / ROE plus an icon that opens that desk page with the bot pre-selected. The sample card on that tab matches live Perps and DCA field-for-field, including Indicator / Trend When and the shared trigger fields. Shared chrome lives in `components/bot-form-chrome.tsx`. Field wells, buttons, and callouts match Theme → Forms. Field labels are muted (`text-sm text-ink-muted`) so they sit behind the 18px card titles and 14px group titles (`text-ink`). The left column is stacked **step cards** — General, Entry Conditions, Position Sizing, Exit Conditions — each `bg-surface` with an 18px semibold title. **General** holds Name plus Contract and Direction (DCA) or Action (Perps). Inner group titles stay 14px semibold. A hairline sits between each subgroup (trigger kind, trigger fields, optional exits), same as the old single-card form. Entry Conditions has no What & When or Trigger - {kind} title. Optional sections use a styled checkbox to show or hide settings (no Off in the method dropdown). Only the checkbox toggles the section — not the title or the empty row. Shared sections follow DCA order where the desk has them: Trigger, Secondary Entry Condition, size (and DCA-only Maximum Exposure / Additional Order Types / Additional Order Scaling), Take profit, Trailing stop, Stop loss, Move Breakeven, Hard Exit Condition. Perps skips Maximum Exposure, Additional Order Types, and Additional Order Scaling. C&C keeps its own entry/exit groups. Same chrome: no Actions column. The page is two columns — form left, **Status & actions** sidebar right. **Save**, **Status**, Backtest, Save as template, and Save as platform template sit in that sidebar. **Remove** is on the Automations list Actions column (in-app confirm). A New Bot draft can still discard from the sidebar. “You have unsaved changes on this bot” appears in the sidebar only after the bot has been edited. After a successful Save, “Bot saved.” sits there for 1.5s, then clears. Editing the bot again clears it immediately. A brand-new bot does not show the unsaved or required copy until the user edits. **Status** is a dropdown; Save applies the selected mode. The status light stays on the saved mode until Save. When the dropdown differs, “Save bot to apply Status” sits under the field. A new bot starts **Disabled**. **Active** + Save turns the bot on. **Disabled** + Save closes positions that bot owns and turns it off. Confirm only when Disabled and the bot owns open size — that confirm is the in-app modal, not a JavaScript popup. A note under Status says what Save will do. Each desk keeps its own extra status (Perps / C&C Reduce only, DCA Stop adding). **Active** and **Disabled** are the same words on all three. Those lists do not merge. Book-level Reduce only stays a desk banner, not a bot mode. Hints sit on the label or section title itself (hover), not an i icon. Required fields are marked with an asterisk on the label — including always-on fields, not only fields in optional sections. Empty required fields (always-on or in an enabled section) disable Save. After the bot has been edited, “Fill required fields before saving.” appears in the sidebar. Clearing a required value shows that same line. There is no “Required” or “Enter a …” copy under empty fields. Venue, percent-cap, or available-margin problems still use a specific banner line. Save is blocked when the DCA ladder’s initial margin is above available on the desk, or a rung cannot meet that contract’s min/max or limit price. Perps **Skip if this side is already open** sits to the right of Initial Order Trigger (entry rule, not an exit). Perps **Order** (Market / Limit) and Limit price sit in Position Sizing, not Entry Conditions. Perps Initial Order Trigger is Price cross, Indicator, Trend, or Signal webhook. Close long / Close short stay Price or webhook. Perps Secondary Entry Condition, Hard Exit Condition, and Move Breakeven are one-sided (from Action), not Long/Short pairs. Hard Exit market-flattens the position that bot owns. Move Breakeven amends the venue stop to entry ± offset after the activation %. Trigger settings and Secondary Entry Condition / Hard Exit Condition use a 5-column row when the fields fit. DCA Direction Both duplicates Long / Short trigger params. Secondary Entry Condition sits under that side's primary trigger — Long under Long, Short under Short. Hard Exit Condition still has Long and Short as their own checkbox sections. Those actions sit in the sidebar. C&C has no Backtest. DCA **Summary** is its own card below the form, not attached to the form card. Take profit, Trailing stop, and Stop loss use the same optional-section chrome and the same Market / Limit **Order type** pill. The values stay desk-specific: Perps is exchange **Price** + **Trigger** (and Limit price when Limit); DCA is **Basis** (and Method on take profit) then a percent. Trailing is Retracement / Activation on Perps, Trigger % / Trailing % on DCA. Do not copy percent/ATR/basis onto Perps, or absolute Price onto DCA. DCA Take profit field order is Basis, Method, target, Order type. DCA **Maximum Exposure** (Max orders, Max value) sits after Secondary Entry Condition and before Initial Order Size. DCA remaining adds use the same Market / Limit pill as Perps Order, not a GTC checkbox. The **Theme** tab keeps the colour, type, and control reference. **Table** (`/admin/theme?tab=table`) is the source of truth for a full data table. Shared chrome: `TableFilterSession` (filters start hidden; Show Filters on the right of the toolbar row, just after page actions; Hide Filters on the filter bar, next to Clear; only when the table has a filter bar). After a live filter submit, or when filter query params are set, the bar stays open so typing a contract or search does not collapse it. Page actions (`actions`) sit on that right group — including **Columns** when the table has a column picker, and Close All / Chart on Positions. The Columns button shows how many of the pickable columns are on, for example **Columns (10 / 15)**. Desk Automations and Past Positions have that picker too. Name / Contract / Pair and Actions stay locked. Bulk (`toolbar`) sits on the left when rows are selected. `TableCard` (table + pager inside the card, centered icon Previous / Next), and icon actions (`TableIconAction`, `TableLabelButton`, `TablePendingIconAction`, `TablePendingLabelButton` in `components/table-actions.tsx`). Live one-line filters (Clear only), sortable headers, status badges (title case). Checkbox bulk only on tables that already have them — those bulk buttons stay hidden until a selection. 20 per page; the three pairs tables stay 50. Row actions and pager buttons are icon only; hover names the action and what it does. Click or press hides that hover until the pointer leaves, so a confirm panel or modal is unobstructed. Header, filter Clear, and existing bulk buttons keep their labels and add an icon. Desk **Positions** and **Performance** have a top-right data-set `AppSelect` (Desk Wide (all bots), or one bot) plus Bot, Pair, and Side filters (C&C skips Side). Both bot controls share the `bot` query. Empty Bot is Desk Wide (all bots). Changing the data-set dropdown does not open the table filter bar — that bar stays hidden until Show Filters. Close All stays desk-wide when a bot filter is on. Do not add filters, paging, or bulk to a live table that does not already have that control, except those desk blotter filters. The Theme sample table includes a **Columns** picker on the right actions group. **Forms** (`/admin/theme?tab=forms`) is the catalogue of platform field types and controls. Dummy only. Checkboxes and radios use `AppCheck` / `AppRadio` — do not use a native unstyled control. **Icons** (`/admin/theme?tab=icons`) is the living list of icons in use. Chrome icons are **Lucide** (`lucide-react`), imported only from `components/icons.tsx`. Add a Lucide icon to that file first — do not import `lucide-react` in a page, and do not add Heroicons, Tabler, Phosphor, or `react-icons`. Check Theme → Icons before adding so we do not pick a near-duplicate. Desk marks, desk types, and chart toolbar icons are Lucide too. Market tokens stay on `TokenIcon`. The site mark stays custom.

## Motion

Short press on buttons (`scale` + opacity). Server-action submits swap the label for a spinner, then a success check for 1.5s when the work is actually done. Desk Save / Disable return when the app has accepted the work — venue flatten, cancel, and grid sync finish in the background. A DCA row **Close**, Disable, or Close All marks the blotter row **Closing** / **Cancelling** as soon as the desk accepts (warning chip, no Close/Edit/Cancel, no success tick). The row leaves when the venue confirms. While any pending-close row is visible, Positions and Automations refresh about every 2s instead of 8s, and refresh once as soon as that pending state appears. The banner or blotter flash says the desk accepted the close. No decorative animation.
