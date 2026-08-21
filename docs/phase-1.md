# Phase 1 — Foundation (pipeline proof)

## Purpose

Prove this path works **without local CLI**:

Cursor → GitHub → GitHub Actions → Supabase → Vercel

This phase does not implement trading, Bybit, or the opportunity scanner. The app only shows a static homepage.

Same **accounts** as Fisheries Quota Exchange. **New** Supabase projects and a **new** Vercel project. Never reuse FQX project IDs, database passwords, or the FQX Vercel app.

You will not run `supabase`, `vercel`, or `gh` commands. Migrations run in GitHub Actions. Deploys happen when GitHub receives a push.

## Current micro-step

**1 of 9 — Repo contract** (this step)

Docs, Cursor rules, and `.gitignore`. No application code yet.

## Micro-steps

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Repo contract | Agent | `README.md`, `docs/`, `.cursor/rules/`, `.gitignore` exist |
| 2 | Static Next.js homepage | Agent | Homepage shows name, operational line, `Build: 001`. Lint and production build succeed |
| 3 | Migration + Actions workflow | Agent | `system_health` migration and `.github/workflows/deploy-database.yml` are in git |
| 4 | Two new Supabase projects | You (dashboard) | Dev + prod projects exist in the **same Supabase account** as FQX, empty, not the FQX projects |
| 5 | GitHub Environments and secrets | You (GitHub UI) | `development` and `production` environments; secrets listed below on **this** repo only |
| 6 | New Vercel project | You (Vercel dashboard) | Import `ClickStudioAdmin/trading-bot-platform`. Production branch `main`. Preview from `develop` |
| 7 | First push to `develop` | Agent (commit/push when you ask) | Actions job **Apply development migrations** succeeds |
| 8 | Verify development | You (dashboards) | Table Editor shows `system_health` with row `TBP`. Vercel Preview shows the homepage |
| 9 | Merge to `main` when you are ready | You + agent | Production Actions succeeds. Production Vercel shows `Build: 001` |

Stop after each step. Do not start the next until you say so.

## Out of scope

- Bybit, scanner, auth, encrypted API keys, engine worker, Fly.io
- Reusing FQX Supabase or Vercel projects
- Editing hosted schemas in the SQL editor as the normal process
- Local `supabase db push` or Vercel CLI

## GitHub secrets (step 5)

Repository `ClickStudioAdmin/trading-bot-platform` only. Do not copy FQX project IDs.

### Repository secrets

| Secret | Used by |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Both (`sbp_...` account token; can be the same token you already use for FQX) |
| `SUPABASE_DB_PASSWORD` | `main` only (new **production** TBP project) |
| `SUPABASE_PROJECT_ID` | `main` only (new **production** TBP project ref) |
| `DEVELOPMENT_SUPABASE_DB_PASSWORD` | `develop` only |
| `DEVELOPMENT_SUPABASE_PROJECT_ID` | `develop` only |

Create GitHub Environments named `development` and `production` under **Settings → Environments**.

## Vercel (step 6)

Phase 1 needs **no** environment variables.

## Acceptance criteria (end of Phase 1)

1. Homepage copy matches the spec (step 2)
2. Exactly one application table: `system_health` with one row `TBP`
3. Migration lives in GitHub
4. GitHub Actions applies migrations from `develop` → development Supabase and `main` → production Supabase
5. Vercel serves the homepage from `main`
6. No later-phase features

## Later mapping

The earlier product plan numbered scanner as “Phase 1”. In this repo:

| This repo | Product plan | Meaning |
| --- | --- | --- |
| Phase 1 | Phase 0 | Foundation / pipeline |
| Phase 2 | Phase 1 | Scanner + Current Opportunities |
