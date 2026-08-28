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
1. Shared cycle     public scan / ticker snapshot (once per loop)
2. Claim            take N idle desks (lease)
3. Desk tick        that desk only: reconcile its book, its automations, its playbooks
4. Release          next loop
```

### 1. Work unit = one desk

A desk is already `trading_accounts` (type-locked, one bind). Isolation is another desk **and** another trade-only key.

`runDeskTick(accountId)` does only that desk’s work: C&C layers **or** Perps recipes **or** DCA playbooks, plus reconcile of **that** book’s working orders. No global `reconcileOpenFuturesBooks()`.

Shared public work (C&C opportunity scan, linear tickers) stays **outside** the per-desk loop so 200 desks do not fetch the universe 200 times.

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

Shipped in repo: `engine_desk_leases` + claim RPCs (`20260829080000_engine_desk_leases.sql`), `runEngineCycle` / per-desk tick, in-memory lease tests, Fly configs (`fly.development.toml`, `fly.production.toml`), worker (`lib/engine/worker.ts`), GitHub **Deploy Engine**. Vercel tick and admin Tick call the same leased cycle (`maxMs` 50s). GitHub’s 5-minute POST stays as a leased fallback until Fly is healthy.

### Click: turn Fly on (development first)

1. Create app in **Sydney**: `fly apps create tbp-engine-dev --region syd`
2. GitHub Environment `development`: `FLY_API_TOKEN`
3. Fly secrets (development Supabase **only**): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EXCHANGE_CREDENTIALS_KEY` — same values as Vercel Development
4. Push `develop` (migrations + deploy-engine). Confirm worker logs and a DCA tick
5. Production later: `tbp-engine`, GitHub `production` token, production secrets. Never mix
6. After Fly is the clock, remove the schedule from `paper-engine-tick.yml` (keep **Run workflow**)

## Out of scope

- Redis / queue libraries
- Moving inbound TradingView webhooks onto Fly
- Backup market data, other exchanges, Hyperliquid

