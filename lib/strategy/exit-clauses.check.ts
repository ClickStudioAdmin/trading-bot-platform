import assert from "node:assert/strict";
import type { ExitStackRow } from "@/components/exit-condition-stack";
import {
  entryKindDisabled,
  entryWebhookIdDisabled,
  priceChoiceConflicts,
} from "@/lib/strategy/expr";
import {
  classicSignature,
  customConditionCount,
  customStackFromClauses,
  exitClauseListMissing,
  exitClausesFromSaved,
  exitConflictModel,
  exitLeadKindDisabled,
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
    { key: "blank", kind: "", anchor: { trigger: "unset" }, rows: [] },
  ]),
  true,
);

const classicAnd = exitConflictModel([
  {
    key: "tp",
    kind: "take_profit",
    anchor: { trigger: "unset" },
    rows: [
      { key: "hook", join: "and", draft: { trigger: "webhook", webhookId: "one" } },
      { key: "next", join: "and", draft: { trigger: "unset" } },
    ],
  },
]);
assert.equal(classicAnd.rowIndex.hook, 0);
assert.equal(classicAnd.rowIndex.next, 1);
assert.equal(
  entryKindDisabled({
    slots: classicAnd.slots,
    index: 1,
    kind: "webhook",
    webhookIds: ["one", "two"],
  }),
  true,
);
assert.equal(
  entryKindDisabled({
    slots: classicAnd.slots,
    index: 1,
    kind: "indicator",
    webhookIds: ["one", "two"],
  }),
  false,
);
assert.equal(
  exitLeadKindDisabled({
    model: classicAnd,
    clauseKey: "tp",
    kind: "webhook",
    webhookIds: ["one", "two"],
  }),
  true,
);
assert.equal(
  exitLeadKindDisabled({
    model: classicAnd,
    clauseKey: "tp",
    kind: "price",
    webhookIds: ["one", "two"],
  }),
  false,
);
assert.equal(
  customConditionCount([
    {
      key: "tp",
      kind: "take_profit",
      anchor: { trigger: "unset" },
      rows: [
        {
          key: "hook",
          join: "and",
          draft: { trigger: "webhook", webhookId: "one" },
        },
      ],
    },
  ]),
  1,
);

const priced = exitConflictModel([
  {
    key: "custom",
    kind: "custom",
    anchor: { trigger: "price", triggerBy: "last", compare: "gte", price: "100" },
    rows: [
      {
        key: "below",
        join: "and",
        draft: { trigger: "price", triggerBy: "last", compare: "gte", price: "90" },
      },
    ],
  },
]);
assert.equal(
  priceChoiceConflicts(
    priced.slots,
    priced.rowIndex.below,
    { source: "last", compare: "gte", price: "90" },
    { compare: "lte" },
  ),
  true,
);
assert.equal(
  priceChoiceConflicts(
    priced.slots,
    priced.rowIndex.below,
    { source: "last", compare: "gte", price: "90" },
    { compare: "gte" },
  ),
  false,
);

const split = exitConflictModel([
  {
    key: "first",
    kind: "custom",
    anchor: { trigger: "webhook", webhookId: "one" },
    rows: [],
  },
  {
    key: "second",
    kind: "custom",
    anchor: { trigger: "unset" },
    rows: [],
  },
]);
assert.equal(split.anchorIndex.second, 1);
assert.equal(split.slots[1]?.join, "or");
assert.equal(
  exitLeadKindDisabled({
    model: split,
    clauseKey: "second",
    kind: "webhook",
    webhookIds: ["one", "two"],
  }),
  false,
);
assert.equal(
  entryWebhookIdDisabled({
    slots: split.slots,
    index: split.anchorIndex.second ?? 0,
    webhookId: "one",
  }),
  true,
);
assert.equal(
  exitLeadKindDisabled({
    model: split,
    clauseKey: "second",
    kind: "webhook",
    webhookIds: ["one"],
  }),
  true,
);

console.log("exit clause checks passed");
