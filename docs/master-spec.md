# Master spec

Trading Bot Platform is a multi-tenant desk: each trader connects their own exchange API keys and can run strategies. Version 1 strategies are dated cash-and-carry on Bybit (USDT spot + USDT expiry) and a single-leg Futures strategy (USDT linear perpetual buy / sell / close, market or GTC limit with amend, including a market or reduce-only limit close with qty, with entire or partial take profit / stop loss that can fill at market or rest a limit, a trailing stop by distance, optional Buy/Sell max value and max open positions, Close All / Cancel All Open Orders on Positions, live leverage / liq on the open row, desk alert automations that Buy / Sell / Close when last, mark, or index crosses a price, and a TradingView HTTPS webhook that posts those same commands).

## Source of truth

GitHub. Hosted Supabase and Vercel are not.

## Runtime split

- Repo-root Next.js on Vercel — UI and the paper tick HTTP door
- Paper engine tick lives in `lib/engine` and is host-agnostic. Fly.io (Sydney) is the always-on worker (`runEngineCycle`, per-desk leases). GitHub Actions can still POST the Vercel tick as a leased fallback. See [phase-fly.md](phase-fly.md).
- Supabase — Postgres only. Sign-in is the `members` table and a signed cookie. Trading state is scoped to `trading_accounts`, not the login
- A member can have many desks. Each desk is Paper or Live at create, and has a type (`cash_and_carry`, `perps`, `signal_follower` / TradingView Strategy, `dca`) that locks the UI. Hyperliquid (roadmap 2) also locks **venue** on the desk so Bybit pages stay Bybit ([phase-hyperliquid.md](phase-hyperliquid.md)). Paper uses the in-app ledger. Connected Exchange desks place venue orders from the Fly worker (Sydney) or the Vercel tick fallback when a key is bound.
- New members start with zero desks. First sign-in sends them to `/welcome` to create the first desk. Existing members who already have desks are unchanged. After the first desk exists, at least one must remain.
- `/admin` — `members.role = admin`, plus `click.studio.admin@gmail.com`. Overview is the landing page. Members, templates, logs, settings, and theme sit in the left menu

Paper `paper_carries` writes on a Paper book are not exchange orders. On a Connected Exchange book, the same tables store venue fills. A second Open on the same pair (manual or engine) adds size to the existing open row. Private exchange calls stay on the server. The browser is never given decrypted keys. The Fly worker (and the Vercel tick fallback) place Bybit orders on bound Connected Exchange books through `runFuturesCommand`.

## Environments

`develop` uses a dedicated development Supabase database and the Vercel Development environment. `main` uses a dedicated production Supabase database and the Vercel Production environment. See [environments.md](environments.md).

## UI

Dark business portal. Tokens in `app/globals.css`. Visual guide at `/admin/theme`. Written rules in [ui-theme.md](ui-theme.md). Desk-scoped pages (`/strategies/futures`, `/strategies/cash-and-carry`, `/account/book`) put the desk id in `?desk=`. Each browser tab can stay on its own desk. The `tbp_account` cookie is the last-used default for URLs that omit `?desk=`. Mutations follow the tab’s URL, not another tab’s cookie.

## Current phase

Phase 11 is complete. See [phase-11.md](phase-11.md). Phase 1 through Phase 11 are complete. Fly.io **is accepted and parked** ([phase-fly.md](phase-fly.md)). Hyperliquid steps 1–6 are in repo ([phase-hyperliquid.md](phase-hyperliquid.md)). Next is Click’s desk test (step 7).

The locked sequence after Phase 11 is [roadmap.md](roadmap.md). Standing unordered notes: [click-list.md](click-list.md). Automation templates: [templates.md](templates.md). Paper auto-switch stays parked ([phase-auto-switch.md](phase-auto-switch.md)).

## Later

Do not implement until Click starts that roadmap item. Order and notes: [roadmap.md](roadmap.md).

**Backup market data** (roadmap 5). Indicator start and other public candles stay on **Bybit public klines first**. When that item starts, failover if the call fails (timeout, HTTP 403, empty list):

1. Public linear klines from **Binance** and/or **OKX**, mapped to the same Bybit contract. Same RSI / MACD / EMA math. Prefer the trading venue’s book; backups are for uptime, not a second truth.
2. If public failover is not enough: a paid candle SLA (**CoinAPI** or **Kaiko**).
3. Optional extra filters (not candle backup): open interest / funding from Bybit public stats or **Coinglass**.

TradingView stays a Signal webhook, not a candle vendor. Orders stay on the bound exchange. Do not call private exchange APIs from the browser.

## Multi-tenancy

Bring-your-own API keys, stored on the **login**. Live desks bind one key. The same key on two desks shares venue margin. Isolation needs another trade-only key. No custody of user funds. Trade-only keys, no withdrawal. The connection model is venue-agnostic; Bybit is the first enabled venue. Hyperliquid is roadmap 2 ([phase-hyperliquid.md](phase-hyperliquid.md)); other CEXes are roadmap 16. Connected Exchange books show a Unified account snapshot (available, margin, IM/MM) from the bound key on My Account and on hover of the strategy exchange chip. The active desk for a tab is `?desk=` on desk-scoped URLs. The session cookie is last-used only.
