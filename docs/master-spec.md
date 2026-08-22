# Master spec

Trading Bot Platform is a multi-tenant desk: each trader connects their own exchange API keys and can run strategies. Version 1 focus is dated cash-and-carry on Bybit (USDT spot + USDT expiry).

## Source of truth

GitHub. Hosted Supabase and Vercel are not.

## Runtime split

- Repo-root Next.js on Vercel — UI and the Phase 4 paper tick HTTP door
- Paper engine tick lives in `lib/engine` and is host-agnostic. Phase 4 is scheduled by GitHub Actions against the Sydney Vercel function. Fly.io can call the same function later
- Supabase — Postgres only. Sign-in is the `members` table and a signed cookie
- `/admin` — `members.role = admin`, plus `click.studio.admin@gmail.com`. Logs and members now; settings later

The web app never places exchange orders from a Vercel invocation. Paper `paper_carries` writes are not exchange orders.

## Environments

`develop` uses a dedicated development Supabase database and the Vercel Development environment. `main` uses a dedicated production Supabase database and the Vercel Production environment. See [environments.md](environments.md).

## UI

Dark business portal. Tokens in `app/globals.css`. Visual guide at `/theme`. Written rules in [ui-theme.md](ui-theme.md).

## Current phase

Phase 4 — Automated paper engine. See [phase-4.md](phase-4.md). Phase 1, Phase 2, and Phase 3 are complete.

## Multi-tenancy (later)

Bring-your-own API keys. No custody of user funds. Trade-only keys, no withdrawal.
