# Copy trading

**Roadmap 3.** Started 31 Aug 2026. **Not a venue adapter.** Not a new desk type. Fly.io stays parked. Hyperliquid stays on its adapter ([phase-hyperliquid.md](phase-hyperliquid.md)). Charts and backtesting stay roadmap 4.

Follow another member’s **fills** onto the follower’s own desk. The parent shares a listing (private email or public catalogue). The follower binds their own key on Live. Recipes, bots, webhooks, and keys never leave the parent.

Closest shipped analog: TradingView Strategy — same blotter as the job, **desk only protects** ([phase-10.md](phase-10.md)).

## Status

Started 31 Aug 2026. Steps 1–9 are in repo. Stop after each step until Click says go. Push `develop` to migrate. Next is step 10 (your desk test).

## Purpose

A connected desk can be **shared**. Other members create a **copy desk** of the same type and venue. Parent fills fan out, sized from the follower’s chosen book, through `runFuturesCommand` (or the paper ledger). The follower sets desk-wide guards.

## Locked decisions

| Lock | Decision |
| --- | --- |
| Not a desk type | Do **not** add `copy_trade`. Follower `desk_type` and `venue` are **stamped from the parent**. |
| Not Paper/Live mode | `mode` stays Paper vs Live. Copy is an immutable `copy_of_account_id` plus a Create Desk popup. |
| Share | **Private** (email grant) or **public** (catalogue). Not a second login on the parent. Owner must tick **Enable sharing**. **Allow new followers** can close the door without unlisting current copiers. Sharing cannot be turned off while the parent has live trades (open positions or working orders). Once flat, off is allowed; followers see that the desk is no longer available for following. |
| Who may share | **Live + bound** only. Paper never. Unbound Live never. C&C never in v1. Unbind unlists / pauses new entries. |
| Activity floor | First **venue fill** on that desk at least **N days** ago. `copy_min_activity_days` on `/admin/settings` (persisted, default **90**, **0 allowed** for tests). Share and catalogue enforce N server-side. |
| Alias | Login **trader profile**, unique, required before first share. Optional logo. Email never shown. |
| Desk brief | Required to share. Owner-written setup notes (hedge vs one-way, leverage, etc.). Venue, type, and Live are stamped; they cannot fake those. |
| Copier gates | Optional **min available balance** on the listing. Live copy desks are checked at enable / unpause. Paper skips. Mode and leverage stay in the brief until a venue adapter can read them. |
| What copies | **Fills** and **resting limits** (DCA GTC clips and exit limits), sized the same way. Recipes, bots, and keys stay on the parent. A parent limit is copied as a limit at the same price. Cancel and amend follow the parent. When that parent limit fills, the copy limit is cancelled and the fill is market-copied. **DCA is all-or-nothing per symbol + side + cycle.** If the follower cannot copy the whole ladder, it copies none (no limits, no fills) and waits for the next cycle. Do not join a parent trade already in progress. |
| Sizing | **Same formula, three books.** Follower order USDT = parent fill USDT × (follower book / parent available). Parent $100k opens $10k is always 10% of the follower book. **Account balance** (default): book = real available. **Percent of account:** book = available × N%. **Fixed book:** book = dummy $X; if real available drops below $X, skip the fill and pause copying. Live available is the bound key; if available is 0, fan-out uses margin balance so a desk already in trades still copies. Paper book is **10,000 USDT + realized + unrealized**; the follow modal and Desk Settings name that start, and Market Data hover on paper desks shows live paper equity. Read when the fill copies. Skip if the parent fill, parent book, or resolved follower book is not a positive number. Paper copy sizes below the venue lot (so a 1/10 book still shows the parent multiplier). Live DCA does **not** round a clip up to the exchange minimum — if any clip in the cycle is below min qty or min notional, skip the whole cycle. Copy desks do **not** apply max value per symbol, max open positions, or max open notional — those would fight the size book. |
| Follower UI | Own blotter. Compact header: parent trader, parent desk, Pause, and Unfollow (browser confirm; open trades or last desk still block). Bind, sizing, reduce-only, max daily loss, max drawdown %, and max adverse move % are **Desk Settings**. Paper desks use the same **Market Data** chip; hover shows paper equity (starts at 10,000 USDT). Copy is a popup (desk on the left, guards on the right). After follow, stay and close; **Go to Copy Desk** under Copy jumps to the new desk. No ticket, Automations, playbooks, webhooks, templates apply, Pairs, or backtest-from-this-desk. A copy of **DCA** uses the same Positions / Open orders chrome as a normal DCA desk (Entry #, Orders, planned exits) from the parent recipe; it does not get playbook edit or arm. Perps / bots / TradingView copies stay on the generic perps blotter. Activity on a copy desk logs parent/child events: followed, paused, resumed, copied fills and limits, amends and cancels to match the parent, cycle skips, and per-fill skip reasons. |
| Guards | Reduce-only, **max daily loss** (flatten and pause), **max drawdown %** (follower equity vs peak since follow or last resume; flatten and pause), and **max adverse move %** (skip an entry when mark has moved against the parent fill; closes still copy; write a receipt so that fill is not retried). Empty is off. Missing parent price or mark does not skip. Close All. Pause / unfollow. Resume resets the drawdown peak. Position caps (max value per symbol, max open positions, max open notional) are parked on copy desks. No row TP/SL in v1. |
| Modes | Parent never Paper. Paper follower of a connected Live parent is allowed. Venue and environment must match. |
| Types (v1) | `perps`, `perps_bots`, `signal_follower`, `dca`. |
| Stats | **Snapshotted** on every futures desk (shared or not; not C&C). All-time and 30d realized P&L, win count, and max drawdown from realized peak-to-trough (close-time order). Catalogue reads the snapshot. Trader stats: unique followers, visible desk count, first shared. No rolled-up P&L across desks. No AUM, profit share, Sharpe, or views. |
| Engine | Fly worker / tick. Parent desk tick after reconcile (and after bots on that desk). Fills market-copy on the follower. Open working orders sync (place / amend / cancel). DCA cycles are gated before place: mid-cycle skip, or live ladder below venue min, writes `copy.cycle_skipped` once and receipts that cycle’s fills. Drawdown uses follower equity (available plus unrealized) against a stored peak. Adverse-move skip writes a receipt. Idempotency `desk_copy_receipts` plus command key = parent fill id; copied DCA limits keep the parent clip key so Entry # parses. One desk lease. Browser never sees parent keys or recipes. Paper equity starts at 10,000 USDT plus realized and unrealized. |

## Product shape

```
Owner
  Live bound desk → set alias → share private (email) or public (catalogue)
  required setup description

Follower
  invite or catalogue → Copy popup
  same type + venue as parent; Paper or Live (own key)
  chosen book + guards → fills fan out
```

Account nav **Copy desks** (`/account/copy`) is one catalogue: public listings plus the viewer’s open private invites. **Private** badge and a private-only filter. **Favorites** are desk bookmarks. **Subscribed** is desks the viewer is currently following (an active copy desk of that parent). Catalogue never shows email. Parent desks keep **Manage Copy Traders**. Sidebar shows a **Copy** badge on follower desks. Type grouping stays Automated vs Manual. Trader alias opens the trader page (desks visible to the viewer). **View details** opens `/account/copy/desks/[accountId]` — the owner’s closed-book Performance page plus a two-column header (desk left, trader right) and all-time tiles (completed trades, win rate, realized P&L, ROI, followers, invited, max drawdown). That page stays visible if the viewer already follows, even after sharing is later turned off. Listing has a catalogue **Desk name**. Copy is a popup that stamps type/venue from the parent; follower picks Paper or Live, a sizing book, and optional max daily loss, max drawdown %, and max adverse move %. Reduce-only stays in Desk Settings. `/account/copy/desks/new` redirects to the catalogue with the popup open.

## Data shape

- Login trader profile: alias (unique), optional bio, optional logo (PNG/JPG/WebP in Storage)
- Persisted admin `copy_min_activity_days`, `copy_max_followers_default` (pre-fill; also the hard cap when the ceiling is empty), and `copy_max_followers_ceiling` (hard cap; empty uses the default)
- `trading_accounts.copy_of_account_id` (immutable when set)
- Listing: required catalogue **name**, `private` \| `public`, required description, optional `max_followers`, optional `min_balance_usdt`, optional desk logo, `sharing_enabled`, `allow_new_followers`
- `desk_copy_shares` (email / user, invited / active / revoked)
- `desk_copy_favorites` (login bookmarks a parent desk)
- `futures_desk_stats` (all-time + 30d snapshot, including max drawdown)
- Follower settings: unused `scale` (create writes `1`), `size_mode` (`balance` / `percent` / `fixed`) plus `size_percent` or `size_book_usdt`, pause, max daily loss, max drawdown %, max adverse move %, and `equity_peak_usdt` (high-water mark since follow or last resume). `max_open_notional_usdt` is unused (saves clear it). Copy desks do not use desk max value / max open positions. Unfollow deletes the copy desk when it is flat and not the last desk. A private invite stays invited so they can follow again. Owner revoke still revokes. Catalogue follows drop the share row.
- `desk_copy_receipts` for idempotency

RLS: catalogue is public + sharing-on listings, or the viewer’s open private grant, plus alias and that desk’s stats snapshot. Followers never select parent ledgers. The catalogue desk page loads the closed book with the service role and strips rule names, venue order ids, and event logs. Service role for the engine.

## Current micro-step

| # | Step | Who | Done when |
| --- | --- | --- | --- |
| 1 | Docs | Agent | This file is the phase. Master spec and roadmap 3 point here. **In repo 31 Aug 2026.** |
| 2 | Schema + admin knob | Agent | Migration + persisted `copy_min_activity_days` (default 90, min 0) on `/admin/settings`. Checks for the activity floor. **In repo 31 Aug 2026.** Push `develop` to migrate. |
| 3 | Follower desk flag | Agent | `copy_of` immutable. Helpers hide ticket, Automations, webhooks, templates apply, backtest-from-desk. Sidebar **Copy** badge. **In repo 31 Aug 2026.** |
| 4 | Profile + share | Agent | Unique alias. Private or public, required brief. Reject Paper, unbound, C&C, and desks younger than N. **In repo 31 Aug 2026.** |
| 5 | Private grants | Agent | Email invite from **Manage Copy Traders**. Owner list shows email on private, user id on public. Revoke, unlist, and unbind pause new entries. **In repo 31 Aug 2026.** |
| 6 | Catalogue + stats | Agent | One catalogue (public + my private invites). Private badge and filter. Favorites. Subscribed = currently following. Snapshotted desk stats including max drawdown. Trader page (desks visible to the viewer). View details opens the desk performance page. Copy CTA disabled until step 7. **In repo 31 Aug 2026.** |
| 7 | Create copy desk | Agent | Copy popup stamps type/venue. Follower picks Paper or Live, a sizing book, and guards. Stay on the modal unless Go to Copy Desk is ticked. **In repo 31 Aug 2026.** |
| 8 | Follower chrome | Agent | Compact header with Pause and Unfollow. Reduce-only, max daily loss, max drawdown %, max adverse move %. Close All. Position caps parked on copy desks. **In repo 31 Aug 2026.** |
| 9 | Engine fan-out | Agent | Parent fill → resolve follower book → size → guards → `runFuturesCommand` or paper ledger. Fixed book below available pauses. Drawdown flattens and pauses. Adverse move skips the entry and receipts it. Idempotent. Checks for skip/double-place. **In repo 31 Aug 2026.** |
| 10 | Desk test | Click | Set N to 0. Private and public share. Copy from invite and catalogue. Paper follower of a Live parent. Small Live clip. Paper and unbound cannot share. Normal desks untouched. |

## Out of scope

- New `copy_trade` desk type, or `mode = copy`
- Cash and Carry copy
- Copying recipes or bots (limits and fills copy; the parent playbook does not)
- Row-level follower TP/SL
- Payouts / affiliate take-rate
- Membership gates on who may list (roadmap 8)
- MEXC (roadmap 16)
- Reading hedge mode from the bound account (owner-written brief in v1)
