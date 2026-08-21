# Environments

Trading Bot Platform uses two hosted environments. GitHub is the source of truth for both.

Same **Supabase account** and **Vercel account** as Fisheries Quota Exchange. Separate **projects**. Never point this repo at FQX databases or the FQX Vercel app.

| Git branch | Supabase | Vercel | When to use |
| --- | --- | --- | --- |
| `develop` | Development project (new) | Preview / testing URL | Daily work |
| `main` | Production project (new) | Production URL | After you are happy on `develop` |

Do not point `develop` at the production database. Do not point local work at the production database.

You do not run Supabase or Vercel CLI. GitHub Actions applies migrations. Vercel deploys from GitHub.

## Branch flow

1. Do work on `develop`.
2. Push `develop`. GitHub Actions applies migrations to **development** Supabase. Vercel builds a Preview from `develop`.
3. Check the development database and the Vercel Preview URL in the dashboards.
4. Merge `develop` into `main` when happy.
5. Push/merge to `main` applies migrations to **production** Supabase and deploys production Vercel.

## GitHub Actions

[`.github/workflows/deploy-database.yml`](../.github/workflows/deploy-database.yml) is added in Phase 1 micro-step 3. It will run on pushes to `develop` and `main`.

- `develop` runs **Apply development migrations** and uses GitHub Environment `development`.
- `main` runs **Apply production migrations** and uses GitHub Environment `production`.

Development secrets use separate names so a missing development secret fails the job instead of falling back to production.

### Repository secrets

| Secret | Used by |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Both (`sbp_...` personal access token) |
| `SUPABASE_DB_PASSWORD` | `main` only |
| `SUPABASE_PROJECT_ID` | `main` only |
| `DEVELOPMENT_SUPABASE_DB_PASSWORD` | `develop` only |
| `DEVELOPMENT_SUPABASE_PROJECT_ID` | `develop` only |

Create GitHub Environments named `development` and `production` under **Settings → Environments**. Protection rules on `production` are optional.

Do not put the production database password in the `development` environment. Do not paste FQX project refs into these secrets.

## Supabase

Create **two** new hosted projects in the existing account (dashboard):

1. `trading-bot-platform-dev` (or similar) — development
2. `trading-bot-platform` (or similar) — production

Do not reuse the FQX development or production projects.

## Vercel

Import **this** GitHub repository as a **new** Vercel project.

- Production branch: `main`
- Previews: `develop` and pull requests

Phase 1 needs no Vercel environment variables. When the app later reads Supabase from the browser, set:

| Variable | Preview / `develop` | Production / `main` |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Development project URL | Production project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Development publishable key | Production publishable key |

Never add a service-role key to `NEXT_PUBLIC_` variables.

## Merge to production

Open a pull request from `develop` into `main`. After merge:

- Vercel production updates
- GitHub Actions applies any new migrations to production Supabase
