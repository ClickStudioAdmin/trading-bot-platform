import assert from "node:assert/strict";
import {
  blankPerpsAddConditionDraft,
  perpsAddConditionDraftForType,
} from "./perps-add-condition";

const blank = blankPerpsAddConditionDraft("long");
assert.equal(blank.kind, "");
assert.equal(blank.triggerCompare, "gte");
assert.equal(blankPerpsAddConditionDraft("short").triggerCompare, "lte");

const indicator = perpsAddConditionDraftForType("indicator", "long", {
  ...blank,
  kind: "supertrend",
});
assert.equal(indicator.kind, "");

const trend = perpsAddConditionDraftForType("trend", "short", blank);
assert.equal(trend.kind, "supertrend");
assert.equal(trend.compare, "cross_lte");
assert.equal(trend.period, "10");
assert.equal(trend.multiplier, "3");

const price = perpsAddConditionDraftForType("price", "long", trend);
assert.equal(price.triggerBy, "last");
assert.equal(perpsAddConditionDraftForType("webhook", "long", blank).webhookId, "");
