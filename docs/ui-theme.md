# UI theme

Living reference: [/admin/theme](../app/admin/theme/page.tsx) on the deployed site (`/admin/theme`).

Style: dark modern business portal. Tokens live in `app/globals.css` (`@theme`). Use those names in Tailwind (`bg-canvas`, `text-ink`, `border-line`, `bg-accent`). Do not introduce new brand hex values in components.

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
| `success` | `#34D399` | Positive change |
| `danger` | `#F07167` | Negative change, alerts, badges |
| `warning` | `#F5B942` | Caution, secondary chart segment |

## Type

Geist. Page title 30–36px semibold. Section 18–20px semibold. Body 14px. Labels 12px muted uppercase tracking. KPI values 24–32px semibold tabular.

## Surfaces

Cards: `bg-surface`, `border-line`, radius 16px, padding 20–24px. No heavy drop shadows. Soft border only.

## Layout

Desk chrome (header, footer, strategy nav, strategy pages, `/account`, `/admin`) uses `max-w-7xl` (~1280px). Narrow forms stay `max-w-lg` or `max-w-3xl`.

## Controls

Primary: `bg-accent-strong` / `text-ink`. Secondary: surface + `border-line`. Ghost: ink-muted, no fill. Danger: `danger` text or fill for destructive only.

`html` sets `color-scheme: dark` so native `<select>` lists use the dark OS picker (not a white flash). Do not force `select` to `canvas` — fields sit on canvas cards and use `surface-raised`.

**Bot form** is the **Bot form** tab on this page (`/admin/theme?tab=bot`) and the live Perps, DCA, and C&C automation cards. Shared chrome lives in `components/bot-form-chrome.tsx`. Optional sections use a styled checkbox to show or hide settings (no Off in the method dropdown). Same section order. Same chrome: no Actions column. **Save** sits at the top of the bot card only when that bot is dirty, with “You have unsaved changes on this bot.” **Status** is a dropdown; Save applies the selected mode. **Active** + Save turns the bot on. **Disabled** + Save closes positions that bot owns and turns it off. Confirm only when Disabled and the bot owns open size. A note under Status says what Save will do. Each desk keeps its own extra status (Perps / C&C Reduce only, DCA Stop adding). **Active** and **Disabled** are the same words on all three. Those lists do not merge. Book-level Reduce only stays a desk banner, not a bot mode. Hints sit on the label or section title itself (hover), not an i icon. Required fields are marked with an asterisk on the label — including always-on fields, not only fields in optional sections. When an optional section is on, those fields must be filled before Save. There is no “Required” copy under section titles or empty fields. Trigger settings title is always **Trigger - {kind}** (for example Trigger - Price Cross). Perps **Skip if this side is already open** sits in What & When (entry rule, not an exit). Trigger settings and Secondary Entry Condition / Hard Exit Condition use a 5-column row when the fields fit. DCA Direction Both duplicates Long / Short trigger params. Secondary Entry Condition and Hard Exit Condition each have Long and Short as their own checkbox sections. Footer actions sit under **Additional Actions** (Backtest, Save as template, Save as platform template, Remove). C&C has no Backtest. DCA **Maximum Exposure** (Max orders, Max value) sits after Secondary Entry Condition and before Initial Order Size. DCA remaining adds use the same Market / Limit pill as Perps Order, not a GTC checkbox. The **Theme** tab keeps the colour, type, and control reference.

## Motion

Short press on buttons (`scale` + opacity). Server-action submits swap the label for a spinner, then a success check for 1.5s. No decorative animation.
