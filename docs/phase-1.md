# Phase 1 — Foundation (pipeline proof)

## Purpose

Prove this path works **without local CLI**:

Cursor → GitHub → GitHub Actions → Supabase → Vercel

This phase does not implement trading, Bybit, or the opportunity scanner. The app only shows a static homepage.

Same **accounts** as Fisheries Quota Exchange. **New** Supabase projects and a **new** Vercel project. Never reuse FQX project IDs, database passwords, or the FQX Vercel app.

Required split (see [environments.md](environments.md)):

- Git: daily work on `develop`; production only from `main`
- Supabase: two databases (development project and production project)
- Vercel: **Development** environment on `develop`, **Production** environment on `main`

You will not run `supabase`, `vercel`, or `gh` commands. Migrations run in GitHub Actions. Deploys happen when GitHub receives a push.

## Current micro-step

**9 of 9 — Merge to `main`** (done)

`origin/main` includes PR #1 from `develop` (`7a2010d`). Phase 1 foundation is complete once production Actions, production Vercel (**Build: 002**), and the production `system_health` row are confirmed.

## Micro-steps

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Repo contract | Agent | `README.md`, `docs/`, `.cursor/rules/`, `.gitignore` exist |
| 2 | Static Next.js homepage | Agent | Homepage shows name, operational line, `Build: 001`. Lint and production build succeed |
| 3 | Migration + Actions workflow | Agent | `system_health` migration and `.github/workflows/deploy-database.yml` are in git |
| 4 | Two new Supabase projects | You (dashboard) | Two empty projects in the **same account** as FQX: one database for `develop`, one for `main`. Not the FQX projects, not one shared TBP database |
| 5 | GitHub Environments and secrets | You (GitHub UI) | GitHub Environments `development` and `production`; secrets listed below on **this** repo only |
| 6 | New Vercel project + two environments | You (Vercel dashboard) | Import this repo. Vercel **Development** = branch `develop`. Vercel **Production** = branch `main`. Separate env vars later |
| 7 | First push to `develop` | Agent (commit/push when you ask) | Actions job **Apply development migrations** succeeds. Vercel Development deploy succeeds |
| 8 | Verify development | You (dashboards) | Dev Table Editor shows `system_health` with row `TBP`. Vercel **Development** URL shows the homepage |
| 9 | Merge to `main` when you are ready | You + agent | Production Actions succeeds. Vercel **Production** shows `Build: 001`. Production Table Editor has `system_health` |

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

New Vercel project for this repo only.

1. Production environment → branch `main`
2. Development environment → branch `develop`

Phase 1 needs **no** environment variables yet. When they are added, Development vars go to the development Supabase project and Production vars go to the production project.

## Acceptance criteria (end of Phase 1)

1. Homepage copy matches the spec (step 2)
2. Exactly one application table: `system_health` with one row `TBP`
3. Migration lives in GitHub
4. GitHub Actions applies migrations from `develop` → development Supabase and `main` → production Supabase (two databases)
5. Vercel **Development** serves `develop`; Vercel **Production** serves `main`
6. No later-phase features

## Later mapping

The earlier product plan numbered scanner as “Phase 1”. In this repo:

| This repo | Product plan | Meaning |
| --- | --- | --- |
| Phase 1 | Phase 0 | Foundation / pipeline |
| Phase 2 | Phase 1 | Scanner + Current Opportunities |
