import assert from "node:assert/strict";
import type { ExitStackRow } from "@/components/exit-condition-stack";
import {
  classicSignature,
  customStackFromClauses,
  exitClauseListMissing,
  exitClausesFromSaved,
  mergedClassicExitFlags,
  syncClassicClauses,
} from "./exit-clauses";

const price: ExitStackRow = {
  key: "price",
  join: "and",
  draft: { trigger: "price", triggerBy: "last", compare: "lte", price: "90" },
};
const webhook: ExitStackRow = {
  key: "hook",
  join: "or",
  draft: { trigger: "webhook", webhookId: "sample" },
};

const clauses = exitClausesFromSaved({
  takeProfit: true,
  trailing: false,
  stopLoss: true,
  anchor: { trigger: "indicator", spec: null },
  rows: [price, webhook],
});

assert.deepEqual(
  clauses.map((clause) => clause.kind),
  ["take_profit", "stop_loss", "custom"],
);
assert.equal(clauses[2]?.rows.length, 1);
assert.equal(clauses[2]?.rows[0]?.join, "and");
assert.equal(clauses[2]?.orGroups[0]?.anchor.trigger, "webhook");
assert.equal(clauses[2]?.orGroups[0]?.rows.length, 0);

const flat = customStackFromClauses(clauses);
assert.equal(flat.anchor?.trigger, "indicator");
assert.equal(flat.rows.length, 2);
assert.equal(flat.rows[0]?.join, "and");
assert.equal(flat.rows[0]?.draft.trigger, "price");
assert.equal(flat.rows[1]?.join, "or");
assert.equal(flat.rows[1]?.draft.trigger, "webhook");

const again = exitClausesFromSaved({
  takeProfit: true,
  trailing: false,
  stopLoss: true,
  anchor: flat.anchor,
  rows: flat.rows,
});
assert.deepEqual(
  again.map((clause) => clause.kind),
  ["take_profit", "stop_loss", "custom"],
);

const empty = exitClausesFromSaved({
  takeProfit: false,
  trailing: false,
  stopLoss: false,
  anchor: null,
  rows: [],
});
assert.deepEqual(
  empty.map((clause) => clause.kind),
  [""],
);

const synced = syncClassicClauses(
  [
    {
      key: "keep",
      kind: "custom",
      anchor: { trigger: "unset" },
      rows: [],
      orGroups: [],
      scope: { kind: "all" },
      ownPct: null,
      ownDistance: null,
    },
  ],
  clauses,
);
assert.deepEqual(
  synced.map((clause) => clause.kind),
  ["take_profit", "stop_loss", "custom"],
);
assert.equal(synced[2]?.key, "keep");
assert.equal(classicSignature(synced), "take_profit|stop_loss");

const merged = mergedClassicExitFlags(clauses, empty);
assert.equal(merged.takeProfit, true);
assert.equal(merged.trailing, false);
assert.equal(merged.stopLoss, true);
const onlyShort = mergedClassicExitFlags(empty, clauses);
assert.equal(onlyShort.takeProfit, true);
assert.equal(onlyShort.stopLoss, true);
const primaryOnly = mergedClassicExitFlags(empty, null);
assert.equal(primaryOnly.takeProfit, false);
assert.equal(primaryOnly.stopLoss, false);
assert.equal(exitClauseListMissing(empty), false);
assert.equal(
  exitClauseListMissing([
    ...clauses,
    {
      key: "blank",
      kind: "",
      anchor: { trigger: "unset" },
      rows: [],
      orGroups: [],
      scope: { kind: "all" },
      ownPct: null,
      ownDistance: null,
    },
  ]),
  true,
);

console.log("exit clause checks passed");
