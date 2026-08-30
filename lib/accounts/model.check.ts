import assert from "node:assert/strict";
import {
  accountDeleteBlockers,
  connectionRemoveBlockers,
  DEFAULT_ACCOUNT_NAME,
  formatAccountUsageStatus,
  overviewAttentionItems,
  formatConnectionRemoveBlockers,
  formatDeleteBlockers,
  strategyDetachBlockers,
  formatAccountMode,
  formatAccountModeChoice,
  formatDeskExchangeCaption,
  formatDeskVenueCaption,
  formatDeskNavLabel,
  formatDeskType,
  formatDeskTypeChoice,
  deskHomePath,
  DESK_QUERY,
  parseDeskQuery,
  pathWithDesk,
  withQuery,
  withDeskFrom,
  deskHref,
  deskPath,
  deskIdFromHref,
  deskUsesCashAndCarry,
  deskUsesPerpsUi,
  deskAllowsManualPerpTicket,
  deskAllowsSignalWebhooks,
  deskAllowsOrderWebhooks,
  deskAllowsPerpsRecipes,
  deskManualBuySellBlockReason,
  parseAccountName,
  deskNameTaken,
  validateNewDeskName,
  otherDeskNames,
  parseDeskNameChange,
  DESK_NAME_TAKEN,
  parseAccountMode,
  parseDeskCreateChoice,
  parseDeskType,
  parseDeskTypeChoice,
  parseTradingAccountRow,
  pickDefaultAccount,
  pickSwitchAfterDelete,
} from "./model";

assert.equal(DEFAULT_ACCOUNT_NAME, "Demo Account");

assert.equal(parseAccountMode("live"), "live");
assert.equal(parseAccountMode("paper"), "paper");
assert.equal(parseAccountMode("other"), "paper");
assert.equal(formatDeskVenueCaption({ venue: "bybit", venueEnvironment: null }), "Bybit");
assert.equal(
  formatDeskExchangeCaption(
    { mode: "live", venue: "bybit", venueEnvironment: null },
    false,
  ),
  null,
);
assert.equal(
  formatDeskExchangeCaption(
    { mode: "live", venue: "bybit", venueEnvironment: "demo" },
    true,
  ),
  "Bybit · Demo",
);
assert.equal(
  formatDeskExchangeCaption(
    { mode: "paper", venue: "bybit", venueEnvironment: null },
    false,
  ),
  "Bybit",
);
assert.equal(
  formatDeskVenueCaption({ venue: "hyperliquid", venueEnvironment: "testnet" }),
  "Hyperliquid Testnet (demo)",
);
assert.equal(formatAccountMode("paper"), "Paper Trading");
assert.equal(formatAccountMode("live"), "Connected Exchange");
assert.equal(
  formatAccountModeChoice("paper"),
  "Paper Trading (uses live market data - no real trades)",
);
assert.equal(
  formatAccountModeChoice("live"),
  "Connected Exchange (uses a connected exchange)",
);

const named = parseAccountName("  Book 1  ");
assert.equal(named.ok, true);
if (named.ok) {
  assert.equal(named.name, "Book 1");
}
assert.equal(parseAccountName("").ok, false);
assert.equal(parseAccountName("x".repeat(41)).ok, false);
assert.equal(deskNameTaken("Paper", ["paper", "Live"]), true);
assert.equal(deskNameTaken("  PAPER  ", ["Paper"]), true);
assert.equal(deskNameTaken("New", ["Paper"]), false);
assert.equal(deskNameTaken("", ["Paper"]), false);
const taken = validateNewDeskName("Paper", ["paper"]);
assert.equal(taken.ok, false);
if (!taken.ok) {
  assert.equal(taken.error, DESK_NAME_TAKEN);
}
assert.equal(validateNewDeskName("Fresh", ["Paper"]).ok, true);
assert.deepEqual(
  otherDeskNames(
    [
      { id: "a", name: "DCA" },
      { id: "b", name: "Paper" },
    ],
    "a",
  ),
  ["Paper"],
);
const sameName = parseDeskNameChange("DCA", ["Paper"], "DCA");
assert.equal(sameName.ok, true);
if (sameName.ok) {
  assert.equal(sameName.changed, false);
}
const renamed = parseDeskNameChange("Fresh", ["Paper"], "DCA");
assert.equal(renamed.ok, true);
if (renamed.ok) {
  assert.equal(renamed.changed, true);
  assert.equal(renamed.name, "Fresh");
}
assert.equal(parseDeskNameChange("paper", ["Paper"], "DCA").ok, false);

