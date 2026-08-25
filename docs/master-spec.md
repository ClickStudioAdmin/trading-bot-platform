# Master spec

Trading Bot Platform is a multi-tenant desk: each trader connects their own exchange API keys and can run strategies. Version 1 strategies are dated cash-and-carry on Bybit (USDT spot + USDT expiry) and a single-leg Futures strategy (USDT linear perpetual buy / sell / close).

## Source of truth

GitHub. Hosted Supabase and Vercel are not.

## Runtime split

- Repo-root Next.js on Vercel — UI and the paper tick HTTP door
- Paper engine tick lives in `lib/engine` and is host-agnostic. It is scheduled by GitHub Actions against the Sydney Vercel function. Fly.io can call the same function later
- Supabase — Postgres only. Sign-in is the `members` table and a signed cookie. Trading state is scoped to `trading_accounts`, not the login
- A member can have many accounts. Each account is Paper or Live at create. Paper uses the in-app ledger. Connected Exchange books place venue orders from Sydney Vercel when a key is bound (Phase 7).
- `/admin` — `members.role = admin`, plus `click.studio.admin@gmail.com`. Overview is the landing page. Members, logs, settings, and theme sit in the left menu

Paper `paper_carries` writes on a Paper book are not exchange orders. On a Connected Exchange book, the same tables store venue fills. A second Open on the same pair (manual or engine) adds size to the existing open row. Private exchange calls stay on the server. The browser is never given decrypted keys. The tick places Bybit orders on bound Connected Exchange books. Fly.io can call the same functions later; it is not required this phase.

## Environments

`develop` uses a dedicated development Supabase database and the Vercel Development environment. `main` uses a dedicated production Supabase database and the Vercel Production environment. See [environments.md](environments.md).

## UI

Dark business portal. Tokens in `app/globals.css`. Visual guide at `/admin/theme`. Written rules in [ui-theme.md](ui-theme.md).

## Current phase

Phase 8 — Futures strategy on Bybit. See [phase-8.md](phase-8.md). Phase 1 through Phase 7 are complete. TradingView, Hyperliquid, and additional CEX adapters wait until Phase 8 is accepted. Paper auto-switch is postponed ([phase-auto-switch.md](phase-auto-switch.md)).

## Multi-tenancy

Bring-your-own API keys, stored per **Live** trading account. No custody of user funds. Trade-only keys, no withdrawal. The connection model is venue-agnostic; Bybit is the first enabled venue.
