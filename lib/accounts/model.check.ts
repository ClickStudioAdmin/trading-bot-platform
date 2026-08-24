import assert from "node:assert/strict";
import {
  accountDeleteBlockers,
  connectionRemoveBlockers,
  DEFAULT_ACCOUNT_NAME,
  formatAccountUsageStatus,
  formatConnectionRemoveBlockers,
  formatDeleteBlockers,
  strategyDetachBlockers,
  parseAccountName,
  parseAccountMode,
  parseTradingAccountRow,
  pickDefaultAccount,
} from "./model";

assert.equal(DEFAULT_ACCOUNT_NAME, "Demo Account");

assert.equal(parseAccountMode("live"), "live");
assert.equal(parseAccountMode("paper"), "paper");
assert.equal(parseAccountMode("other"), "paper");

const named = parseAccountName("  Book 1  ");
assert.equal(named.ok, true);
if (named.ok) {
  assert.equal(named.name, "Book 1");
}
assert.equal(parseAccountName("").ok, false);
assert.equal(parseAccountName("x".repeat(41)).ok, false);

const paper = parseTradingAccountRow({
  id: "acc-1",
  user_id: "user-1",
  name: DEFAULT_ACCOUNT_NAME,
  mode: "paper",
  created_at: "2026-08-23T00:00:00.000Z",
});
const live = parseTradingAccountRow({
  id: "acc-2",
  user_id: "user-1",
  name: "Live",
  mode: "live",
  created_at: "2026-08-23T01:00:00.000Z",
});
assert.equal(pickDefaultAccount([live, paper])?.id, "acc-1");
assert.equal(pickDefaultAccount([live])?.id, "acc-2");
assert.equal(pickDefaultAccount([]), null);

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
  "Keep at least one account · Exit all positions first",
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
  "Detach this connection from Cash and Carry first",
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