assert.equal(parseDeskType("perps"), "perps");
assert.equal(parseDeskType("perps_bots"), "perps_bots");
assert.equal(parseDeskType("signal_follower"), "signal_follower");
assert.equal(parseDeskType("dca"), "dca");
assert.equal(parseDeskType("cash_and_carry"), "cash_and_carry");
assert.equal(parseDeskType("other"), "cash_and_carry");
assert.equal(parseDeskTypeChoice("perps").ok, true);
assert.equal(parseDeskTypeChoice("perps_bots").ok, true);
assert.equal(parseDeskTypeChoice("dca").ok, true);
assert.equal(parseDeskTypeChoice("").ok, false);
assert.equal(formatDeskType("perps"), "Perps");
assert.equal(formatDeskType("perps_bots"), "Perps bots");
assert.equal(formatDeskNavLabel("perps_bots"), "Perps");
assert.equal(formatDeskNavLabel("dca"), "DCA");
assert.equal(formatDeskType("signal_follower"), "TradingView Strategy");
assert.equal(formatDeskType("dca"), "DCA");
assert.equal(formatDeskType("cash_and_carry"), "Cash and Carry");
assert.equal(
  formatDeskTypeChoice("perps"),
  "Perps (buy / sell / close from the ticket)",
);
assert.equal(
  formatDeskTypeChoice("perps_bots"),
  "Perps bots (price-cross automations own the orders)",
);
assert.equal(
  formatDeskTypeChoice("signal_follower"),
  "TradingView Strategy (alerts send buy / sell / close)",
);
assert.equal(
  formatDeskTypeChoice("dca"),
  "DCA (app owns orders and exits)",
);
assert.equal(
  deskHomePath("cash_and_carry"),
  "/strategies/cash-and-carry/positions",
);
assert.equal(deskHomePath("perps"), "/strategies/futures/positions");
assert.equal(deskHomePath("perps_bots"), "/strategies/futures/positions");
assert.equal(deskHomePath("signal_follower"), "/strategies/futures/positions");
assert.equal(deskHomePath("dca"), "/strategies/futures/positions");
assert.equal(
  deskHomePath("perps", "11111111-1111-4111-8111-111111111111"),
  "/strategies/futures/positions?desk=11111111-1111-4111-8111-111111111111",
);
assert.equal(
  parseDeskQuery("11111111-1111-4111-8111-111111111111"),
  "11111111-1111-4111-8111-111111111111",
);
assert.equal(parseDeskQuery("not-a-desk"), null);
assert.equal(DESK_QUERY, "desk");
assert.equal(
  pathWithDesk("/strategies/futures/positions", "11111111-1111-4111-8111-111111111111"),
  "/strategies/futures/positions?desk=11111111-1111-4111-8111-111111111111",
);
assert.equal(
  withQuery("/strategies/futures/positions?desk=11111111-1111-4111-8111-111111111111", {
    paperError: "boom",
  }),
  "/strategies/futures/positions?desk=11111111-1111-4111-8111-111111111111&paperError=boom",
);
assert.equal(
  deskIdFromHref("/strategies/futures/positions?desk=11111111-1111-4111-8111-111111111111"),
  "11111111-1111-4111-8111-111111111111",
);
assert.equal(
  withDeskFrom(
    "/strategies/futures/positions",
    "/strategies/futures?desk=11111111-1111-4111-8111-111111111111",
  ),
  "/strategies/futures/positions?desk=11111111-1111-4111-8111-111111111111",
);
assert.equal(
  deskHref("/strategies/futures", "11111111-1111-4111-8111-111111111111"),
  "/strategies/futures?desk=11111111-1111-4111-8111-111111111111",
);
assert.equal(deskHref("/strategies/futures", null), "/strategies/futures");
assert.equal(
  deskPath("/strategies/futures/automations", "11111111-1111-4111-8111-111111111111", {
    saved: "1",
  }),
  "/strategies/futures/automations?desk=11111111-1111-4111-8111-111111111111&saved=1",
);
assert.equal(deskUsesCashAndCarry("cash_and_carry"), true);
assert.equal(deskUsesCashAndCarry("perps"), false);
assert.equal(deskUsesPerpsUi("perps"), true);
assert.equal(deskUsesPerpsUi("perps_bots"), true);
assert.equal(deskUsesPerpsUi("signal_follower"), true);
assert.equal(deskUsesPerpsUi("dca"), true);
assert.equal(deskUsesPerpsUi("cash_and_carry"), false);
assert.equal(deskAllowsManualPerpTicket("perps"), true);
assert.equal(deskAllowsManualPerpTicket("perps_bots"), false);
assert.equal(deskAllowsManualPerpTicket("signal_follower"), false);
assert.equal(deskAllowsManualPerpTicket("dca"), false);
assert.equal(deskAllowsManualPerpTicket("cash_and_carry"), false);
assert.equal(deskAllowsPerpsRecipes("perps"), false);
assert.equal(deskAllowsPerpsRecipes("perps_bots"), true);
assert.equal(deskAllowsPerpsRecipes("dca"), false);
assert.equal(deskAllowsSignalWebhooks("perps"), false);
assert.equal(deskAllowsSignalWebhooks("perps_bots"), true);
assert.equal(deskAllowsSignalWebhooks("dca"), true);
assert.equal(deskAllowsSignalWebhooks("signal_follower"), false);
assert.equal(deskAllowsSignalWebhooks("cash_and_carry"), false);
assert.equal(deskAllowsOrderWebhooks("perps"), false);
assert.equal(deskAllowsOrderWebhooks("perps_bots"), false);
assert.equal(deskAllowsOrderWebhooks("signal_follower"), true);
assert.equal(deskAllowsOrderWebhooks("dca"), false);
assert.equal(deskManualBuySellBlockReason("perps"), null);
assert.equal(
  deskManualBuySellBlockReason("perps_bots"),
  "This is a Perps bots desk. Automations own orders. Buy and Sell are not on this ticket.",
);
assert.equal(
  deskManualBuySellBlockReason("dca"),
  "This is a DCA desk. The bot owns orders. Buy and Sell are not on this ticket.",
);
assert.equal(
  deskManualBuySellBlockReason("signal_follower"),
  "This is a TradingView Strategy desk. Buy and Sell come from a webhook.",
);

