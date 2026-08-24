# Phase 6 — Exchange connections

## Purpose

Let a **Live** trading account store exchange API credentials on the desk. First venue is Bybit. The model is venue-agnostic so later venues (OKX, Binance, and others) add an adapter and a registry row — not a new table or a Bybit-shaped schema.

This phase **stores and verifies** keys. It does not place orders. It does not add Fly.io. It does not call private exchange APIs from the browser. The cash-and-carry scan stays on public Bybit market data. The tick still skips Live accounts.

Paper accounts do not hold exchange connections.

## Current micro-step

**3 of 6 — Envelope encrypt** (complete)

Phase 6 is current. Waiting on **4 — Connections table**.

## Micro-steps

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | `phase-6.md` is exchange connections. Master spec, README, database, and phase-discipline say Phase 6 |
| 2 | Venue registry | Agent | `lib/exchanges` names venues, environments, and credential fields. Bybit is the only enabled venue. Checks pass. No database yet |
| 3 | Envelope encrypt | Agent | Server encrypts/decrypts an opaque credentials payload. Checks pass. No keys in git or `NEXT_PUBLIC_` |
| 4 | Connections table | Agent | `exchange_connections` migration. GitHub Actions applies on `develop` |
| 5 | Exchanges UI | Agent | `/account/exchanges` lists, adds, and removes connections for the current **Live** account. Paper sees copy only. Secret is never shown after save |
| 6 | Verify trade-only | Agent | Saving a Bybit key checks trade permission and **rejects withdrawal**. Fingerprint (last 4) is what the UI can show |

Stop after each step. Do not start the next until you say so.

## Multi-venue rules

- Table, types, and routes are **`exchange_*` / `venue`**, never `bybit_keys`.
- `venue` is a stable string id (`bybit` now; `okx` later). Postgres stores text. The registry in code is the allow-list.
- One connection per **account + venue + environment** (a Live book may have Bybit mainnet and, later, Bybit demo, or a second venue).
- Credentials are an **encrypted JSON object**. Each venue declares its fields in the registry (Bybit: API key + secret. A later venue may add passphrase without a migration).
- The Exchanges form is driven by the registry. Adding a venue is a new adapter + enable flag, not a fork of the page.
- Public market data and private trading are separate clients. Today only the public Bybit scanner exists. Private REST is Bybit-only when verify lands; other venues stay disabled.
- Decision math stays venue-agnostic. A later live adapter will consume the same engine decisions paper already uses. Not this phase.

## Who can connect

- **Live** account: can save connections.
- **Paper** account: `/account/exchanges` explains that paper does not use keys.
- Keys belong to the **trading account**, not the login. Switching accounts shows that book’s connections only.

## Security

- Trade-only keys. Withdrawal permission is a hard reject.
- Encrypt at rest with a server secret (`EXCHANGE_CREDENTIALS_KEY` on Vercel Development and Production — different values). Decrypt only in server actions / route handlers.
- Never send the secret or decrypted payload to the browser. After save, show venue, environment, label, last 4 of the API key, and status.
- Do not log credentials. Event logs may record venue, environment, fingerprint, and success/fail.
- Do not commit the encryption key. Do not put it in `NEXT_PUBLIC_*`.

## Data (lands in step 4)

`exchange_connections`:

- `account_id`, `user_id`
- `venue` (text)
- `environment` (text; Bybit: `mainnet` or `demo`)
- `label` (optional)
- `credentials_ciphertext`, `credentials_nonce` (opaque)
- `key_fingerprint` (display only)
- `status` (`active` / `invalid`)
- `verified_at`
- Unique `(account_id, venue, environment)`

RLS: own-row select. Writes are service-role, scoped by the session account. Authenticated clients must not `select` ciphertext.

## Runtime

Unchanged. Tick still paper-only. Vercel still must not place exchange orders.

## Out of scope

- Placing or cancelling exchange orders
- Fly.io worker
- Live blotter / live ledger (do not write `paper_carries` for live fills)
- Enabling a second venue in the UI
- Paper auto-switch ([phase-auto-switch.md](phase-auto-switch.md))
- Maker future ask
- Mapping a TBP account onto an exchange sub-account product
- Copy or convert Paper ↔ Live
