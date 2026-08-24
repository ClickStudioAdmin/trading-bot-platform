# Master spec

Trading Bot Platform is a multi-tenant desk: each trader connects their own exchange API keys and can run strategies. Version 1 focus is dated cash-and-carry on Bybit (USDT spot + USDT expiry).

## Source of truth

GitHub. Hosted Supabase and Vercel are not.

## Runtime split

- Repo-root Next.js on Vercel — UI and the paper tick HTTP door
- Paper engine tick lives in `lib/engine` and is host-agnostic. It is scheduled by GitHub Actions against the Sydney Vercel function. Fly.io can call the same function later
- Supabase — Postgres only. Sign-in is the `members` table and a signed cookie. Trading state is scoped to `trading_accounts`, not the login
- A member can have many accounts. Each account is Paper or Live at create. Paper uses the in-app ledger. Live execution is later.
- `/admin` — `members.role = admin`, plus `click.studio.admin@gmail.com`. Overview is the landing page. Members, logs, settings, and theme sit in the left menu

The web app never places exchange orders from a Vercel invocation. Paper `paper_carries` writes are not exchange orders.

## Environments

`develop` uses a dedicated development Supabase database and the Vercel Development environment. `main` uses a dedicated production Supabase database and the Vercel Production environment. See [environments.md](environments.md).

## UI

Dark business portal. Tokens in `app/globals.css`. Visual guide at `/admin/theme`. Written rules in [ui-theme.md](ui-theme.md).

## Current phase

Phase 6 — Exchange connections. See [phase-6.md](phase-6.md). Phase 1, Phase 2, Phase 3, Phase 4, and Phase 5 are complete. After Phase 6 is accepted and Bybit connections are confirmed, next is Phase 7 — additional exchanges ([phase-7.md](phase-7.md)). Paper auto-switch is postponed ([phase-auto-switch.md](phase-auto-switch.md)).

## Multi-tenancy

Bring-your-own API keys, stored per **Live** trading account. No custody of user funds. Trade-only keys, no withdrawal. The connection model is venue-agnostic; Bybit is the first enabled venue.
