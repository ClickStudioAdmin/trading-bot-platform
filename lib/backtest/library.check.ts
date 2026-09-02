import assert from "node:assert/strict";
import {
  canQueueUserBacktest,
  decideBacktestTemplateActions,
  deskBotAutomationsHref,
  findMatchingBacktestDeskBot,
  findMatchingBacktestTemplate,
  groupBacktestLibrary,
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
assert.equal(matching.canAttach, false);
assert.equal(matching.canSaveAs, true);
assert.equal(matching.sourceName, "Dip buyer");
assert.equal(matching.matchingTemplateName, null);

const matchingSamePair = decideBacktestTemplateActions({
  status: "done",
  ownerUserId: "user-1",
  memberId: "user-1",
  recipe: perps,
  source,
  linked: null,
});
assert.equal(matchingSamePair.canAttach, true);
assert.equal(matchingSamePair.canSaveAs, false);
assert.equal(matchingSamePair.matchingTemplateName, "Dip buyer");
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

const matchedOther = decideBacktestTemplateActions({
  status: "done",
  ownerUserId: "user-1",
  memberId: "user-1",
  recipe: { ...perps, triggerPrice: "1" },
  source,
  linked: null,
  matchingTemplate: {
    id: "tmpl-2",
    name: "Other dip",
    visibility: "user",
  },
});
assert.equal(matchedOther.canAttach, true);
assert.equal(matchedOther.canSaveAs, false);
assert.equal(matchedOther.matchingTemplateId, "tmpl-2");
assert.equal(matchedOther.matchingTemplateName, "Other dip");

const adminView = decideBacktestTemplateActions({
  status: "done",
  ownerUserId: "user-1",
  memberId: "admin-1",
  isAdmin: true,
  recipe: perps,
  source: null,
  linked: null,
  matchingTemplate: null,
  matchingDeskBot: { name: "Live dip", deskName: "Paper" },
});
assert.equal(adminView.canAttach, false);
assert.equal(adminView.canSaveAs, false);
assert.equal(adminView.canSaveAsPlatform, true);
assert.equal(adminView.matchingDeskLabel, "Paper · Live dip");

const alreadyPlatform = decideBacktestTemplateActions({
  status: "done",
  ownerUserId: "user-1",
  memberId: "admin-1",
  isAdmin: true,
  recipe: perps,
  source: null,
  linked: null,
  matchingTemplate: {
    id: "plat-1",
    name: "Starter dip",
    visibility: "platform",
  },
});
assert.equal(alreadyPlatform.canSaveAsPlatform, true);
assert.equal(alreadyPlatform.canAttach, false);

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

assert.equal(
  findMatchingBacktestTemplate(
    { ...perps, symbol: "ETHUSDT" },
    [
      { id: "tmpl-1", name: "Dip buyer", recipe: perps },
      { id: "tmpl-2", name: "Other", recipe: { ...perps, triggerPrice: "1" } },
      {
        id: "tmpl-eth",
        name: "ETH dip",
        recipe: { ...perps, symbol: "ETHUSDT" },
      },
    ],
    "tmpl-1",
  )?.id,
  "tmpl-eth",
);
assert.equal(
  findMatchingBacktestDeskBot(perps, [
    {
      id: "dca:1",
      name: "Desk dip",
      deskId: "desk-1",
      deskName: "Paper",
      recipe: perps,
      venue: "bybit",
      venueEnvironment: null,
    },
  ])?.deskName,
  "Paper",
);
assert.equal(
  findMatchingBacktestDeskBot(
    { ...perps, symbol: "ETHUSDT" },
    [
      {
        id: "dca:1",
        name: "Desk dip",
        deskId: "desk-1",
        deskName: "Paper",
        recipe: perps,
        venue: "bybit",
        venueEnvironment: null,
      },
    ],
  ),
  null,
);
assert.equal(
  deskBotAutomationsHref({ id: "dca:pb-1", deskId: "desk-1" }),
  "/strategies/futures/automations?desk=desk-1#bot-pb-1",
);

const grouped = groupBacktestLibrary(
  [
    { id: "tmpl-1", name: "Dip buyer", recipe: perps },
    { id: "tmpl-2", name: "Loose", recipe: { ...perps, triggerPrice: "1" } },
    { id: "tmpl-3", name: "Skip me", recipe: { ...perps, triggerPrice: "2" } },
  ],
  [
    {
      id: "set-btc",
      name: "BTC-USDT",
      visibility: "user",
      items: [
        { templateId: "tmpl-1", sortOrder: 1 },
        { templateId: "missing", sortOrder: 0 },
      ],
    },
    {
      id: "set-empty",
      name: "Empty",
      visibility: "user",
      items: [{ templateId: "missing" }],
    },
  ],
);
assert.equal(grouped.length, 2);
assert.equal(grouped[0]?.label, "BTC-USDT");
assert.deepEqual(
  grouped[0]?.items.map((row) => row.id),
  ["tmpl-1"],
);
assert.equal(grouped[1]?.label, "No folder");
assert.deepEqual(
  grouped[1]?.items.map((row) => row.id),
  ["tmpl-2", "tmpl-3"],
);

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
assert.equal(
  parseBacktestRecipeJson(
    JSON.stringify({
      ...dca,
      maxValue: 200,
      maxValueKind: "percent",
    }),
  ),
  null,
);
const marginRecipe = parseBacktestRecipeJson(
  JSON.stringify({
    ...dca,
    maxValue: 100,
    maxValueKind: "margin",
  }),
);
assert.equal(marginRecipe?.kind, "dca");
if (marginRecipe?.kind === "dca") {
  assert.equal(marginRecipe.maxValueKind, "margin");
}

console.log("backtest library checks passed");
