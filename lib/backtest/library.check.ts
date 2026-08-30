import assert from "node:assert/strict";
import {
  decideBacktestTemplateActions,
  parseBacktestRecipeJson,
} from "./library";
import { snapshotPerpsRecipe } from "@/lib/templates/recipe";

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
  tpsl: null,
  trailing: null,
});

assert.equal(parseBacktestRecipeJson(JSON.stringify(perps))?.kind, "perps");
assert.equal(parseBacktestRecipeJson("not-json"), null);
assert.equal(parseBacktestRecipeJson({ kind: "cash_and_carry" }), null);

const source = { id: "tmpl-1", name: "Dip buyer", recipe: perps };
const matching = decideBacktestTemplateActions({
  status: "done",
  ownerUserId: "user-1",
  memberId: "user-1",
  recipe: { ...perps, symbol: "ETHUSDT" },
  source,
  linked: null,
});
assert.equal(matching.canAttach, true);
assert.equal(matching.canSaveAs, false);
assert.equal(matching.sourceName, "Dip buyer");
assert.equal(matching.applyTemplateId, null);

const edited = decideBacktestTemplateActions({
  status: "done",
  ownerUserId: "user-1",
  memberId: "user-1",
  recipe: { ...perps, triggerPrice: "1" },
  source,
  linked: null,
});
assert.equal(edited.canAttach, false);
assert.equal(edited.canSaveAs, true);

const unsaved = decideBacktestTemplateActions({
  status: "done",
  ownerUserId: "user-1",
  memberId: "user-1",
  recipe: perps,
  source: null,
  linked: null,
});
assert.equal(unsaved.canAttach, false);
assert.equal(unsaved.canSaveAs, true);

const attached = decideBacktestTemplateActions({
  status: "done",
  ownerUserId: "user-1",
  memberId: "user-1",
  recipe: perps,
  source,
  linked: { id: "tmpl-1", name: "Dip buyer", visibility: "user" },
});
assert.equal(attached.canAttach, false);
assert.equal(attached.canSaveAs, false);
assert.equal(attached.applyTemplateId, "tmpl-1");
assert.equal(attached.linkedName, "Dip buyer");

const snapshot = decideBacktestTemplateActions({
  status: "done",
  ownerUserId: "user-1",
  memberId: "user-1",
  recipe: perps,
  source: null,
  linked: { id: "snap-1", name: "Old snapshot", visibility: "backtested" },
});
assert.equal(snapshot.canSaveAs, true);
assert.equal(snapshot.applyTemplateId, null);

const queued = decideBacktestTemplateActions({
  status: "queued",
  ownerUserId: "user-1",
  memberId: "user-1",
  recipe: perps,
  source,
  linked: null,
});
assert.equal(queued.canAttach, false);
assert.equal(queued.canSaveAs, false);

console.log("backtest library checks passed");
