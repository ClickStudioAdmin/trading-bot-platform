# Phase 9 — TradingView door

Current. Phase 8 is complete. See [phase-8.md](phase-8.md).

## Purpose

Give each Futures book one HTTPS webhook on Sydney Vercel. TradingView (or curl) posts Buy / Sell / Close into `runFuturesCommand`. Arm / disarm / close-playbook are accepted and logged so Phase 11 can run a playbook. The webhook is a door, not a brain. No typed desks this phase.

Paper Trading books write the in-app ledger only. Connected Exchange books use the existing Futures bind.

## Status

In progress. Steps 1–5 are in code. Waiting on Click’s TradingView / curl desk test (step 6).

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | This file is the TradingView door. Master spec current phase is 9. |
| 2 | Door | Agent | Each Futures book can mint a URL. Path token is the secret. Hash + encrypted token on `strategy_settings`. Unsigned / unknown token is 401. Raw Bybit payloads are 400. |
| 3 | Order verb | Agent | JSON `action` Buy / Sell / Close + symbol + size becomes `runFuturesCommand`. Same reduce-only and caps as a click. Optional `id` is the idempotency key (≤36 chars, longer ids are hashed). Paper writes the ledger only. Live uses the Futures bind. Rows show Auto. |
| 4 | Arm verb | Agent | `arm` / `disarm` / `close-playbook` return 200 and write an event log. No playbook body this phase. |
| 5 | Webhooks tab | Agent | `/strategies/futures/webhooks` holds named Order and Signal URLs. Positions can send a dummy call through the same door. |
| 6 | Desk test | Click | Create an Order webhook. Send test from Positions. TradingView or curl Buy / Sell / Close on Demo. Bad token rejected. Duplicate `id` does not double-fill. A Signal webhook accepts arm only. |

Stop at the end of this phase for a desk test. Do not start typed desks ([phase-10 is not written until this phase is accepted]).

## How a webhook works

1. On **Webhooks**, create a named URL: `{origin}/api/futures/webhook/{token}`. **Order** webhooks need symbol and size in the JSON (signal follower). **Signal** webhooks only accept `arm` / `disarm` / `close-playbook` — a playbook owns clips (Phase 11). The token is 64 hex characters, stored as a SHA-256 hash plus ciphertext. Rotate invalidates the old URL. Positions can send a dummy call through the same door.
2. TradingView POSTs JSON to that URL. The path token is the secret. Do not put the token in the JSON. Do not send a Bybit private-API dump.
3. **Order** — `action` is `buy`, `sell`, or `close` (aliases `flatten`, `close_long`, `close_short`). `symbol` is a USDT linear perp. Size is `qty` or `usdt` (`sizeUnit`). Optional `orderType` `market` or `limit` with `limitPrice`. Close looks up the open row on that symbol (and `side` when both sides are open). Same reduce-only and risk caps as a desk click.
4. **Arm** — `action` is `arm`, `disarm`, or `close-playbook`. Logged only. Phase 11 implements the playbook.
5. Optional `id` (or `idempotencyKey`) is stored on `futures_command_receipts`. Live sends it to Bybit as `orderLinkId` when it fits. A replay returns the same flash and does not place again.
6. Source is `engine`, `rule_name` is TradingView. The blotter badge is Auto.

Example order body:

```json
{
  "action": "buy",
  "symbol": "BTCUSDT",
  "size": "0.001",
  "sizeUnit": "qty",
  "id": "{{ticker}}{{timenow}}"
}
```

## What this phase includes

- `POST /api/futures/webhook/[token]` on Sydney Vercel
- Webhook token columns on `strategy_settings`
- Order → `runFuturesCommand` (no second private API path)
- Arm / disarm / close-playbook accepted and logged
- Futures Settings: URL, rotate, disable
- Optional `APP_BASE_URL` so the shown URL is the stable Vercel host

## Out of scope

- Typed desks / `desk_type` / nav rename
- DCA clips and playbook body
- Chained recipes
- Hyperliquid / MEXC / XT
- Fly.io
- Calling private exchange APIs from the browser
- Paper auto-switch ([phase-auto-switch.md](phase-auto-switch.md))
