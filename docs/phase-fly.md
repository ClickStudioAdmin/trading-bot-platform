# Fly.io engine worker

Roadmap 1. **Accepted 29 Aug 2026.** Implementation started 29 Aug 2026. Vercel stays the UI. Private exchange APIs stay on the server. The browser never sees decrypted keys. Paper desks stay on the in-app ledger. Same `runFuturesCommand` and `futures_*` / paper ledgers.

## Purpose

Put the trading engine on an always-on host so many desks and live ladders do not share one 60-second Vercel run. The **structure** must scale (add machines without double-placing) before we care about how many machines we start with.

## Why not lift-and-shift

Today GitHub Actions POSTs `/api/engine/tick` every 5 minutes. That function (`runPaperEngineTick`) does, in one request:

1. Cash-and-carry scan + every C&C desk
2. Reconcile **all** open working orders (live: one Bybit GET each)
3. Every Perps automation
4. Every DCA playbook

`maxDuration` is 60s. In-memory grid/exit locks do not work across Vercel invocations. That is why a 15-rung live ladder hung the tick.

Moving that **same** function onto Fly only removes the timeout. One process still walks every desk. Two processes would both walk every desk and double-place. **That does not scale.**

## Structure that scales

Three layers. Implement these in code **before** (or as) the first Fly deploy. One Fly machine is enough at first **if** this structure exists; more machines then become safe.

```
Vercel (Sydney)     UI, TradingView webhook HTTP door, user Save/Arm/Trigger
Postgres            Ledgers + desk leases (the coordinator)
Fly (Sydney)        One or more worker processes claiming desks
```

```
1. Shared cycle     public scan / ticker snapshot (once per loop, one machine)
2. Claim            take N idle desks (SKIP LOCKED lease)
3. Desk tick        that desk only; a few desks in parallel on one process
4. Release          next loop
```

### 1. Work unit = one desk

A desk is already `trading_accounts` (type-locked, one bind). Isolation is another desk **and** another trade-only key.

`runDeskTick(accountId)` does only that desk’s work: C&C layers **or** Perps recipes **or** DCA playbooks, plus reconcile of **that** book’s working orders. No global `reconcileOpenFuturesBooks()`.

Shared public work (C&C opportunity scan, linear tickers) stays **outside** the per-desk loop so 200 desks do not fetch the universe 200 times. A Postgres **scan lease** means only one Fly machine scans; the others read the last stored opportunities. Skip the C&C scan when no C&C desks exist. Skip linear tickers when no Perps or DCA desks exist. Skip indicator klines when that playbook is idle.

### 2. Coordinator = Postgres leases (no Redis)

No extra queue product. A lease row per desk (or `pg_advisory_lock` on the desk id):

- Worker: `UPDATE … SET leased_until, worker_id WHERE leased_until < now() RETURNING` (or `FOR UPDATE SKIP LOCKED`)
- Stale lease expires so a dead machine does not pin a desk
- Two workers cannot run the same desk at once
- Tests: two concurrent claims → one wins; expired lease is reclaimable

Vercel mutations (Save, Arm, Trigger, webhook place) take a **short** lock on the same desk id, or rely on existing idempotency keys (`runFuturesCommand`). Prefer the short lock so Save and a worker tick cannot rest the same ladder together. Keys stay the safety net.

### 3. Host = Fly in Sydney, two apps

Bybit blocks many US IPs (same as Vercel `syd1`). Fly region **`syd`**. Two apps, same split as today:

| Git | Fly app | Supabase / secrets |
| --- | --- | --- |
| `develop` | engine-dev | Development project only |
| `main` | engine | Production project only |

Never mix. GitHub Actions deploys the worker; it does not POST the 60s Vercel tick once Fly is the scheduler.

Same TypeScript repo. A Node entry (`lib/engine/worker` or similar) imports existing tick helpers. Do not add a second language. Do not put the Next.js UI on Fly.

Start with **one machine per app**. Adding machines is then “raise count”; the lease table is the scale-out switch.

### 4. What stays on Vercel

- Desk UI and admin
- TradingView / Signal **inbound** HTTP (`/api/futures/webhook/…`) — event-driven place, not the 5-minute scan
- User Save / Arm / Trigger (already server-side)

Admin header **Tick** must not keep running the global 60s monolith. After cutover it nudges the worker (or claims desks the same way). Until cutover, keep the existing door as fallback.

### 5. Venue budget (per bound key)

Same key on two desks still shares venue margin **and** rate limits. A per-connection token bucket (in Postgres or in-process with desk affinity) so one loop cannot flood Bybit. Keep live DCA pacing (few grid ops per pass) even without a 60s ceiling — that was a venue-safety cap, not only a timeout workaround.

### 6. Clock

Fly loop on the order of **15–30 seconds**, not 5 minutes. Interval DCA and price-cross start need that. Do not tick faster than the venue budget allows.

## What this is not

- Not Hyperliquid, copy trading, or scale-in
- Not Redis / Kafka / a second database
- Not calling private APIs from the browser
- Not Vercel Cron
- Not rewriting `runFuturesCommand` or the ledgers
- Not moving inbound webhooks onto Fly in this pass (roadmap 4 can add internal event signals later)

