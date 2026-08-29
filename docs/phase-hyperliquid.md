# Hyperliquid venue

**Roadmap 2.** Started 29 Aug 2026. **Not MEXC** (roadmap 16). Fly.io is parked. Bybit desks stay Bybit.

Bybit desks stay Bybit. Hyperliquid is a **second venue-locked desk**, not a flag inside the existing Perps/DCA pages. Internal **venue capabilities** say what each exchange can do. The next CEX (MEXC) is another capability row + adapter + page module — not another rewrite of Bybit.

Private calls stay on the server (Fly worker after roadmap 1; Sydney Vercel until then). The browser never sees decrypted secrets.

## Purpose

Create Perps, DCA, or TradingView Strategy desks whose **exchange is Hyperliquid** (immutable at create). Connected Demo uses **Hyperliquid Testnet**. Connected Live uses **mainnet**. Paper uses the in-app ledger and Hyperliquid **public** marks (no agent). Cash and Carry cannot pick Hyperliquid.

## Status

Started 29 Aug 2026. Steps 1–3 are in repo. Step 4 (Hyperliquid desk module) is in repo 29 Aug 2026. Paper marks and full DCA/TV klines are still steps 5–6.

## How this scales

Do **not** grow `if (venue === "hyperliquid")` through today’s Bybit forms, blotter, or `execute.ts` Bybit branches.

Three layers:

```
1. Capabilities (code registry)   what the exchange is allowed to do
2. Adapter (lib/exchanges/<id>)   how to talk to it
3. Desk module (pages/components) UI + commands for that venue × desk type
```

**Create desk** picks type **and** exchange (only exchanges that allow that type). Both are immutable, same as Paper vs Connected.

**Routes stay** `/strategies/futures?desk=` and `/strategies/cash-and-carry?desk=`. The layout loads a **Bybit module or a Hyperliquid module**. Bybit files do not import Hyperliquid. A MEXC Perps desk later is a third module, not edits to the Bybit files.

**Shared (keep):** session, `?desk=`, login connections table, encrypt-at-rest, event logs, templates library (apply remaps to the target desk’s venue), thin `runFuturesCommand` **router** that calls the desk module.

**Not shared:** hedge vs one-way, USDT vs USDC, `BTCUSDT` vs `BTC`, Bybit Demo vs HL Testnet hosts, C&C legs, credential fields.

MEXC later: add a capability object (likely hedge, USDT, HMAC key, demo if they have one), `lib/exchanges/mexc/`, `components/venues/mexc/…`. If MEXC matches Bybit capabilities closely, it may reuse the Bybit **desk module** with a different adapter. Hyperliquid does **not** reuse that module.

## Venue capabilities (internal parameters)

Code registry (extend today’s `lib/exchanges/venues.ts`). Postgres stores `venue` text only; the registry is the allow-list. No per-feature columns on `trading_accounts`.

| Parameter | Bybit | Hyperliquid | Why it exists |
| --- | --- | --- | --- |
| `id` | `bybit` | `hyperliquid` | Connection + desk |
| `deskTypes` | all four | `perps`, `dca`, `signal_follower` | Hide C&C |
| `positionMode` | `hedge` | `one_way` | Two sides vs one net row |
| `quote` | USDT | USDC | Size labels |
| `symbolKind` | `linear_usdt` (`BTCUSDT`) | `coin` (`BTC`) | Pickers, blotter, templates |
| `datedCarry` | true | false | C&C |
| `auth` | HMAC apiKey + apiSecret | account address + agent key | Exchanges form |
| `environments` | `live` (Live), `demo` (Demo) | `live` (Live), `testnet` (Demo) | Hosts + Create Desk |
| `demoRole` | Bybit Demo API | Hyperliquid Testnet | “Demo” in the product |
| `paperMarket` | Bybit public | Hyperliquid public `info` | Paper marks |
| `liveOrders` | REST v5 | signed `/exchange` | Adapter |
| `nativeTpsl` | trading-stop | trigger orders | Adapter spike |
| `dcaBoth` | yes | no | Hide Both |
| `tvWebhook` | yes | yes | Same TBP door, different adapter |

Adding an exchange is: fill this row, implement the adapter port, register desk modules for each allowed `deskType`. If `positionMode` and `symbolKind` match an existing module, reuse that module and only swap the adapter.

