import assert from "node:assert/strict";
import { eventLogOptionsForScopes } from "./events";
import { parseEventLogFilters } from "./filters";
import {
  attachLogs,
  attachPositionLogs,
  carryIdFromLogData,
  logsForCarry,
  positionIdFromLogData,
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
assert.ok(eventLogOptionsForScopes(["trade"]).includes("dca.decision"));
assert.ok(eventLogOptionsForScopes(["trade"]).includes("engine.fired"));
assert.ok(eventLogOptionsForScopes(["strategy"]).includes("template.shared"));
assert.ok(eventLogOptionsForScopes(["strategy"]).includes("template.imported"));
assert.ok(
  eventLogOptionsForScopes(["system"]).includes("exchange.verify_failed"),
);
assert.ok(
  eventLogOptionsForScopes(["system"]).includes("copy.profile_saved"),
);
assert.ok(
  eventLogOptionsForScopes(["system"]).includes("copy.listing_saved"),
);
assert.ok(
  eventLogOptionsForScopes(["system"]).includes("copy.invite_sent"),
);
assert.ok(
  eventLogOptionsForScopes(["system"]).includes("copy.invite_revoked"),
);
assert.ok(
  eventLogOptionsForScopes(["system"]).includes("copy.favorite_toggled"),
);
assert.ok(
  eventLogOptionsForScopes(["system"]).includes("copy.desk_created"),
);
assert.ok(eventLogOptionsForScopes(["trade"]).includes("copy.copied"));
assert.ok(eventLogOptionsForScopes(["trade"]).includes("copy.cycle_skipped"));
assert.ok(eventLogOptionsForScopes(["trade"]).includes("copy.limit_copied"));
assert.ok(eventLogOptionsForScopes(["trade"]).includes("copy.followed"));
assert.ok(eventLogOptionsForScopes(["trade"]).includes("copy.resumed"));
assert.ok(eventLogOptionsForScopes(["trade"]).includes("copy.breach_flattened"));
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

assert.equal(positionIdFromLogData({ positionId: "pos-1" }), "pos-1");
assert.equal(positionIdFromLogData({}), null);
const byPosition = attachPositionLogs(
  [{ id: "pos-1" }, { id: "pos-2" }],
  [
    {
      ...sample(10, 7, "2026-08-23T08:00:00.000Z"),
      data: { positionId: "pos-1" },
    },
  ],
);
assert.equal(byPosition[0]?.logs.length, 1);
assert.equal(byPosition[1]?.logs.length, 0);

const fallback = attachPositionLogs(
  [
    {
      id: "pos-doge",
      symbol: "DOGEUSDT",
      side: "long",
      ruleId: "pb-1",
      ruleName: "DCA Test - SOL",
      openedAtMs: Date.parse("2026-08-28T02:00:00.000Z"),
      closedAtMs: Date.parse("2026-08-28T02:00:05.000Z"),
    },
  ],
  [
    {
      ...sample(11, 7, "2026-08-28T02:00:01.000Z"),
      event: "dca.decision",
      data: {
        playbookId: "pb-1",
        ruleName: "DCA Test - SOL",
        symbol: "DOGEUSDT",
        side: "long",
      },
    },
    {
      ...sample(12, 7, "2026-08-28T03:00:00.000Z"),
      event: "dca.decision",
      data: {
        playbookId: "pb-1",
        ruleName: "DCA Test - SOL",
        symbol: "DOGEUSDT",
        side: "long",
      },
    },
    {
      ...sample(13, 7, "2026-08-28T02:00:02.000Z"),
      event: "dca.decision",
      data: {
        playbookId: "other",
        ruleName: "Other",
        symbol: "DOGEUSDT",
        side: "long",
      },
    },
  ],
);
assert.deepEqual(
  fallback[0]?.logs.map((row) => row.id),
  [11],
);

console.log("event log list checks passed");
