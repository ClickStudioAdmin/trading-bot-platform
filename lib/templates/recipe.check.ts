import assert from "node:assert/strict";
import { parseDcaPlaybookForm } from "@/lib/dca/playbook";
import { defaultPaperLayer } from "@/lib/engine/rules";
import {
  dcaRecipeToConfig,
  paperRecipeToLayer,
  parseTemplateName,
  parseTemplateRecipe,
  perpsRecipeToRule,
  recipeHasRuntimeKeys,
  recipePreview,
  snapshotDcaRecipe,
  snapshotPaperRecipe,
  snapshotPerpsRecipe,
  uniqueAppliedName,
} from "./recipe";

const form = new FormData();
form.set("name", "ETH grid");
form.set("symbol", "ETHUSDT");
form.set("direction", "both");
form.set("clipSize", "0.01");
form.set("sizeUnit", "qty");
form.set("startKind", "webhook");
form.set("webhookId", "11111111-1111-4111-8111-111111111111");
form.set("dipPct", "1.5");
const parsed = parseDcaPlaybookForm(form);
assert.equal(parsed.ok, true);
if (!parsed.ok) {
  throw new Error("expected DCA parse to succeed");
}

const snapshot = snapshotDcaRecipe(parsed.config);
assert.equal(snapshot.kind, "dca");
assert.equal(snapshot.symbol, "ETHUSDT");
assert.equal(snapshot.startKind, "webhook");
assert.equal("webhookId" in snapshot, false);
assert.equal(recipeHasRuntimeKeys(snapshot), false);

const roundTrip = parseTemplateRecipe(snapshot, "dca", 1);
assert.equal(roundTrip.ok, true);
if (roundTrip.ok && roundTrip.recipe.kind === "dca") {
  assert.equal(roundTrip.recipe.startKind, "webhook");
}

const applied = dcaRecipeToConfig(snapshot, {});
assert.equal(applied.ok, true);
if (applied.ok) {
  assert.equal(applied.config.startKind, "immediate");
  assert.equal(applied.config.webhookId, null);
  assert.equal(applied.config.symbol, "ETHUSDT");
  assert.ok(applied.notes[0]?.includes("Signal"));
}

const remapped = dcaRecipeToConfig(snapshot, { symbol: "SOLUSDT" });
assert.equal(remapped.ok, true);
if (remapped.ok) {
  assert.equal(remapped.config.symbol, "SOLUSDT");
}

assert.equal(parseTemplateRecipe({ name: "x" }, "dca", 1).ok, false);
assert.equal(parseTemplateRecipe(snapshot, "dca", 2).ok, false);
assert.equal(parseTemplateRecipe(snapshot, "perps", 1).ok, false);

const perps = snapshotPerpsRecipe({
  name: "Buy dip",
  symbol: "BTCUSDT",
  action: "buy",
  closeSide: null,
  orderType: "market",
  sizeUnit: "qty",
  size: 0.01,
  limitPrice: null,
  entrySource: "price",
  triggerBy: "last",
  triggerCompare: "lte",
  triggerPrice: 50000,
  skipIfOpen: true,
});
assert.equal(perps.kind, "perps");
assert.equal("mode" in perps, false);
assert.equal("webhookId" in perps, false);
assert.equal(recipeHasRuntimeKeys(perps), false);
const perpsRule = perpsRecipeToRule(perps, { sortOrder: 3 });
assert.equal(perpsRule.ok, true);
if (perpsRule.ok) {
  assert.equal(perpsRule.rule.mode, "disabled");
  assert.equal(perpsRule.rule.conditionTrue, false);
  assert.equal(perpsRule.rule.id, null);
  assert.equal(perpsRule.rule.sortOrder, 3);
  assert.equal(perpsRule.rule.triggerPrice, 50000);
}

const webhookPerps = snapshotPerpsRecipe({
  name: "Signal buy",
  symbol: "BTCUSDT",
  action: "buy",
  closeSide: null,
  orderType: "market",
  sizeUnit: "qty",
  size: 0.01,
  limitPrice: null,
  entrySource: "webhook",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: 1,
  skipIfOpen: true,
});
const coerced = perpsRecipeToRule(webhookPerps, { sortOrder: 0 });
assert.equal(coerced.ok, true);
if (coerced.ok) {
  assert.equal(coerced.rule.entrySource, "price");
  assert.equal(coerced.rule.mode, "disabled");
  assert.ok(coerced.notes[0]?.includes("Signal"));
}

const paper = snapshotPaperRecipe({
  ...defaultPaperLayer(0),
  name: "Core carry",
  mode: "active",
  minNetApr: 0.1,
  stopLossPct: -0.02,
});
assert.equal(paper.kind, "cash_and_carry");
assert.equal("mode" in paper, false);
assert.equal("id" in paper, false);
const paperLayer = paperRecipeToLayer(paper, { sortOrder: 2 });
assert.equal(paperLayer.ok, true);
if (paperLayer.ok) {
  assert.equal(paperLayer.layer.mode, "disabled");
  assert.equal(paperLayer.layer.id, null);
  assert.equal(paperLayer.layer.minNetApr, 0.1);
  assert.equal(paperLayer.layer.stopLossPct, -0.02);
  assert.equal(paperLayer.layer.sortOrder, 2);
}

assert.equal(uniqueAppliedName("Core", []), "Core");
assert.equal(uniqueAppliedName("Core", ["Core"]), "Core (from template)");
assert.equal(
  uniqueAppliedName("Core", ["Core", "Core (from template)"]),
  "Core (from template 2)",
);
assert.equal(recipePreview(snapshot).includes("ETHUSDT"), true);

assert.equal(parseTemplateName("").ok, false);
assert.equal(parseTemplateName("  Grid  ").ok, true);
if (parseTemplateName("  Grid  ").ok) {
  assert.equal(parseTemplateName("  Grid  ").ok, true);
}
const named = parseTemplateName("  Grid  ");
assert.equal(named.ok, true);
if (named.ok) {
  assert.equal(named.name, "Grid");
}
assert.equal(parseTemplateName("x".repeat(81)).ok, false);

console.log("templates recipe ok");
