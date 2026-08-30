import assert from "node:assert/strict";
import {
  canQueueUserBacktest,
  decideBacktestTemplateActions,
  parseBacktestRecipeJson,
  userBacktestFieldIssues,
} from "./library";
import { snapshotDcaRecipe, snapshotPerpsRecipe } from "@/lib/templates/recipe";
import { parseDcaPlaybookForm } from "@/lib/dca/playbook";

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

assert.equal(canQueueUserBacktest(perps).ok, true);
assert.equal(
  canQueueUserBacktest({ ...perps, entrySource: "webhook" }).ok,
  false,
);

const dcaForm = new FormData();
dcaForm.set("name", "Grid");
dcaForm.set("symbol", "BTCUSDT");
dcaForm.set("direction", "long");
dcaForm.set("startKind", "immediate");
dcaForm.set("clipSize", "1");
dcaForm.set("sizeUnit", "qty");
const dcaParsed = parseDcaPlaybookForm(dcaForm);
assert.equal(dcaParsed.ok, true);
if (!dcaParsed.ok) {
  throw new Error("expected dca parse");
}
const dca = snapshotDcaRecipe(dcaParsed.config);
assert.equal(canQueueUserBacktest(dca).ok, false);
assert.equal(
  userBacktestFieldIssues(dca).some((row) => row.field === "startKind"),
  true,
);
assert.equal(canQueueUserBacktest({ ...dca, startKind: "webhook" }).ok, false);
assert.equal(
  canQueueUserBacktest({
    ...dca,
    startKind: "price",
    armTrigger: { triggerBy: "last", compare: "gte", price: 50000 },
  }).ok,
  true,
);

console.log("backtest library checks passed");
