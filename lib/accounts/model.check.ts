import assert from "node:assert/strict";
import {
  accountDeleteBlockers,
  connectionRemoveBlockers,
  DEFAULT_ACCOUNT_NAME,
  formatAccountUsageStatus,
  formatConnectionRemoveBlockers,
  formatDeleteBlockers,
  strategyDetachBlockers,
  formatAccountMode,
  formatAccountModeChoice,
  formatDeskType,
  formatDeskTypeChoice,
  deskHomePath,
  deskUsesCashAndCarry,
  deskUsesPerpsUi,
  deskAllowsManualPerpTicket,
  deskAllowsSignalWebhooks,
  parseAccountName,
  parseAccountMode,
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

assert.equal(parseDeskType("perps"), "perps");
assert.equal(parseDeskType("signal_follower"), "signal_follower");
assert.equal(parseDeskType("cash_and_carry"), "cash_and_carry");
assert.equal(parseDeskType("other"), "cash_and_carry");
assert.equal(parseDeskTypeChoice("perps").ok, true);
assert.equal(parseDeskTypeChoice("").ok, false);
assert.equal(formatDeskType("perps"), "Perps");
assert.equal(formatDeskType("signal_follower"), "TradingView Strategy");
assert.equal(formatDeskType("cash_and_carry"), "Cash and Carry");
assert.equal(
  formatDeskTypeChoice("perps"),
  "Perps (buy / sell / close one USDT perpetual)",
);
assert.equal(
  formatDeskTypeChoice("signal_follower"),
  "TradingView Strategy (alerts send buy / sell / close)",
);
assert.equal(
  deskHomePath("cash_and_carry"),
  "/strategies/cash-and-carry",
);
assert.equal(deskHomePath("perps"), "/strategies/futures");
assert.equal(deskHomePath("signal_follower"), "/strategies/futures");
assert.equal(deskUsesCashAndCarry("cash_and_carry"), true);
assert.equal(deskUsesCashAndCarry("perps"), false);
assert.equal(deskUsesPerpsUi("perps"), true);
assert.equal(deskUsesPerpsUi("signal_follower"), true);
assert.equal(deskUsesPerpsUi("cash_and_carry"), false);
assert.equal(deskAllowsManualPerpTicket("perps"), true);
assert.equal(deskAllowsManualPerpTicket("signal_follower"), false);
assert.equal(deskAllowsManualPerpTicket("cash_and_carry"), false);
assert.equal(deskAllowsSignalWebhooks("perps"), true);
assert.equal(deskAllowsSignalWebhooks("signal_follower"), false);
assert.equal(deskAllowsSignalWebhooks("cash_and_carry"), false);

const paper = parseTradingAccountRow({
  id: "acc-1",
  user_id: "user-1",
  name: DEFAULT_ACCOUNT_NAME,
  mode: "paper",
  desk_type: "cash_and_carry",
  created_at: "2026-08-23T00:00:00.000Z",
});
assert.equal(paper.deskType, "cash_and_carry");
const live = parseTradingAccountRow({
  id: "acc-2",
  user_id: "user-1",
  name: "Live",
  mode: "live",
  desk_type: "perps",
  created_at: "2026-08-23T01:00:00.000Z",
});
assert.equal(live.deskType, "perps");
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
  "Disable automations and exit all positions first",
);
assert.equal(
  formatDeleteBlockers(["automations"]),
  "Disable automations first",
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
  "Disable automations and exit all positions first",
);

assert.equal(
  formatAccountUsageStatus({ openCount: 2, automationsRunning: true }),
  "2 Open positions - Automations on",
);
assert.equal(
  formatAccountUsageStatus({ openCount: 1, automationsRunning: false }),
  "1 Open position",
);

console.log("account model checks passed");