const paper = parseTradingAccountRow({
  id: "acc-1",
  user_id: "user-1",
  name: DEFAULT_ACCOUNT_NAME,
  mode: "paper",
  desk_type: "cash_and_carry",
  created_at: "2026-08-23T00:00:00.000Z",
});
assert.equal(paper.deskType, "cash_and_carry");
assert.equal(paper.venue, "bybit");
assert.equal(paper.venueEnvironment, null);
const live = parseTradingAccountRow({
  id: "acc-2",
  user_id: "user-1",
  name: "Live",
  mode: "live",
  desk_type: "perps",
  venue: "hyperliquid",
  venue_environment: "demo",
  created_at: "2026-08-23T01:00:00.000Z",
});
assert.equal(live.deskType, "perps");
assert.equal(live.venue, "hyperliquid");
assert.equal(live.venueEnvironment, "testnet");

const bybitCreate = parseDeskCreateChoice({
  deskType: "perps",
  venue: "bybit",
  mode: "live",
  track: "testnet",
});
assert.equal(bybitCreate.ok, true);
if (bybitCreate.ok) {
  assert.equal(bybitCreate.value.mode, "live");
  assert.equal(bybitCreate.value.venueEnvironment, null);
}
const hlPaper = parseDeskCreateChoice({
  deskType: "dca",
  venue: "hyperliquid",
  mode: "paper",
  track: "live",
});
assert.equal(hlPaper.ok, true);
if (hlPaper.ok) {
  assert.equal(hlPaper.value.mode, "paper");
  assert.equal(hlPaper.value.venueEnvironment, null);
}
const hlDemo = parseDeskCreateChoice({
  deskType: "dca",
  venue: "hyperliquid",
  mode: "live",
  track: "",
});
assert.equal(hlDemo.ok, true);
if (hlDemo.ok) {
  assert.equal(hlDemo.value.mode, "live");
  assert.equal(hlDemo.value.venueEnvironment, "testnet");
}
assert.equal(
  parseDeskCreateChoice({
    deskType: "cash_and_carry",
    venue: "hyperliquid",
    mode: "paper",
    track: "paper",
  }).ok,
  false,
);
assert.equal(pickDefaultAccount([live, paper])?.id, "acc-1");
assert.equal(pickDefaultAccount([live])?.id, "acc-2");
assert.equal(pickDefaultAccount([]), null);
assert.equal(pickSwitchAfterDelete([live, paper], "acc-2")?.id, "acc-2");
assert.equal(pickSwitchAfterDelete([live, paper], "")?.id, "acc-1");
assert.equal(pickSwitchAfterDelete([], "acc-1"), null);

