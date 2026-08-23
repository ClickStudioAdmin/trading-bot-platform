# Master spec

Trading Bot Platform is a multi-tenant desk: each trader connects their own exchange API keys and can run strategies. Version 1 focus is dated cash-and-carry on Bybit (USDT spot + USDT expiry).

## Source of truth

GitHub. Hosted Supabase and Vercel are not.

## Runtime split

- Repo-root Next.js on Vercel — UI and the paper tick HTTP door
- Paper engine tick lives in `lib/engine` and is host-agnostic. It is scheduled by GitHub Actions against the Sydney Vercel function. Fly.io can call the same function later
- Supabase — Postgres only. Sign-in is the `members` table and a signed cookie. Trading state is scoped to `trading_accounts`, not the login
- A member can have many accounts. Each account is Paper or Live at create. Paper uses the in-app ledger. Live execution is later.
- `/admin` — `members.role = admin`, plus `click.studio.admin@gmail.com`. Logs and members now; settings later

The web app never places exchange orders from a Vercel invocation. Paper `paper_carries` writes are not exchange orders.

## Environments

`develop` uses a dedicated development Supabase database and the Vercel Development environment. `main` uses a dedicated production Supabase database and the Vercel Production environment. See [environments.md](environments.md).

## UI

Dark business portal. Tokens in `app/globals.css`. Visual guide at `/admin/theme`. Written rules in [ui-theme.md](ui-theme.md).

## Current phase

Phase 5 — Trading accounts. See [phase-5.md](phase-5.md). Phase 1, Phase 2, Phase 3, and Phase 4 are complete.

## Multi-tenancy (later)

Bring-your-own API keys. No custody of user funds. Trade-only keys, no withdrawal.
