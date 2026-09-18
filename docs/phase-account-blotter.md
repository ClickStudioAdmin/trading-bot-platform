# Account Positions, Bots, and Automations lists

**V1 item 4** ([roadmap.md](roadmap.md)). Locked 19 Sep 2026. Not the current phase. Do not implement until UI refinement (item 3) is accepted and Click says go.

Reference: 3Commas-style **bot list** (table + filters + Create + row actions), not a wall of edit forms. Same Theme table chrome as other data types ([ui-theme.md](ui-theme.md)).

## Status

Spec only. Current work stays UI refinement (V1 item 3).

## Purpose

Three product problems, one item:

1. **Fragmentation.** Typed desks are still one type, one bind, one UI. Users should not have to hunt desks to see what is open or which bots exist. Add **account-wide Positions** and **account-wide Bots**.
2. **Automations as a directory.** Desk Automations (DCA, Perps bots, Cash and Carry) is a **table of bots** with actions. One action is **Edit**, which opens the existing bot form. **Create New Bot** sits on the toolbar like other create actions. Stop showing every recipe as a live edit card on first load.
3. **One live desk per exchange connection.** TBP has no deal ledger. Two desks on one key share one venue position, one margin pool, and symbol cancel-all. Create, bind, and rebind must reject a connection that is already bound to another desk. Virtual lots stay parked.

This is **not** mixed strategies on one desk, **not** virtual lots, and **not** two bots on the same pair. Those stay parked ([click-list.md](click-list.md) item 4, V2 multi-pair / virtual-size).

## Done when

1. Account sidenav has **Positions** and **Bots** (login-wide, every desk the member owns). Filters for desk, type, mode, pair, status. Theme table + Columns. A row opens that desk (`?desk=`) on the matching Positions or Automations page. No account-wide Close All — panic stays on the desk.
2. Desk **Automations (bots)** for DCA, Perps bots, and Cash and Carry is a Theme table: name, pair / side, status, a short recipe summary, and actions (Edit, plus today’s Disable / Close / Clone / Remove where that desk already has them). Toolbar: **Create New Bot** (and Create from Template / Clone when that desk already has them). Empty state uses the same create control.
3. **Edit** (and Create) uses the current bot form chrome (`bot-form-chrome`, Theme → Bot form). After save, return to the list. Deep links (`#bot-…` / query) still open that bot’s form.
4. Manual Perps, TradingView Strategy, and copy desks stay as they are (no recipe list). Their **positions** still appear on the account Positions table.
5. No new ledger tables. Same `futures_*` / `paper_*` / playbook rows. One playbook per contract and one open perp row per symbol + side stay.
6. **One key, one desk — in repo 19 Sep 2026 (during UI refinement).** Create / bind / rebind reject a connection already on another desk (names that desk). Pickers hide those keys. Paper stays unbound. Existing shared binds are not auto-unbound. Unique bind is app-enforced on every bind path (`applyDeskBindRules`). A later unique index is optional.

Stop. Do not start entitlements, onboarding, virtual positions, or mixed desk types.

## How it works

- **Account Positions** — `/account/positions`. Every open (and pending-close) row across desks. Columns include desk name, type, mode, pair / side, size, and the same PnL / status the desk blotter already shows. Filter, then jump to the desk blotter for Close / Chart / row actions that mutate.
- **Account Bots** — `/account/bots`. Every C&C layer, Perps bots rule, and DCA playbook. Columns include desk, type, pair, status (Active / Disabled / that desk’s extra mode), and a one-line recipe summary. Edit / create still happen on the desk Automations route so bind, caps, and type lock stay correct.
- **Desk Automations** — list first. Same data as today; the form is a second step, not the page.
- **3Commas** is the list pattern (directory + Active + actions), not a column-for-column copy. TBP tokens, Lucide actions, and Theme tables.
- **One key, one desk.** Isolation is another trade-only key, not another desk on the same connection. Same-pair stacking later needs virtual lots (V2). Until then, do not share a bind.

## Out of scope

- Virtual positions / two bots on one pair / multi-pair one bot
- Mixing desk types or putting a ticket on a DCA desk
- Account-wide Close All or Disable all
- Sharing one exchange connection across desks (this item **ends** that)
- Auto-unbinding or flattening desks that already share a key
- New engine behaviour, copy rules, or entitlements
- TradingView Strategy recipe table (there is no recipe)

## After this

V1 item 5 is entitlements / plan gates ([phase-entitlements.md](phase-entitlements.md)). Then onboarding (item 6).
