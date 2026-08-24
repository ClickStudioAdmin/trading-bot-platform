import assert from "node:assert/strict";
import {
  blockedRuleDeletes,
  defaultPaperConfig,
  paperConfigToFormValues,
  paperLayerToRow,
  parsePaperRulesForm,
  parsePaperRulesRow,
} from "./rules";

const empty = new FormData();
empty.set("ruleCount", "1");
empty.set("r0_notionalUsdt", "10,000");
const parsedEmpty = parsePaperRulesForm(empty);
assert.equal(parsedEmpty.ok, true);
if (parsedEmpty.ok) {
  assert.equal(parsedEmpty.config.enabled, true);
  assert.equal(parsedEmpty.config.layers[0]?.mode, "active");
  assert.equal(parsedEmpty.config.layers[0]?.sizeType, "dynamic");
  assert.equal(parsedEmpty.config.layers[0]?.name, "Set 1");
  assert.equal(parsedEmpty.config.layers[0]?.maxOpenCount, null);
  assert.equal(parsedEmpty.config.layers[0]?.notionalUsdt, 10_000);
  assert.equal(parsedEmpty.config.layers[0]?.minNetApr, null);
  assert.equal(parsedEmpty.config.layers[0]?.minSizeUsdt, null);
}

const filled = new FormData();
filled.set("ruleCount", "2");
filled.set("r0_id", "4");
filled.set("r0_name", "Core carry");
filled.set("r0_notionalUsdt", "10000");
filled.set("r0_minApr", "10");
filled.set("r0_stopLoss", "2");
filled.set("r1_notionalUsdt", "25000");
filled.set("r1_minApr", "20");
filled.set("r1_takeProfit", "1");

const parsed = parsePaperRulesForm(filled);
assert.equal(parsed.ok, true);
if (parsed.ok) {
  assert.equal(parsed.config.enabled, true);
  assert.equal(parsed.config.layers.length, 2);
  assert.equal(parsed.config.layers[0]?.name, "Core carry");
  assert.equal(parsed.config.layers[1]?.name, "Set 2");
  assert.equal(parsed.config.layers[0]?.minNetApr, 0.1);
  assert.equal(parsed.config.layers[0]?.stopLossPct, -0.02);
  assert.equal(parsed.config.layers[1]?.minNetApr, 0.2);
  assert.equal(parsed.config.layers[1]?.takeProfitPct, 0.01);
  const row = paperLayerToRow("user-1", parsed.config.layers[0]!);
  assert.equal(row.user_id, "user-1");
  assert.equal(row.mode, "active");
  assert.equal(row.size_type, "dynamic");
  const roundTrip = parsePaperRulesRow({ id: 4, ...row }, 0);
  assert.equal(roundTrip.id, 4);
  assert.equal(roundTrip.sizeType, "dynamic");
  assert.equal(paperConfigToFormValues(parsed.config).layers[0]?.stopLoss, "2");
}

const none = new FormData();
none.set("ruleCount", "0");
assert.equal(parsePaperRulesForm(none).ok, true);
const parsedNone = parsePaperRulesForm(none);
if (parsedNone.ok) {
  assert.equal(parsedNone.config.enabled, false);
}

const paused = new FormData();
paused.set("ruleCount", "1");
paused.set("r0_notionalUsdt", "10000");
paused.set("r0_mode", "disabled");
const parsedPaused = parsePaperRulesForm(paused);
assert.equal(parsedPaused.ok, true);
if (parsedPaused.ok) {
  assert.equal(parsedPaused.config.enabled, false);
  assert.equal(parsedPaused.config.layers[0]?.mode, "disabled");
}

const reduceSet = new FormData();
reduceSet.set("ruleCount", "1");
reduceSet.set("r0_notionalUsdt", "10000");
reduceSet.set("r0_mode", "reduce_only");
const parsedReduce = parsePaperRulesForm(reduceSet);
assert.equal(parsedReduce.ok, true);
if (parsedReduce.ok) {
  assert.equal(parsedReduce.config.enabled, true);
  assert.equal(parsedReduce.config.layers[0]?.mode, "reduce_only");
}

const swapped = new FormData();
swapped.set("ruleCount", "1");
swapped.set("r0_notionalUsdt", "10000");
swapped.set("r0_minDte", "90");
swapped.set("r0_maxDte", "7");
assert.equal(parsePaperRulesForm(swapped).ok, false);

const dynamic = new FormData();
dynamic.set("ruleCount", "1");
dynamic.set("r0_sizeType", "dynamic");
dynamic.set("r0_minCapacity", "5000");
dynamic.set("r0_minSize", "4000");
const parsedDynamic = parsePaperRulesForm(dynamic);
assert.equal(parsedDynamic.ok, true);
if (parsedDynamic.ok) {
  assert.equal(parsedDynamic.config.layers[0]?.sizeType, "dynamic");
  assert.equal(parsedDynamic.config.layers[0]?.minSizeUsdt, 4_000);
  assert.equal(parsedDynamic.config.layers[0]?.minCapacityUsdt, null);
}

const missingSize = new FormData();
missingSize.set("ruleCount", "1");
missingSize.set("r0_sizeType", "fixed");
assert.equal(parsePaperRulesForm(missingSize).ok, false);

assert.deepEqual(blockedRuleDeletes([1, 2, 3], [2, 9]), [2]);
assert.deepEqual(blockedRuleDeletes([4], []), []);
assert.equal(paperConfigToFormValues({ enabled: false, layers: [] }).layers.length, 0);

assert.equal(defaultPaperConfig().layers.length, 1);

console.log("engine rules checks passed");
