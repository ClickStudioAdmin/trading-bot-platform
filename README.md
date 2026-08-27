# Trading Bot Platform

Multi-tenant web app and always-on trading engine. First strategy: dated cash-and-carry (buy spot, short expiring futures).

GitHub is the source of truth. The hosted database and Vercel deployment are not.

## Current phase

**Phase 11 complete — DCA desk type**

See [docs/phase-11.md](docs/phase-11.md). Daily work is on `develop` against the **development** Supabase database and the Vercel **Development** / Preview environment. Merge to `main` for the **production** database and Vercel **Production**. See [docs/environments.md](docs/environments.md).

Phase 1 through Phase 11 are complete. Next is scale-in (Phase 12) — wait for instruction. No Fly.io. Hyperliquid and additional CEX adapters wait. Backup market-data vendors wait ([docs/master-spec.md](docs/master-spec.md) Later).

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
