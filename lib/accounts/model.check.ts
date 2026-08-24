import assert from "node:assert/strict";
import {
  accountDeleteBlockers,
  connectionRemoveBlockers,
  DEFAULT_ACCOUNT_NAME,
  formatConnectionRemoveBlockers,
  formatDeleteBlockers,
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
  ["last"],
);
assert.deepEqual(
  accountDeleteBlockers({
    accountCount: 2,
    openCount: 2,
    automationsRunning: true,
    mode: "paper",
  }),
  [],
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
  "Keep at least one account · Close or flatten open positions first",
);
assert.deepEqual(
  connectionRemoveBlockers({ openCount: 0, automationsRunning: false }),
  [],
);
assert.deepEqual(
  connectionRemoveBlockers({ openCount: 2, automationsRunning: false }),
  ["open"],
);
assert.deepEqual(
  connectionRemoveBlockers({ openCount: 0, automationsRunning: true }),
  ["automations"],
);
assert.deepEqual(
  connectionRemoveBlockers({ openCount: 1, automationsRunning: true }),
  ["open", "automations"],
);
assert.equal(
  formatConnectionRemoveBlockers(["open", "automations"]),
  "Close or flatten open positions first · Turn off automations first",
);

console.log("account model checks passed");