## How we know it will scale (before many users)

Prove the structure with tests and a two-worker desk test, not with production traffic:

1. Lease: two workers, one desk → one tick, no double place
2. Partition: 20 desks, two workers → each desk ticked, none twice in the same wave
3. Crash: kill a worker mid-desk → lease expires, the other worker finishes, idempotency keys prevent a second venue order
4. Overlap: Save/Arm on Vercel during a Fly tick → lock or key, not twin Entry #s
5. Bybit Demo: one live DCA ladder completes without hanging the rest of the book

If those pass, adding machines and desks is capacity, not a redesign.

## Status

Accepted 29 Aug 2026. Implementation started 29 Aug 2026.

Shipped in repo: `engine_desk_leases` + claim RPCs (`20260829080000_engine_desk_leases.sql`), `runEngineCycle` / per-desk tick, in-memory lease tests, Fly configs (`fly.development.toml`, `fly.production.toml`), worker (`lib/engine/worker.ts`), GitHub **Deploy Engine**. Vercel tick and admin Tick call the same leased cycle (`maxMs` 50s). The 5-minute GitHub POST is off (workflow_dispatch only). Header **Tick** is the Vercel fallback.

Each Fly loop claims **hot desks first** (open futures rows, armed DCA playbooks, active Perps recipes), then idle books, and ticks up to three claimed desks at once. One linear ticker snapshot is reused for reconcile. Paper desks skip the venue gate. Live market stop / take profit attach on the fill (`placeClip` and GTC reconcile). Indicator **cross** starts latch until the first order so a 5m bar is not missed. The worker loads desk binds without a browser session. Auto tick is off unless an admin turns it on.

### What Click does first (development only)

Leave production alone until this one is ticking. Do these in order.

**1. Get the code onto GitHub**  
The Fly worker and the lease table are on your machine until they are committed and pushed to `develop`. Ask the agent to commit if you want that done for you. After a push to `develop`, GitHub Actions will try two jobs: one applies the new database table to the **development** Supabase project, and one tries to deploy the Fly app. The deploy job will fail until the Fly app and token exist. That is expected.

**2. Sign in to Fly**  
Signing up with GitHub is fine. That only logs you in. It does **not** mean Fly should deploy this repo.

**3. Skip “Launch an App from GitHub”**  
That is the page you get when you click **Launch an app**. Fly shows it to GitHub sign-ups. Do **not** click **Connect GitHub account** and do **not** pick `trading-bot-platform`. That wizard would try to host the whole Next.js app on Fly and fight Vercel.

There is **no** dashboard button to create an empty app by name. That is normal. Close Launch. GitHub Actions will create **tbp-engine-dev** in Sydney once it has a token.

**4. Give GitHub permission to create and deploy the app**  
You need an **org** token, not a GitHub-app launch.

1. Close Launch. Open the Fly **dashboard** (your org / Apps list).
2. In the org menu (not inside an app), open **Tokens**.
3. Create a token. Copy it once. Treat it like a password.
4. In GitHub: repo **Settings → Environments → development**. Add a secret named `FLY_API_TOKEN` with that token. Development only for now.

Tell the agent when that secret is saved. Still do not use Launch from GitHub.

**5. Let GitHub create the empty app**  
After the token is on GitHub, push `develop`. The job creates **tbp-engine-dev** in Fly org **tbp-154** (the TBP org). It will then stop and say the three app secrets are missing. That is expected. Also run **Deploy Database** if that has not gone green yet. The app will not appear under Apps until this step succeeds. Do not click **Launch an App**.

**6. Copy three secrets onto that Fly app**  
Once **tbp-engine-dev** appears in the Fly dashboard, open it (do not Launch another app). Open **Secrets**. Add exactly these names, with the **same values already on Vercel Development** (the `develop` environment), not Production:

- `SUPABASE_URL` — development project URL
- `SUPABASE_SERVICE_ROLE_KEY` — development **service role** key (the secret one, never a `NEXT_PUBLIC_` key)
- `EXCHANGE_CREDENTIALS_KEY` — the same 64-character key Vercel Development uses to encrypt exchange API keys

If those three do not match Vercel Development, the worker will talk to the wrong database or fail to decrypt keys. Do not paste production values here.

Re-run **Deploy Engine**. You want both green:

- Database job: lease tables exist on **trading-bot-platform-dev**
- Engine job: Fly built the worker and it is running in Sydney

**7. Check that it is actually looping**  
In Fly, open **tbp-engine-dev** logs. You should see the worker start, then a cycle about every 20 seconds. In the app, `/admin/logs` should show engine tick lines. A live DCA desk on Demo should keep placing or amending without you sitting on Auto tick.

**8. Leave Auto tick off**  
Fly is the clock. Use header **Tick** if you want a Vercel nudge. **Run workflow** on Paper Engine Tick is the manual fallback. Do not turn Auto tick on unless you are debugging.

**Do not do yet**  
Production Fly app, production secrets on the dev app, or merging to `main` for this. Same split as always: `develop` → dev database + this Fly app; `main` → production later.

## Out of scope

- Redis / queue libraries
- Moving inbound TradingView webhooks onto Fly
- Backup market data, other exchanges, Hyperliquid