assert.deepEqual(
  accountDeleteBlockers({
    accountCount: 1,
    openCount: 2,
    automationsRunning: true,
    mode: "paper",
  }),
  ["last", "open", "automations"],
);
assert.deepEqual(
  accountDeleteBlockers({
    accountCount: 2,
    openCount: 2,
    automationsRunning: true,
    mode: "paper",
  }),
  ["open", "automations"],
);
assert.deepEqual(
  accountDeleteBlockers({
    accountCount: 2,
    openCount: 1,
    automationsRunning: true,
    mode: "live",
  }),
  ["open", "automations"],
);
assert.deepEqual(
  accountDeleteBlockers({
    accountCount: 2,
    openCount: 0,
    automationsRunning: false,
    mode: "live",
  }),
  [],
);
assert.equal(
  formatDeleteBlockers(["last", "open"]),
  "Keep at least one desk · Exit all positions first",
);
assert.equal(
  formatDeleteBlockers(["open", "automations"]),
  "Disable bots and exit all positions first",
);
assert.equal(
  formatDeleteBlockers(["automations"]),
  "Disable bots first",
);
assert.deepEqual(
  connectionRemoveBlockers({ inUse: false }),
  [],
);
assert.deepEqual(
  connectionRemoveBlockers({ inUse: true }),
  ["in_use"],
);
assert.equal(
  formatConnectionRemoveBlockers(["in_use"]),
  "Detach this key from every desk in Desk Settings first",
);
assert.deepEqual(
  strategyDetachBlockers({ openCount: 0, automationsRunning: false }),
  [],
);
assert.deepEqual(
  strategyDetachBlockers({ openCount: 1, automationsRunning: true }),
  ["open", "automations"],
);
assert.equal(
  formatDeleteBlockers(strategyDetachBlockers({ openCount: 1, automationsRunning: true })),
  "Disable bots and exit all positions first",
);

assert.equal(
  formatAccountUsageStatus({ openCount: 2, automationsRunning: true }),
  "2 Open positions - Bots on",
);
assert.equal(
  formatAccountUsageStatus({ openCount: 1, automationsRunning: false }),
  "1 Open position",
);
assert.equal(
  formatAccountUsageStatus({
    openCount: 1,
    workingCount: 2,
    automationsRunning: true,
  }),
  "1 Open position - 2 Open orders - Bots on",
);
assert.equal(
  formatAccountUsageStatus({
    openCount: 0,
    workingCount: 1,
    automationsRunning: false,
  }),
  "1 Open order",
);

assert.deepEqual(
  overviewAttentionItems({
    accounts: [
      { id: "p", name: "Paper", mode: "paper" },
      { id: "a", name: "Live A", mode: "live", venue: "bybit" },
    ],
    binds: [],
  }),
  [
    {
      label: "Live A is a live Bybit desk with no key bound.",
      href: "/account/exchanges",
    },
  ],
);
assert.deepEqual(
  overviewAttentionItems({
    accounts: [
      { id: "a", name: "Live A", mode: "live", venue: "bybit" },
      { id: "b", name: "Live B", mode: "live", venue: "hyperliquid" },
    ],
    binds: [{ connectionId: "k1", accountId: "a" }],
  }),
  [
    {
      label: "Live B is a live Hyperliquid desk with no key bound.",
      href: "/account/exchanges",
    },
  ],
);
assert.deepEqual(
  overviewAttentionItems({
    accounts: [
      { id: "a", name: "Live A", mode: "live" },
      { id: "b", name: "Live B", mode: "live" },
    ],
    binds: [],
  }),
  [
    {
      label: "2 live desks have no key bound.",
      href: "/account/sub-accounts",
    },
  ],
);
assert.deepEqual(
  overviewAttentionItems({
    accounts: [
      { id: "a", name: "Live A", mode: "live" },
      { id: "b", name: "Live B", mode: "live" },
    ],
    binds: [
      { connectionId: "k1", accountId: "a" },
      { connectionId: "k1", accountId: "b" },
    ],
  }),
  [
    {
      label: "One exchange key is bound to more than one desk.",
      href: "/account/exchanges",
    },
  ],
);
assert.deepEqual(
  overviewAttentionItems({
    accounts: [{ id: "a", name: "Live A", mode: "live" }],
    binds: [{ connectionId: "k1", accountId: "a" }],
  }),
  [],
);

console.log("account model checks passed");
