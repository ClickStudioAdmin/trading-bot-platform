import assert from "node:assert/strict";
import {
  automationFromLayer,
  closedTradeLabel,
  exitFormValues,
  formatCarryCloseWhy,
  formatCarryEntryWhy,
  formatCloseHow,
  formatFiredExitLines,
  formatEntryTriggers,
  formatExitOrderType,
  formatExitTriggers,
  parseCarryExitForm,
  parseCloseReason,
  parseTradeSource,
} from "./automation";

const layer = {
  id: 1,
  name: "Set 1",
  sortOrder: 0,
  sizeType: "fixed" as const,
  exitSizeType: "fixed" as const,
  notionalUsdt: 10_000,
  minNetApr: 0.1,
  minDte: 7,
  maxDte: 90,
  minCapacityUsdt: 5_000,
  minSizeUsdt: null,
  maxOpenCount: 2,
  maxOpenNotionalUsdt: 25_000,
  closeMaxDte: 3,
  closeMinNetApr: 0.05,
  takeProfitPct: 0.01,
  stopLossPct: -0.02,
};

const automation = automationFromLayer(layer);
assert.deepEqual(formatEntryTriggers(automation), [
  "Min APR: 10%",
  "DTE: 7–90",
  "Max Position Size: $25,000",
  "Min usable book: $5,000",
]);
assert.equal(
  formatExitOrderType(automation),
  "Order Type Fixed (entire position)",
);
assert.deepEqual(formatExitTriggers(automation), [
  "Order Type Fixed (entire position)",
  "DTE ≤ 3",
  "APR below 5%",
  "Take profit 1%",
  "Stop loss 2%",
]);
assert.deepEqual(formatEntryTriggers({
  ...automation,
  entryMinNetApr: null,
  entryMinDte: null,
  entryMaxDte: null,
  entryMinCapacityUsdt: null,
  entryMaxOpenNotionalUsdt: null,
}), []);
assert.deepEqual(
  formatEntryTriggers({
    ...automationFromLayer({
      ...layer,
      sizeType: "dynamic",
      minCapacityUsdt: 5_000,
      minSizeUsdt: 4_000,
    }),
    entryMinNetApr: null,
    entryMinDte: null,
    entryMaxDte: null,
  }),
  [
    "Order Type Dynamic (scale in)",
    "Max Position Size: $25,000",
    "Min Order Size: $4,000",
  ],
);

const form = new FormData();
form.set("closeMaxDte", "4");
form.set("closeMinApr", "6");
form.set("takeProfit", "1.5");
form.set("stopLoss", "3");
const parsed = parseCarryExitForm(form);
assert.equal("error" in parsed, false);
if (!("error" in parsed)) {
  assert.equal(parsed.closeMaxDte, 4);
  assert.equal(parsed.closeMinNetApr, 0.06);
  assert.equal(parsed.takeProfitPct, 0.015);
  assert.equal(parsed.stopLossPct, -0.03);
}

const values = exitFormValues(automation);
assert.equal(values.takeProfit, "1");
assert.equal(values.stopLoss, "2");

const bad = new FormData();
bad.set("takeProfit", "0");
assert.equal("error" in parseCarryExitForm(bad), true);

assert.equal(parseTradeSource("engine"), "engine");
assert.equal(parseTradeSource(null), "manual");
assert.equal(parseCloseReason("take_profit"), "take_profit");
assert.equal(parseCloseReason("hand"), null);
assert.equal(closedTradeLabel("engine", "manual"), "In System · Out Manual");
assert.equal(closedTradeLabel("manual", "engine"), "In Manual · Out System");
assert.equal(
  formatCarryEntryWhy("engine", {
    ...automation,
    entrySizeType: "dynamic",
  }),
  "Trigger System · Entry System · Scale in",
);
assert.equal(
  formatCarryCloseWhy("engine", "unwind", {
    ...automation,
    exitSizeType: "dynamic",
  }),
  "Trigger System · Exit System · Scale out",
);
assert.deepEqual(
  formatFiredExitLines(
    { ...automation, exitSizeType: "dynamic" },
    "unwind",
  ),
  [],
);
assert.deepEqual(formatFiredExitLines(automation, "mark_apr"), [
  "APR below 5%",
]);
assert.equal(formatCloseHow("manual", null), "Closed at market.");
assert.equal(formatCloseHow("manual", "unwind"), "Unwound manually.");
assert.equal(
  formatCloseHow("engine", "take_profit"),
  "Closed automatically on take profit.",
);

console.log("paper automation checks passed");
