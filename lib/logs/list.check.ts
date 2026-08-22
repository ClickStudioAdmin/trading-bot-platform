import assert from "node:assert/strict";
import { parseEventLogFilters } from "./filters";

const parsed = parseEventLogFilters({
  scope: "trade",
  level: ["error", "info"],
  event: "trade.opened",
});
assert.equal(parsed.scope, "trade");
assert.equal(parsed.level, "error");
assert.equal(parsed.event, "trade.opened");

const empty = parseEventLogFilters({});
assert.equal(empty.scope, "");
assert.equal(empty.level, "");
assert.equal(empty.event, "");

console.log("event log list checks passed");
