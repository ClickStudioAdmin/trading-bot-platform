import assert from "node:assert/strict";
import type { ExitStackRow } from "@/components/exit-condition-stack";
import {
  classicSignature,
  customStackFromClauses,
  exitClausesFromSaved,
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
  ["take_profit", "stop_loss", "custom", "custom"],
);
assert.equal(clauses[2]?.rows.length, 1);
assert.equal(clauses[2]?.rows[0]?.join, "and");
assert.equal(clauses[3]?.anchor.trigger, "webhook");
assert.equal(clauses[3]?.rows.length, 0);

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
  ["take_profit", "stop_loss", "custom", "custom"],
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
  [{ key: "keep", kind: "custom", anchor: { trigger: "unset" }, rows: [] }],
  clauses,
);
assert.deepEqual(
  synced.map((clause) => clause.kind),
  ["take_profit", "stop_loss", "custom"],
);
assert.equal(synced[2]?.key, "keep");
assert.equal(classicSignature(synced), "take_profit|stop_loss");

console.log("exit clause checks passed");
