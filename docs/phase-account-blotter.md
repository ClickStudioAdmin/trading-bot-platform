# Account Positions, Bots, and Automations lists

**V1 item 4** ([roadmap.md](roadmap.md)). Locked 19 Sep 2026. **Current.** Started 21 Sep 2026 with desk Automations lists. Do not start account-wide Positions / Bots until Click asks.

Reference: 3Commas-style **bot list** (table + filters + Create + row actions), not a wall of edit forms. Same Theme table chrome as other data types ([ui-theme.md](ui-theme.md)).

## Status

Isolation (one connection per desk, one venue account per login + venue + environment) shipped 19 Sep 2026 during item 3 — do not rebuild it here. Item 3 is accepted. **Started:** desk Automations is a bot table + Create / View/Edit form (`?edit=`). Account-wide Positions and Bots wait until Click asks.

## Purpose

Three product problems, one item:

1. **Fragmentation.** Typed desks are still one type, one bind, one UI. Users should not have to hunt desks to see what is open or which bots exist. Add **account-wide Positions** and **account-wide Bots**.
2. **Automations as a directory.** Desk Automations (DCA, Perps bots, Cash and Carry) is a **table of bots** with actions. One action is **Edit**, which opens the existing bot form. **Create New Bot** sits on the right with Columns, like other page actions. Stop showing every recipe as a live edit card on first load.
3. **One live desk per exchange connection.** TBP has no deal ledger. Two desks on one key share one venue position, one margin pool, and symbol cancel-all. Create, bind, and rebind must reject a connection that is already bound to another desk. Virtual lots stay parked.

This is **not** mixed strategies on one desk, **not** virtual lots, and **not** two bots on the same pair. Those stay parked ([click-list.md](click-list.md) item 4, V2 multi-pair / virtual-size).

## Done when

1. Account sidenav has **Positions** and **Bots** (login-wide, every desk the member owns). Filters for desk, type, mode, pair, status. Theme table + Columns. A row opens that desk (`?desk=`) on the matching Positions or Automations page. No account-wide Close All — panic stays on the desk.
2. Desk **Automations (bots)** for DCA, Perps bots, and Cash and Carry is a Theme table: pair, name, side / recipe, positions, performance, status, and actions (Edit, Clone, Remove). DCA and Perps pair cells show the coin logo and name, with the contract under them. The side sits in Side / Recipe, above the short recipe summary. Long and Buy are green; Short and Sell are red. Cash and Carry stays the word Carry, with no logo and no side, because that bot is not locked to one pair. The first column expands that bot’s saved configuration (entry, sizing, and exits, including settings that are off). Sortable columns, 20-per-page paging, and filters for name, pair, and status (Active / Disabled, plus that desk’s extra mode), same chrome as other Theme tables. Show Filters sits on the right actions group after Columns. Hide Filters sits on the filter bar next to Clear. Remove is a list action, not on the edit form. It is blocked when a DCA bot is running or a Perps / C&C bot has an open position. The name is a link to View/Edit (`?edit=`). Positions (open count) and Performance (ROE) sit left of Status. Status sits left of Actions; each value has an icon to that desk page with `bot` set. Those icons also mark the visit as coming from the bot list: Back sits before the page title, and the title keeps the bot name (Current Positions - {name}, Desk Statistics - {name}) until the data-set dropdown picks a different set. Back from Edit, Positions, or Performance restores that desk’s Automations filters, sort, page, and scroll. Performance is only that bot’s own closed rows (`rule_id`), not leftover trades from a deleted bot that shared the pair or name. **Create New Bot** (and Create from Template when that desk already has it) sit on the right actions group, left of **Columns**. Clone is a row action. Empty state keeps the table headers; the message sits in one spanning row. Desk **Positions** and **Performance** filter by bot (and pair / side) so a member can see one bot’s rows and stats. Past Positions has the same Columns picker. Position logs on a closed row load by that position’s id so they do not fall off the recent event-log window. A top-right data-set dropdown and the table Bot field share `bot`. Empty bot is Desk Wide (all bots). The table filter bar stays hidden until Show Filters — changing the data-set dropdown does not open it. Close All stays desk-wide.
3. **Edit** (and Create) uses the current bot form chrome (`bot-form-chrome`, Theme → Bot form). After save, return to the list. Deep links (`#bot-…` / query) still open that bot’s form.
4. Manual Perps, TradingView Strategy, and copy desks stay as they are (no recipe list). Their **positions** still appear on the account Positions table.
5. No new ledger tables. Same `futures_*` / `paper_*` / playbook rows. One playbook per contract and one open perp row per symbol + side stay.
6. **One key, one desk — in repo 19 Sep 2026 (during UI refinement).** Create / bind / rebind reject a connection already on another desk (names that desk). Pickers hide those keys. Paper stays unbound. Existing shared binds are not auto-unbound. Unique bind is app-enforced on every bind path (`applyDeskBindRules`). A later unique index is optional.
7. **One venue account per login + venue + environment — in repo 19 Sep 2026.** Check / Save / Replace store `venue_account_id` (Bybit `userID`, Hyperliquid account address) and reject a second key on the same account. Existing connections stay null until re-verified. No auto-unbind.

Stop. Do not start entitlements, onboarding, virtual positions, or mixed desk types.

## How it works

- **Account Positions** — `/account/positions`. Every open (and pending-close) row across desks. Columns include desk name, type, mode, pair / side, size, and the same PnL / status the desk blotter already shows. Filter, then jump to the desk blotter for Close / Chart / row actions that mutate.
- **Account Bots** — `/account/bots`. Every C&C layer, Perps bots rule, and DCA playbook. Columns include desk, type, pair, status (Active / Disabled / that desk’s extra mode), and a one-line recipe summary. Edit / create still happen on the desk Automations route so bind, caps, and type lock stay correct.
- **Desk Automations** — list first. Same data as today; the form is a second step, not the page. The list filters by name, pair, and status on DCA, Perps bots, and Cash and Carry.
- **3Commas** is the list pattern (directory + Active + actions), not a column-for-column copy. TBP tokens, Lucide actions, and Theme tables.
- **One key, one desk.** Isolation is another trade-only key on a different venue account, not another desk on the same connection. Check / Save / Replace reject a second key that hits the same Bybit UID or Hyperliquid wallet. Same-pair stacking later needs virtual lots (V2). Until then, do not share a bind.

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
