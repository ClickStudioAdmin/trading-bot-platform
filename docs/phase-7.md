# Phase 7 — Additional exchanges

Not current. Do not start until Phase 6 is accepted and Bybit connections are confirmed working (save, trade-only verify, bind in Strategy Settings). Current work is [phase-6.md](phase-6.md).

## Purpose

Add another exchange (and refine the UI for more than one venue). Bybit stays first. The next venue is chosen when this phase starts — the connections table is already venue-agnostic.

This phase still does not place exchange orders. Paper still uses the in-app ledger. Connected Exchange still stores trade-only keys.

## Paper market data (do this once a second venue can scan)

Paper Trading does not hold API keys. In Cash and Carry **Strategy Settings**, Paper picks a **venue** from exchanges that have a public scanner for that strategy. Same place as the Connected Exchange key picker; different list:

- **Paper Trading** — venue ids that support this strategy’s public market data. No key. No Demo vs Live (Bybit’s public book is the same on both hosts).
- **Connected Exchange** — saved keys on that book (`exchange_connection_id`), unchanged from Phase 6.

Do not ship the Paper picker while only Bybit can scan. A one-item dropdown is noise.

## What this phase includes

- Enable a second venue in the registry (adapter + public cash-and-carry scan)
- Trade-only verify for that venue (reject withdrawal; never send secrets to the browser)
- Refine Exchanges and Strategy Settings so venue vs key vs Paper data source is obvious
- Paper Strategy Settings: venue list for market data, once two venues can scan
- Persist the Paper scan venue on the book/strategy settings (not on `exchange_connections`)

## Out of scope

- Placing or cancelling exchange orders
- Live blotter / live ledger
- Fly.io worker
- Paper auto-switch ([phase-auto-switch.md](phase-auto-switch.md))
- Calling private exchange APIs from the browser
