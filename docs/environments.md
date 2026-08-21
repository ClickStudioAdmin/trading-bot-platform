# Environments

This split is required, not optional.

| Layer | Development | Production |
| --- | --- | --- |
| Git branch | `develop` | `main` |
| Supabase | **Separate** development project / database | **Separate** production project / database |
| Vercel environment | **Development** (branch `develop`) | **Production** (branch `main`) |
| GitHub Actions environment | `development` | `production` |
| Who it is for | Daily work | After you are happy on `develop` |

Same **Supabase account** and **Vercel account** as Fisheries Quota Exchange. Separate **projects** for this product. Never point this repo at FQX databases or the FQX Vercel app.

Hard rules:

- `develop` never uses the production Supabase project, password, or URL.
- `main` never uses the development Supabase project.
- Vercel **Development** env vars never contain production Supabase values.
- Vercel **Production** env vars never contain development Supabase values.
- Do not share one Supabase database across both branches.

You do not run Supabase or Vercel CLI. GitHub Actions applies migrations. Vercel deploys from GitHub.

## Branch flow

1. Do all feature work on `develop`.
2. Push `develop`. GitHub Actions applies migrations to the **development** Supabase database. Vercel deploys the **Development** environment.
3. Check the development database and the Vercel Development URL in the dashboards.
4. Open a pull request from `develop` into `main` when happy.
5. Merge to `main`. GitHub Actions applies migrations to the **production** Supabase database. Vercel deploys **Production**.

## GitHub Actions

[`.github/workflows/deploy-database.yml`](../.github/workflows/deploy-database.yml) is added in Phase 1 micro-step 3. It will run on pushes to `develop` and `main`.

- `develop` runs **Apply development migrations** against GitHub Environment `development` and the development Supabase project.
- `main` runs **Apply production migrations** against GitHub Environment `production` and the production Supabase project.

Development secrets use separate names so a missing development secret fails the job instead of falling back to production.

### Repository secrets

| Secret | Used by |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Both (`sbp_...` personal access token) |
| `SUPABASE_DB_PASSWORD` | `main` only (production database password) |
| `SUPABASE_PROJECT_ID` | `main` only (production project ref) |
| `DEVELOPMENT_SUPABASE_DB_PASSWORD` | `develop` only |
| `DEVELOPMENT_SUPABASE_PROJECT_ID` | `develop` only |

Create GitHub Environments named `development` and `production` under **Settings → Environments**. Protection rules on `production` are optional.

Do not put the production database password in the `development` environment. Do not paste FQX project refs into these secrets.

## Supabase

Create **two** new hosted projects in the existing account (dashboard). These are two databases, not two schemas in one project.

1. `trading-bot-platform-dev` — development database, used only by `develop`
2. `trading-bot-platform` — production database, used only by `main`

Do not reuse the FQX development or production projects. Do not use one TBP project for both branches.

## Vercel

Import **this** GitHub repository as a **new** Vercel project (not the FQX project).

Create two Vercel environments:

| Vercel environment | Git branch | Supabase |
| --- | --- | --- |
| Development | `develop` | Development project URL and keys |
| Production | `main` | Production project URL and keys |

In the Vercel project: **Settings → Environments**. Attach `develop` to **Development**. Keep **Production** on `main`.

Pull request previews may use the Development environment’s variables (development Supabase). They must never use production Supabase.

Phase 1 needs no Vercel environment variables (static homepage). When the app later reads Supabase, set each variable twice — once per Vercel environment:

| Variable | Vercel Development (`develop`) | Vercel Production (`main`) |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Development project URL | Production project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Development publishable key | Production publishable key |

Never add a service-role key to `NEXT_PUBLIC_` variables. Never put production values on the Development environment.

## Merge to production

Open a pull request from `develop` into `main`. After merge:

- Vercel **Production** updates
- GitHub Actions applies any new migrations to the **production** Supabase database
