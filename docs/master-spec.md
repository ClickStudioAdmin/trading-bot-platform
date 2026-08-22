# Master spec

Trading Bot Platform is a multi-tenant desk: each trader connects their own exchange API keys and can run strategies. Version 1 focus is dated cash-and-carry on Bybit (USDT spot + USDT expiry).

## Source of truth

GitHub. Hosted Supabase and Vercel are not.

## Runtime split (later phases)

- `apps/web` (or repo-root Next.js in early phases) on Vercel — UI only
- Always-on engine (Fly.io or equivalent) — websockets, scan, orders
- Supabase — auth, Postgres, Realtime, encrypted keys

The web app never places exchange orders from a Vercel invocation.

## Environments

`develop` uses a dedicated development Supabase database and the Vercel Development environment. `main` uses a dedicated production Supabase database and the Vercel Production environment. See [environments.md](environments.md).

## UI

Dark business portal. Tokens in `app/globals.css`. Visual guide at `/theme`. Written rules in [ui-theme.md](ui-theme.md).

## Current phase

Phase 3 — Paper blotter. See [phase-3.md](phase-3.md). Phase 1 and Phase 2 are complete.

## Multi-tenancy (later)

Bring-your-own API keys. No custody of user funds. Trade-only keys, no withdrawal.
