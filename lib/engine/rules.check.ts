import assert from "node:assert/strict";
import {
  defaultPaperRules,
  paperRulesToFormValues,
  paperRulesToRow,
  parsePaperRulesForm,
  parsePaperRulesRow,
} from "./rules";

const empty = new FormData();
empty.set("notionalUsdt", "10,000");
const parsedEmpty = parsePaperRulesForm(empty);
assert.equal(parsedEmpty.ok, true);
if (parsedEmpty.ok) {
  assert.equal(parsedEmpty.rules.enabled, false);
  assert.equal(parsedEmpty.rules.notionalUsdt, 10_000);
  assert.equal(parsedEmpty.rules.minNetApr, null);
}

const filled = new FormData();
filled.set("enabled", "on");
filled.set("notionalUsdt", "25000");
filled.set("minApr", "10");
filled.set("minDte", "7");
filled.set("maxDte", "90");
filled.set("minCapacity", "5000");
filled.set("maxOpenCount", "3");
filled.set("maxOpenNotional", "50000");
filled.set("closeMaxDte", "3");
filled.set("closeMinApr", "5");
filled.set("takeProfit", "1");
filled.set("stopLoss", "2");

const parsed = parsePaperRulesForm(filled);
assert.equal(parsed.ok, true);
if (parsed.ok) {
  assert.equal(parsed.rules.enabled, true);
  assert.equal(parsed.rules.minNetApr, 0.1);
  assert.equal(parsed.rules.takeProfitPct, 0.01);
  assert.equal(parsed.rules.stopLossPct, -0.02);
  const row = paperRulesToRow("user-1", parsed.rules);
  assert.equal(row.user_id, "user-1");
  assert.equal(row.stop_loss_pct, -0.02);
  const roundTrip = parsePaperRulesRow(row);
  assert.equal(roundTrip.takeProfitPct, 0.01);
  assert.equal(paperRulesToFormValues(roundTrip).stopLoss, "2");
}

const bad = parsePaperRulesForm(new FormData());
assert.equal(bad.ok, false);

const swapped = new FormData();
swapped.set("notionalUsdt", "10000");
swapped.set("minDte", "90");
swapped.set("maxDte", "7");
assert.equal(parsePaperRulesForm(swapped).ok, false);

assert.equal(defaultPaperRules().enabled, false);
assert.equal(defaultPaperRules().notionalUsdt, 10_000);

console.log("engine rules checks passed");
