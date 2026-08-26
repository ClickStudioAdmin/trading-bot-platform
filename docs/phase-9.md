# Phase 9 — TradingView door

Complete. Phase 8 is complete. See [phase-8.md](phase-8.md). Phase 10 is complete. See [phase-10.md](phase-10.md). Phase 11 is DCA. See [phase-11.md](phase-11.md).

## Purpose

Give each Futures book named HTTPS webhooks on Sydney Vercel. Create picks the type: **TradingView strategy** (TV sends every Buy / Sell / Close) or **Signal** (TV only pings; an automation owns size and action). No typed desks this phase.

Paper Trading books write the in-app ledger only. Connected Exchange books use the existing Futures bind.

## Status

Complete. Accepted after Click’s dummy desk test (26 Aug 2026). Live TradingView alerts stay in Later. Phase 10 is typed desks. See [phase-10.md](phase-10.md).

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | This file is the TradingView door. Master spec current phase is 9. |
| 2 | Door | Agent | Each Futures book can mint a URL. Path token is the secret. Hash + encrypted token on `strategy_settings`. Unsigned / unknown token is 401. Raw Bybit payloads are 400. |
| 3 | Order verb | Agent | JSON `action` Buy / Sell / Close + symbol + size becomes `runFuturesCommand`. Same reduce-only and caps as a click. Optional `id` is the idempotency key (≤36 chars, longer ids are hashed). Paper writes the ledger only. Live uses the Futures bind. Source is Webhook plus the webhook name. |
| 4 | Arm verb | Agent | `arm` / `disarm` / `close-playbook` return 200 and write an event log. No playbook body this phase. |
| 5 | Webhooks tab | Agent | `/strategies/futures/webhooks` holds named Order and Signal URLs. Positions can send a dummy call through the same door. |
| 6 | Dummy desk test | Click | Named URL. Send test from Positions. Custom TV Strategy fills. Source shows Webhook. Signal arm fires a matching automation. |

Phase accepted. Typed desks are [phase-10.md](phase-10.md). DCA is [phase-11.md](phase-11.md).

## Later

- Live TradingView alert test (not the Positions dummy). Copy the URL from Webhooks on the Vercel Development host, not localhost. If Vercel Deployment Protection is on, that URL must include the automation bypass query (the desk adds it when `VERCEL_AUTOMATION_BYPASS_SECRET` is set). Confirm Buy / Sell / Close, duplicate `id` does not double-fill, a bad token is 401, Signal arm fires the automation, and the blotter Source is Webhook. If both sides are open, Close needs `close_long` / `close_short` or `side`.

## How a webhook works

1. On **Webhooks**, create a named URL: `{origin}/api/futures/webhook/{token}`. Name is required and unique on the book. That name is what Automations **When** shows for a Signal webhook. **TradingView strategy** (`order`) needs symbol and size in the JSON. **Signal** (`signal`) accepts `arm` and fires any automation whose When is that name. The token is 64 hex characters, stored as a SHA-256 hash plus ciphertext. Rotate invalidates the old URL. Positions can send a dummy call through the same door. On a protection-gated Vercel Preview, the copied URL also includes `x-vercel-protection-bypass` so TradingView can POST without a custom header.
2. TradingView POSTs JSON to that URL. The path token is the secret. Do not put the token in the JSON. Do not send a Bybit private-API dump.
3. **Order** — `action` is `buy`, `sell`, or `close` (aliases `flatten`, `close_long`, `close_short`). Same URL for all three. Each TradingView alert has its own message. `symbol` may be `{{ticker}}` (Bybit `BTCUSDT.P` and `BYBIT:BTCUSDT.P` are accepted). Size is `qty`, `usdt` (`sizeUnit`), or `contracts`. Optional `orderType` `market` or `limit` with `limitPrice`. Close looks up the open row on that symbol (and `side` when both sides are open). Same reduce-only and risk caps as a desk click. Do not map Pine `strategy.order.action` onto Sell — that sell often means close-long.
4. **Signal** — `action` is `arm`, `disarm`, or `close-playbook`. `arm` runs automations whose When is that webhook. The rule still owns symbol, size, and Buy / Sell / Close. Phase 11 can also arm a DCA playbook from the same ping.
5. Optional `id` (or `idempotencyKey`) is stored on `futures_command_receipts`. Live sends it to Bybit as `orderLinkId` when it fits. A replay returns the same flash and does not place again.
6. TradingView strategy fills store source `webhook`. Automations store `engine`. `rule_name` is the webhook or automation name. Positions, open orders, order details, and Activity show Webhook or Auto plus that name. Manual is a desk click.

Example order body:

```json
{
  "action": "buy",
  "symbol": "{{ticker}}",
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
- Webhooks tab: named URLs, rotate, delete. Positions dummy call through the same door
- Optional `APP_BASE_URL` so the shown URL is the stable Vercel host

## Out of scope

- Typed desks / `desk_type` / nav rename
- DCA clips and playbook body
- Chained recipes
- Hyperliquid / MEXC / XT
- Fly.io
- Calling private exchange APIs from the browser
- Paper auto-switch ([phase-auto-switch.md](phase-auto-switch.md))
