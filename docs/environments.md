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

[`.github/workflows/deploy-database.yml`](../.github/workflows/deploy-database.yml) runs on pushes to `develop` and `main`.

- `develop` runs **Apply development migrations** against GitHub Environment `development` and the development Supabase project.
- `main` runs **Apply production migrations** against GitHub Environment `production` and the production Supabase project.

[`.github/workflows/paper-engine-tick.yml`](../.github/workflows/paper-engine-tick.yml) is **Run workflow** only. Fly is the scheduler. The development job always runs. The production job runs only from `main`.

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

Bybit returns HTTP 403 to many **US** cloud IPs (their docs list “You are using U.S IP”). Vercel functions for this app must run in **Sydney (`syd1`)**, set in `vercel.json` `regions`. Confirm **Settings → Functions → Function Region** is Sydney, not Washington (iad1). This is not an API-key problem. A later unscheduled stage may add backup public klines if Bybit public still fails; see [master-spec.md](master-spec.md) Later. Do not add that now.

Pull request previews may use the Development environment’s variables (development Supabase). They must never use production Supabase.

Phase 1 needs no Vercel environment variables (static homepage). When the app later reads Supabase, set each variable twice — once per Vercel environment:

| Variable | Vercel Development (`develop`) | Vercel Production (`main`) |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Development project URL | Production project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Development publishable key | Production publishable key |
| `SUPABASE_URL` | Same as development project URL | Same as production project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Development **service role** | Production **service role** |

Never add a service-role key to `NEXT_PUBLIC_` variables. Never put production values on the Development environment.

Vercel will not put **Sensitive** variables on the **Development** environment. Leave Sensitive **off** for `NEXT_PUBLIC_` vars (they are public).

If the `develop` deployment badge says **Preview** (Vercel default when `develop` is not attached to the Development environment), put the TBP-dev values on **Preview** as well, or attach branch `develop` under **Settings → Environments → Development**. Check the deployment badge if sign-in says auth is not configured. Preview must never use the production Supabase project.

## Auth (desk members)

Sign-in is email/password against `public.members`. There is no Supabase Auth session. The server sets an httpOnly cookie (`tbp_session`) signed with `SESSION_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY` if that is unset.

Create members from **Admin → Members**. The first sign-in as `click.studio.admin@gmail.com` creates that admin row and sets the password. Members with no desks land on `/welcome` and create their first desk before the rest of the app.

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` can stay on Vercel for any remaining public Supabase reads. Desk writes use `SUPABASE_SERVICE_ROLE_KEY` and the session member id.

The service role is in the Supabase dashboard: **Project Settings → API → `service_role`**. Copy the **development** project’s key into Vercel **Development**, and the **production** project’s key into Vercel **Production**.

## Admin (Phase 4)

A member is an admin when `members.role` is `admin`, or the email is `click.studio.admin@gmail.com`. Manage accounts at `/admin/members`.

## Paper engine tick

The tick is `runEngineCycle` in `lib/engine`: shared scan, then **hot desks first** (open books, armed DCA, active Perps), then other idle desks via **per-desk leases**. Fly.io in **Sydney** (`tbp-engine-dev` / `tbp-engine`) loops about every 20 seconds, or 8 seconds while an indicator-start DCA bot is armed. Desk mark / P&L also poll Bybit public tickers through `GET /api/market/tickers`. See [phase-fly.md](phase-fly.md).

`POST /api/engine/tick` on Sydney Vercel is a **manual fallback** (same leases, 50s budget). [`.github/workflows/paper-engine-tick.yml`](../.github/workflows/paper-engine-tick.yml) is **Run workflow** only. Do not use Vercel Cron.

Admin header **Tick** runs the same cycle (`POST /api/engine/admin-tick`). Auto tick is **off** unless you turn it on in Admin Settings. It then POSTs that door every 5 seconds while an admin tab is visible.

| Variable | Where | Value |
| --- | --- | --- |
| `CRON_SECRET` | Vercel Preview (`develop`) and GitHub Environment `development` | Same random secret. TBP-dev only |
| `CRON_SECRET` | Vercel Production (`main`) and GitHub Environment `production` | A **different** random secret. TBP-prod only |
| `ENGINE_TICK_URL` | GitHub Environment `development` | The stable `develop` Preview URL + `/api/engine/tick` |
| `ENGINE_TICK_URL` | GitHub Environment `production` | The Production URL + `/api/engine/tick` |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | GitHub Environment `development` | Same value as Vercel **Protection Bypass for Automation**. Preview deployments are SSO-protected; without this header the tick gets `401 Protected Deployment` |
| `FLY_API_TOKEN` | GitHub Environments `development` and `production` | Fly deploy token. [`.github/workflows/deploy-engine.yml`](../.github/workflows/deploy-engine.yml) |

Fly app secrets (not GitHub): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EXCHANGE_CREDENTIALS_KEY` — development values on `tbp-engine-dev`, production on `tbp-engine`. Never mix.

The Vercel function already uses `SUPABASE_SERVICE_ROLE_KEY` on that Vercel environment. Never put the service role or `CRON_SECRET` in `NEXT_PUBLIC_*`. Never put production secrets on Preview or the `development` GitHub Environment.

Private Bybit calls stay on Sydney (Vercel `syd1` and Fly `syd`).

## Exchange credentials (Phase 6)

Encrypts API keys at rest. Server only. Different values on Development and Production. Generate with `openssl rand -hex 32`.

| Variable | Where | Value |
| --- | --- | --- |
| `EXCHANGE_CREDENTIALS_KEY` | Vercel Development (`develop`) | 64 hex characters. TBP-dev only |
| `EXCHANGE_CREDENTIALS_KEY` | Vercel Preview (if `develop` deploys as Preview) | Same value as Development. TBP-dev only |
| `EXCHANGE_CREDENTIALS_KEY` | Vercel Production (`main`) | A **different** 64 hex characters. TBP-prod only |

Never `NEXT_PUBLIC_`. Never put the production key on Development. Local `.env.local` may hold a dev-only key; do not commit it.

The same key encrypts the Futures webhook token (AAD `tbp.futures.webhook.v1`) so Settings can show the URL. The path token is the secret. Never `NEXT_PUBLIC_`.

## TradingView webhook (Phase 9)

`POST /api/futures/webhook/{token}` on the Sydney Vercel function. The token in the path is the book secret. No `CRON_SECRET`. No session cookie.

| Variable | Where | Value |
| --- | --- | --- |
| `APP_BASE_URL` | Vercel Development / Preview (`develop`) | Optional. Stable `https://…` host used when the Webhooks tab prints the URL. If unset, the page uses the request `Host` |
| `APP_BASE_URL` | Vercel Production (`main`) | Optional. Production origin, no trailing slash |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Vercel Development / Preview (`develop`) | Same Protection Bypass for Automation secret as the tick. TradingView cannot send headers, so the Webhooks tab appends it as `x-vercel-protection-bypass` on the copied URL. Do not set this on Production. |

Never put the webhook token in `NEXT_PUBLIC_*`. Rotate the token on Futures Settings if it leaks.

## Merge to production

Open a pull request from `develop` into `main`. After merge:

- Vercel **Production** updates
- GitHub Actions applies any new migrations to the **production** Supabase database
