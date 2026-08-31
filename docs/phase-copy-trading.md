# Copy trading

**Roadmap 3.** Started 31 Aug 2026. **Not a venue adapter.** Not a new desk type. Fly.io stays parked. Hyperliquid stays on its adapter ([phase-hyperliquid.md](phase-hyperliquid.md)). Charts and backtesting stay roadmap 4.

Follow another member’s **fills** onto the follower’s own desk. The parent shares a listing (private email or public catalogue). The follower binds their own key on Live. Recipes, bots, webhooks, and keys never leave the parent.

Closest shipped analog: TradingView Strategy — same blotter as the job, **desk only protects** ([phase-10.md](phase-10.md)).

## Status

Started 31 Aug 2026. Steps 1–4 are in repo. Stop after each step until Click says go. Push `develop` to migrate.

## Purpose

A connected desk can be **shared**. Other members create a **copy desk** of the same type and venue. Parent fills fan out, scaled, through `runFuturesCommand` (or the paper ledger). The follower only sets scale and desk-wide guards.

## Locked decisions

| Lock | Decision |
| --- | --- |
| Not a desk type | Do **not** add `copy_trade`. Follower `desk_type` and `venue` are **stamped from the parent**. |
| Not Paper/Live mode | `mode` stays Paper vs Live. Copy is an immutable `copy_of_account_id` plus a Create Desk path. |
| Share | **Private** (email grant) or **public** (catalogue). Not a second login on the parent. |
| Who may share | **Live + bound** only. Paper never. Unbound Live never. C&C never in v1. Unbind unlists / pauses new entries. |
| Activity floor | First **venue fill** on that desk at least **N days** ago. `copy_min_activity_days` on `/admin/settings` (persisted, default **90**, **0 allowed** for tests). Share and catalogue enforce N server-side. |
| Alias | Login **trader profile**, unique, required before first share. Email never shown. |
| Desk brief | Required to share. Owner-written setup notes (hedge vs one-way, etc.). Venue, type, and Live are stamped; they cannot fake those. |
| What copies | **Fills**, not recipes or GTC ladders. Wait until the parent fill, then place on the follower. |
| Sizing | Follower scale (% or USDT ratio). **Caps always win.** |
| Follower UI | Own blotter + leader strip (alias, trader stats, desk stats, brief). No ticket, Automations, playbooks, webhooks, templates apply, or backtest-from-this-desk. |
| Guards | Existing reduce-only and caps. New max daily loss / max open notional: breach flattens and pauses. Close All. Pause / unfollow. No row TP/SL in v1. |
| Modes | Parent never Paper. Paper follower of a connected Live parent is allowed. Venue and environment must match. |
| Types (v1) | `perps`, `perps_bots`, `signal_follower`, `dca`. |
| Stats | Computed only. Desk stats from the parent ledger. Trader stats: unique followers, public desk count, first shared. No rolled-up P&L across desks. |
| Engine | Fly worker / tick. Idempotency `parent_fill_id + follower_account_id`. One desk lease. Browser never sees parent keys or recipes. |

## Product shape

```
Owner
  Live bound desk → set alias → share private (email) or public (catalogue)
  required setup description

Follower
  invite or catalogue → Create Desk Copy path
  same type + venue as parent; Paper or Live (own key)
  scale + guards → fills fan out
```

Account nav gains **Copy desks** (catalogue). Sidebar shows a **Copy** badge on follower desks. Type grouping stays Automated vs Manual.

## Data shape

- Login trader profile: alias (unique), optional bio
- Persisted admin `copy_min_activity_days` and `copy_max_followers_default` (empty = no cap on new shares)
- `trading_accounts.copy_of_account_id` (immutable when set)
- Listing: `private` \| `public`, required description, optional `max_followers`
- `desk_copy_shares` (email / user, invited / active / revoked)
- Follower settings: scale, pause, max daily loss (caps stay on `strategy_settings`)
- `desk_copy_receipts` for idempotency

RLS: catalogue is public listings + alias + computed stats. Followers never select parent ledgers. Service role for the engine.

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | This file is the phase. Master spec and roadmap 3 point here. **In repo 31 Aug 2026.** |
| 2 | Schema + admin knob | Agent | Migration + persisted `copy_min_activity_days` (default 90, min 0) on `/admin/settings`. Checks for the activity floor. **In repo 31 Aug 2026.** Push `develop` to migrate. |
| 3 | Follower desk flag | Agent | `copy_of` immutable. Helpers hide ticket, Automations, webhooks, templates apply, backtest-from-desk. Sidebar **Copy** badge. **In repo 31 Aug 2026.** |
| 4 | Profile + share | Agent | Unique alias. Private or public, required brief. Reject Paper, unbound, C&C, and desks younger than N. **In repo 31 Aug 2026.** |
| 5 | Private grants | Agent | Email invite. Revoke, unlist, and unbind pause new entries. |
| 6 | Catalogue + stats | Agent | Public catalogue, filters, computed desk and trader stats, trader page (public desks only). |
| 7 | Create copy desk | Agent | Copy path stamps type/venue. Follower picks Paper or Live and scale. |
| 8 | Follower chrome | Agent | Leader strip. Caps, reduce-only, max daily loss. Pause / unfollow. Close All. |
| 9 | Engine fan-out | Agent | Parent fill → scale → guards → `runFuturesCommand` or paper ledger. Idempotent. Checks for skip/double-place. |
| 10 | Desk test | Click | Set N to 0. Private and public share. Copy from invite and catalogue. Paper follower of a Live parent. Small Live clip. Paper and unbound cannot share. Normal desks untouched. |

## Out of scope

- New `copy_trade` desk type, or `mode = copy`
- Cash and Carry copy
- Copying recipes, bots, or resting the parent’s GTC ladder
- Row-level follower TP/SL
- Payouts / affiliate take-rate
- Membership gates on who may list (roadmap 8)
- MEXC (roadmap 16)
- Reading hedge mode from the bound account (owner-written brief in v1)
