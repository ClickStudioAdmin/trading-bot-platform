# Trading Bot Platform

Multi-tenant web app and always-on trading engine. First strategy: dated cash-and-carry (buy spot, short expiring futures).

GitHub is the source of truth. The hosted database and Vercel deployment are not.

## Current phase

**Phase 1 — Foundation (pipeline proof)**

See [docs/phase-1.md](docs/phase-1.md). Work happens on `develop`. Merge to `main` for production. See [docs/environments.md](docs/environments.md).

This phase proves Cursor → GitHub → GitHub Actions → Supabase → Vercel. No trading features yet.

## Technology stack

- Next.js, TypeScript, App Router
- Supabase PostgreSQL (new projects on the existing Click Studio account)
- Vercel hosting (new project on the existing account)
- GitHub Actions for database migrations (no local Supabase CLI)

## Local development

Not required for Phase 1. The homepage is static. Copy `.env.example` to `.env.local` only when a later phase needs Supabase in the app. Never use the production project locally.

Never commit `.env.local` or secrets.

## Deployment

| Branch | Database | App |
| --- | --- | --- |
| `develop` | Development Supabase | Vercel Preview |
| `main` | Production Supabase | Vercel Production |

GitHub Actions secrets (this repo only — not FQX project IDs):

- Shared: `SUPABASE_ACCESS_TOKEN`
- Production (`main`): `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`
- Development (`develop`): `DEVELOPMENT_SUPABASE_DB_PASSWORD`, `DEVELOPMENT_SUPABASE_PROJECT_ID`