Port the adapter must implement (one TypeScript interface, two files):

- public universe, tickers, klines
- verify credentials (trade-only)
- place / amend / cancel / read order and position
- account snapshot (available / margin as the venue actually has)
- map cloid / orderLinkId

`execute.ts` today is Bybit-shaped. Split it: Bybit adapter stays; Hyperliquid adapter is new; a three-line dispatcher keyed by `desk.venue` (not scattered through UI).

## Desk model

Today a desk is `mode` (paper \| live) + `desk_type`. Add immutable **`venue`**. Existing rows migrate to `bybit`.

Live desks also store immutable **`venue_environment`**: the Demo or Live track for that exchange (`demo` / `live` on Bybit, `testnet` / `live` on Hyperliquid). Bind may only use a login connection with the same `venue` **and** `environment`. Cannot attach a mainnet agent to a Demo desk.

| Create choice | `mode` | `venue_environment` | What happens |
| --- | --- | --- | --- |
| Paper Trading | `paper` | null | In-app ledger. Public marks from that venue. No key. |
| Demo | `live` | Bybit `demo` or HL `testnet` | Real venue test/demo matching. Must bind a matching connection. |
| Live | `live` | `live` | Real venue production. Must bind a matching connection. |

**Hyperliquid Demo = Testnet** (`https://api.hyperliquid-testnet.xyz`). Copy: **Demo (Hyperliquid Testnet)**. Default the Connected picker to Demo so a new HL desk does not land on mainnet by accident.

Paper is still offered (TBP ledger, HL public prices). Demo is not Paper: Testnet orders are real for that network (faucet / test USDC).

Bybit Create Desk keeps today’s Paper vs Connected Exchange; Connected bind still picks Live vs Demo on the key. Optionally later align Bybit to the same three-choice UI. Not required to ship HL.

### One-way (Hyperliquid only)

One open blotter row per symbol. Buy into a short reduces / closes / flips. DCA **Both** is not on this module. Do not use subaccounts to fake hedge (later: Hedged DCA).

Bybit hedge unique `(account, symbol, side)` **does not change**. HL command module refuses a second side. Same `futures_*` tables; different command files.

### Pages

| Venue × type | Module |
| --- | --- |
| Bybit × C&C / Perps / DCA / TV | **Current** `app/strategies/…` and current components. No HL imports. |
| Hyperliquid × Perps / DCA / TV | **New** `components/venues/hyperliquid/…` (and matching lib). Loaded only when `account.venue === "hyperliquid"`. |

Do not teach the current DCA playbook form a Both-hidden flag for HL. Duplicate the form in the HL module (or extract shared field widgets that have no venue policy). Policy lives in the module.

Chrome (header, desk switcher) can show exchange name from capabilities. Strategy URLs unchanged so two tabs can still be Bybit Perps and HL Perps via `?desk=`.

## Auth (agent wallet)

No HMAC key. Master address holds funds. Approved **agent** can trade, cannot withdraw.

| Field | Secret |
| --- | --- |
| Account address | No |
| Agent private key | Yes |

Fingerprint: last 4 of the **agent address**. Verify: agent is approved for that account; reject master keys (agent address === account). Member pastes an agent created in the Hyperliquid UI. TBP does not generate keys or `approveAgent` this phase.

Demo save hits **testnet**; Live save hits **mainnet**. Wrong network is a verify fail (same idea as Bybit Demo key on Live).

## Symbols, size, templates

HL coin `BTC`, settle USDC. Blotter stores `BTC`. Size in coin or USDC. Wire orders use **asset index** from `meta`.

Apply template onto an HL desk: remap `BTCUSDT` → `BTC` when the base matches; otherwise the apply wizard asks. Never trade the wrong coin. Bybit apply paths stay as they are.

## How a live (or Demo) order runs

1. Desk `venue` + `venue_environment` pick the adapter host.
2. Router → Hyperliquid module → signed `order` (EIP-712) as the agent. Market = aggressive IOC limit. GTC = `limit.tif = Gtc`. Reduce-only = `r`.
3. Idempotency → 128-bit hex **cloid**. Receipts table unchanged.
4. Working rows on `futures_working_orders`. TP/SL via trigger orders once proven on **Testnet**. Trailing: native if the spike says yes, else TBP tick like paper.
5. Reconcile from `info` on Positions load and the engine tick.
6. Leverage / liq / balance chip from `clearinghouseState` — only fields that exist. Do not fake Bybit Unified.
7. DCA indicators: HL `candleSnapshot` on HL desks. Bybit klines stay on Bybit desks.
8. Nonce: serialize per agent so tick and click cannot collide.

