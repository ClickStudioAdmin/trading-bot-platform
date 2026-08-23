import assert from "node:assert/strict";
import { eventLogOptionsForScopes } from "./events";
import { parseEventLogFilters } from "./filters";
import {
  attachLogs,
  carryIdFromLogData,
  logsForCarry,
  type EventLogRow,
} from "./list";

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
assert.equal(empty.account, "");
assert.equal(
  parseEventLogFilters({ account: "acc-1" }).account,
  "acc-1",
);
assert.ok(eventLogOptionsForScopes(["trade"]).includes("trade.opened"));
assert.equal(
  eventLogOptionsForScopes(["trade"]).includes("member.created"),
  false,
);
assert.ok(
  eventLogOptionsForScopes(["trade"], "legacy.event").includes("legacy.event"),
);

assert.equal(carryIdFromLogData({ carryId: 12 }), 12);
assert.equal(carryIdFromLogData({ carryId: "12" }), 12);
assert.equal(carryIdFromLogData({}), null);

const sample = (id: number, carryId: unknown, createdAt: string): EventLogRow => ({
  id,
  createdAt,
  level: "info",
  scope: "trade",
  event: "trade.opened",
  message: "Opened paper BTCUSDT",
  userId: "user-1",
  accountId: "acc-1",
  strategy: "cash-and-carry",
  data: { carryId },
});

const grouped = logsForCarry(
  [
    sample(3, 7, "2026-08-23T08:00:00.000Z"),
    sample(1, 7, "2026-08-23T06:00:00.000Z"),
    sample(2, 8, "2026-08-23T07:00:00.000Z"),
  ],
  7,
);
assert.deepEqual(
  grouped.map((row) => row.id),
  [3, 1],
);

const attached = attachLogs([{ id: 7 }, { id: 9 }], grouped);
assert.equal(attached[0]?.logs.length, 2);
assert.equal(attached[1]?.logs.length, 0);

console.log("event log list checks passed");
