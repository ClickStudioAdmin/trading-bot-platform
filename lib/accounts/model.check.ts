import assert from "node:assert/strict";
import {
  parseAccountName,
  parseAccountMode,
  parseTradingAccountRow,
  pickDefaultAccount,
} from "./model";

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
  name: "Paper",
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

console.log("account model checks passed");