Signing in `lib/exchanges/hyperliquid/` with the smallest keccak+secp256k1 library. No full SDK unless the thin client fails. No browser signing.

## Data

- `trading_accounts.venue` text not null default `bybit` (check against app registry).
- `trading_accounts.venue_environment` text null (null on Paper; `demo`/`live`/`testnet` on Connected).
- Existing desks: `bybit`, environment inferred from the bound connection or null if unbound Paper.
- Bind: connection.venue and connection.environment must match the desk. C&C create does not list Hyperliquid.
- `exchange_connections` unchanged (encrypted JSON grows HL fields). Unique still `(user_id, venue, environment, key_fingerprint)`.
- `futures_*` / `dca_playbooks` symbol checks are 2–32 A–Z0–9 so coins like `BTC` persist. Bybit rows stay `BTCUSDT`.

No new blotter tables.

## Security

Agent key only. Encrypt at rest. Never send to the browser. Shared-connection warning still applies (same master margin). Do not log keys.

## Micro-steps

Stop after each step until Click says go. Do not start MEXC in this phase.

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Capabilities + desk columns | Agent | Venue registry lists Bybit and Hyperliquid parameters (desk types, hedge vs one-way, quote, symbols, auth fields, Demo host). Migration adds immutable `venue` and `venue_environment` on `trading_accounts`. Existing desks are `bybit`. Create Desk: type and mode first (Bybit path). Exchange is not a separate picker — venue comes from the bound key when they choose Select Existing. Bind Later stays Bybit until a Hyperliquid key exists. Bind must match venue + environment. Checks pass. **In repo 29 Aug 2026.** Push `develop` to migrate. |
| 2 | Adapter (Testnet first) | Agent | `lib/exchanges/hyperliquid/`: public meta, tickers, candles, user state; signed `/exchange` on Testnet; verify rejects master keys. Dispatcher only in `execute.ts`. No edits inside Bybit UI. **In repo 29 Aug 2026.** |
| 3 | Exchanges | Agent | `/account/exchanges` is registry-driven. Hyperliquid fields: account address + agent key. Demo saves against Testnet, Live against mainnet. Fingerprint is agent last 4. Secret never returns to the browser. |
| 4 | Hyperliquid desk module | Agent | Separate Perps / DCA / TV Strategy pages and commands. One-way blotter. No Both. Bybit pages untouched. Connected HL desk binds only a matching Demo or Live HL connection. Place / close / GTC / cancel / Close All through the HL adapter. **In repo 29 Aug 2026.** |
| 5 | Paper Hyperliquid | Agent | Paper HL desk uses the same HL module and HL public marks, in-app fills, no agent. Bybit paper still Bybit public. |
| 6 | DCA + TradingView | Agent | HL DCA: indicator klines from HL, long or short only. TV Strategy webhook still hits TBP, orders go to the HL adapter. |
| 7 | Desk test | Click | **Demo (Testnet):** Buy/Sell/Close, GTC, TP/SL, Cancel, Close All, DCA long, dummy TV. Then a small **Live** clip. Confirm a Bybit Perps desk still hedges and still uses `BTCUSDT`. |

## Out of scope

- MEXC / XT / Binance (roadmap 16; capability row + adapter + module)
- Cash and Carry on Hyperliquid
- HIP-3
- Subaccount fake hedge
- Generating/approving agents in TBP
- Copy trading, event-driven signals, backtesting, Starter Pack CTA ([roadmap.md](roadmap.md))
- `if (hyperliquid)` inside Bybit components
- Fly.io in this pass (roadmap 1 first); private APIs from the browser
- Scale-in / position builder (roadmap 6)

## After this: other exchanges

Roadmap 16. New capability row (likely HMAC, USDT, Bybit-like hedge if true). Prefer **reusing the Bybit desk module** if parameters match; only a `lib/exchanges/mexc` adapter. If MEXC is one-way or different symbols, it gets its own module like Hyperliquid. Write `docs/phase-mexc.md` when that item starts.
