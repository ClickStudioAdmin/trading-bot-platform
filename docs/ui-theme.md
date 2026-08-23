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

## Controls

Primary: `bg-accent-strong` / `text-ink`. Secondary: surface + `border-line`. Ghost: ink-muted, no fill. Danger: `danger` text or fill for destructive only.

## Motion

None required on the theme page. Later: short hover on cards/nav, no decorative animation.
