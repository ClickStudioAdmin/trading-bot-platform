# Trading Bot Platform

Multi-tenant web app and always-on trading engine. First strategy: dated cash-and-carry (buy spot, short expiring futures).

GitHub is the source of truth. The hosted database and Vercel deployment are not.

## Current phase

**Phase 6 — Exchange connections** (complete)

See [docs/phase-6.md](docs/phase-6.md). Daily work is on `develop` against the **development** Supabase database and the Vercel **Development** / Preview environment. Merge to `main` for the **production** database and Vercel **Production**. See [docs/environments.md](docs/environments.md).

Phase 6 stores encrypted, trade-only exchange keys on Connected Exchange accounts. Bybit is first. No exchange orders. No Fly.io.

Next, when you say so: [Phase 7 — Additional exchanges](docs/phase-7.md).

## Technology stack

- Next.js, TypeScript, App Router
- Supabase PostgreSQL (new projects on the existing Click Studio account)
- Vercel hosting (new project on the existing account)
- GitHub Actions for database migrations (no local Supabase CLI)

## Local development

Not required for Phase 1 verification beyond lint and production build. The homepage is static and does not use a database.

`package.json` includes `dev`, `lint`, `build`, and `start`. Copy `.env.example` to `.env.local` only when a later phase needs Supabase in the app. Never use the production project locally.

Never commit `.env.local` or secrets.

## Deployment

| Branch | Supabase database | Vercel environment |
| --- | --- | --- |
| `develop` | Development project (separate database) | Development |
| `main` | Production project (separate database) | Production |

GitHub Actions secrets (this repo only — not FQX project IDs):

- Shared: `SUPABASE_ACCESS_TOKEN`
- Production (`main`): `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`
- Development (`develop`): `DEVELOPMENT_SUPABASE_DB_PASSWORD`, `DEVELOPMENT_SUPABASE_PROJECT_ID`
