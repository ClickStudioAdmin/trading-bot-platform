import assert from "node:assert/strict";
import {
  canQueueUserBacktest,
  decideBacktestTemplateActions,
  deskBotAutomationsHref,
  deskBacktestBotCandidates,
  findMatchingBacktestDeskBot,
  findMatchingSavedBacktest,
  toSavedBacktestMatch,
  findMatchingBacktestTemplate,
  groupBacktestLibrary,
  attachedTemplateHref,
  attachedTemplateName,
  backtestDeskFilterChoices,
  backtestDeskFilterLabel,
  backtestDeskTypeFilterChoices,
  indexBacktestRunsByDesk,
  inheritPlatformBacktests,
  matchingPlatformTemplateIds,
  parseBacktestRecipeJson,
  parseListedRecipe,
  backtestLinksForBotRecipes,
  userBacktestFieldIssues,
} from "./library";
import {
  recipesMatchReplayFields,
  snapshotDcaRecipe,
  snapshotPaperRecipe,
  snapshotPerpsRecipe,
  type TemplateRecipe,
} from "@/lib/templates/recipe";
import { parseDcaPlaybookForm } from "@/lib/dca/playbook";
import { defaultPaperLayer } from "@/lib/engine/rules";
import type { AttachedBacktestRow } from "./model";

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

assert.equal(parseBacktestRecipeJson(JSON.stringify(perps))?.kind, "flex");
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
assert.equal(attached.canSaveAsPlatform, false);
assert.equal(attached.applyTemplateId, "tmpl-1");
assert.equal(attached.linkedName, "Dip buyer");

const adminAttachedUser = decideBacktestTemplateActions({
  status: "done",
  ownerUserId: "admin-1",
  memberId: "admin-1",
  isAdmin: true,
  recipe: perps,
  source,
  linked: { id: "tmpl-1", name: "Dip buyer", visibility: "user" },
});
assert.equal(adminAttachedUser.canSaveAs, false);
assert.equal(adminAttachedUser.canSaveAsPlatform, true);

const adminAttachedPlatform = decideBacktestTemplateActions({
  status: "done",
  ownerUserId: "admin-1",
  memberId: "admin-1",
  isAdmin: true,
  recipe: perps,
  source: null,
  linked: { id: "plat-1", name: "Starter dip", visibility: "platform" },
});
assert.equal(adminAttachedPlatform.canSaveAs, false);
assert.equal(adminAttachedPlatform.canSaveAsPlatform, false);

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
  findMatchingSavedBacktest(perps, [
    { id: "run-old", name: "Old dip", recipe: { ...perps, triggerPrice: "1" } },
    { id: "run-1", name: "Buy dip results", recipe: perps },
  ])?.id,
  "run-1",
);
assert.equal(
  findMatchingSavedBacktest({ ...perps, symbol: "ETHUSDT" }, [
    { id: "run-1", name: "Buy dip results", recipe: perps },
  ]),
  null,
);
assert.equal(findMatchingSavedBacktest(null, []), null);
assert.equal(
  toSavedBacktestMatch({
    id: "run-1",
    status: "done",
    recipe: perps,
    symbol: "BTCUSDT",
    parentRunId: null,
  })?.name,
  "Buy dip",
);
assert.equal(
  toSavedBacktestMatch({
    id: "run-2",
    status: "queued",
    recipe: perps,
    symbol: "BTCUSDT",
    parentRunId: null,
  }),
  null,
);

assert.equal(
  findMatchingBacktestDeskBot(perps, [
    {
      id: "dca:1",
      name: "Desk dip",
      symbol: "BTCUSDT",
      kind: "flex" as const,
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
        symbol: "BTCUSDT",
        kind: "flex" as const,
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
  userBacktestFieldIssues({ ...dca, startKind: "webhook" })[0]?.message,
  "Webhook triggers can't be backtested.",
);
assert.equal(
  canQueueUserBacktest({
    ...dca,
    startKind: "price",
    armTrigger: { triggerBy: "last", compare: "gte", price: 50000 },
  }).ok,
  true,
);
assert.equal(
  canQueueUserBacktest({
    ...dca,
    startKind: "trend",
    indicatorKind: "supertrend",
    indicatorTimeframe: "15",
    indicatorCompare: "cross_gte",
    indicatorPeriod: 10,
    indicatorMultiplier: 3,
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

assert.deepEqual(
  deskBacktestBotCandidates(
    [
      {
        id: "perps:1",
        kind: "flex" as const,
        symbol: "BTCUSDT",
      },
      {
        id: "perps:2",
        kind: "flex" as const,
        symbol: "ETHUSDT",
      },
      {
        id: "dca:1",
        kind: "dca" as const,
        symbol: "BTCUSDT",
      },
    ],
    perps,
  ).map((row) => row.id),
  ["perps:1"],
);

const platformHighlight = { runId: "platform-run" };
const ownHighlight = { runId: "own-run" };
const sameBot = [
  { id: "user", visibility: "user", recipe: perps },
  { id: "platform", visibility: "platform", recipe: { ...perps, name: "Catalog" } },
  { id: "other", visibility: "user", recipe: { ...perps, symbol: "ETHUSDT" } },
  { id: "copy", visibility: "user", recipe: perps },
];
const inherited = inheritPlatformBacktests(sameBot, {
  platform: platformHighlight,
});
assert.equal(inherited.user, platformHighlight);
assert.equal(inherited.copy, platformHighlight);
assert.equal(inherited.platform, platformHighlight);
assert.equal(inherited.other, undefined);
const kept = inheritPlatformBacktests(sameBot, {
  platform: platformHighlight,
  user: ownHighlight,
});
assert.equal(kept.user, ownHighlight);
assert.equal(kept.copy, platformHighlight);
const privateOnly = inheritPlatformBacktests(
  [
    { id: "a", visibility: "user", recipe: perps },
    { id: "b", visibility: "user", recipe: perps },
  ],
  { a: platformHighlight },
);
assert.equal(privateOnly.b, undefined);
const filled = inheritPlatformBacktests(sameBot, {
  platform: [{ runId: "platform-run" }],
  user: [],
});
assert.deepEqual(filled.user, [{ runId: "platform-run" }]);
assert.deepEqual(
  matchingPlatformTemplateIds(sameBot, ["user", "other"]),
  ["platform"],
);

assert.equal(
  attachedTemplateName(
    { name: "DCA Test", visibility: "user", userId: "owner" },
    { userId: "owner", isAdmin: false, shared: false },
  ),
  "DCA Test",
);
assert.equal(
  attachedTemplateName(
    { name: "  Platform grid  ", visibility: "platform", userId: null },
    { userId: "member", isAdmin: false, shared: false },
  ),
  "Platform grid",
);
assert.equal(
  attachedTemplateName(
    { name: "Private", visibility: "user", userId: "owner" },
    { userId: "member", isAdmin: false, shared: false },
  ),
  null,
);
assert.equal(
  attachedTemplateName(
    { name: "Private", visibility: "user", userId: "owner" },
    { userId: "member", isAdmin: false, shared: true },
  ),
  "Private",
);
assert.equal(
  attachedTemplateName(
    { name: "Private", visibility: "user", userId: "owner" },
    { userId: "member", isAdmin: true, shared: false },
  ),
  "Private",
);
assert.equal(
  attachedTemplateName(
    { name: "Snapshot", visibility: "backtested", userId: null },
    { userId: "member", isAdmin: false, shared: false },
  ),
  "Snapshot",
);
assert.equal(
  attachedTemplateName(
    { name: "   ", visibility: "platform", userId: null },
    { userId: "member", isAdmin: true, shared: false },
  ),
  null,
);
assert.equal(
  attachedTemplateHref(
    { id: "tmpl-1", visibility: "user", userId: "owner" },
    { userId: "owner", isAdmin: false, shared: false },
  ),
  "/account/templates?template=tmpl-1",
);
assert.equal(
  attachedTemplateHref(
    { id: "tmpl-2", visibility: "user", userId: "owner" },
    { userId: "member", isAdmin: false, shared: true },
  ),
  "/account/templates?tab=shared-templates&template=tmpl-2",
);
assert.equal(
  attachedTemplateHref(
    { id: "plat-1", visibility: "platform", userId: null },
    { userId: "admin", isAdmin: true, shared: false },
  ),
  "/admin/templates?template=plat-1",
);
assert.equal(
  attachedTemplateHref(
    { id: "plat-1", visibility: "platform", userId: null },
    { userId: "member", isAdmin: false, shared: false },
  ),
  "/account/templates?template=plat-1",
);

const listedDca = parseListedRecipe(dca);
assert.equal(listedDca?.kind, "dca");
assert.ok(listedDca);
const renamedDca = parseListedRecipe({ ...dca, name: "renamed" });
assert.ok(listedDca && renamedDca);
if (listedDca && renamedDca) {
  assert.equal(recipesMatchReplayFields(listedDca, renamedDca), true);
}
assert.equal(parseListedRecipe(null), null);
assert.equal(parseListedRecipe({ kind: "spot", symbol: "BTCUSDT" }), null);
const carryRecipe = snapshotPaperRecipe({
  ...defaultPaperLayer(0),
  name: "Carry core",
  notionalUsdt: 1000,
});
assert.equal(parseListedRecipe(carryRecipe)?.kind, "cash_and_carry");
assert.equal(parseBacktestRecipeJson(carryRecipe), null);

function doneRun(
  id: string,
  recipe: TemplateRecipe,
  extra: Partial<AttachedBacktestRow> = {},
): AttachedBacktestRow & { recipe: TemplateRecipe } {
  return {
    id,
    userId: "user-1",
    status: "done",
    name: id,
    symbol: "symbol" in recipe ? recipe.symbol : "",
    recipeName: recipe.name,
    parentRunId: null,
    fromMs: 1,
    toMs: 2,
    createdAtMs: 1,
    recipe,
    ...extra,
  };
}

if (listedDca) {
  const other = parseListedRecipe({ ...dca, dipPct: 9 });
  assert.ok(other);
  const links = backtestLinksForBotRecipes({
    viewerId: "user-1",
    isAdmin: false,
    bots: [
      { id: "dca:atr", recipe: listedDca },
      { id: " ", recipe: listedDca },
      { id: "dca:other", recipe: other! },
    ],
    runs: [
      doneRun("newer", listedDca, { createdAtMs: 20 }),
      doneRun("older", listedDca, { createdAtMs: 10 }),
      doneRun("stranger", listedDca, { userId: "user-2", createdAtMs: 30 }),
      doneRun("published", { ...listedDca, name: "renamed" }, {
        userId: null,
        createdAtMs: 5,
      }),
      doneRun("queued", listedDca, { status: "queued", createdAtMs: 40 }),
      doneRun("different", other!, { createdAtMs: 50 }),
    ],
  });
  assert.deepEqual(
    links["dca:atr"]?.map((link) => link.runId),
    ["newer", "older", "published"],
  );
  assert.equal(links[" "], undefined);
  assert.deepEqual(
    links["dca:other"]?.map((link) => link.runId),
    ["different"],
  );
  const asAdmin = backtestLinksForBotRecipes({
    viewerId: "admin-1",
    isAdmin: true,
    bots: [{ id: "dca:atr", recipe: listedDca }],
    runs: [doneRun("stranger", listedDca, { userId: "user-2" })],
  });
  assert.deepEqual(
    asAdmin["dca:atr"]?.map((link) => link.runId),
    ["stranger"],
  );
}

function deskBot(
  deskId: string,
  deskName: string,
  recipe: typeof perps,
  kind: "dca" | "flex" = "flex",
) {
  return {
    id: `${kind}:bot-${deskId}`,
    name: recipe.name,
    symbol: recipe.symbol,
    kind,
    deskId,
    deskName,
    recipe,
    venue: "bybit",
    venueEnvironment: null,
  };
}

const alpha = deskBot("desk-alpha", "Alpha", perps);
const paper = deskBot("desk-paper", "Paper", perps);
const otherSymbol = deskBot(
  "desk-eth",
  "Ether",
  { ...perps, symbol: "ETHUSDT" },
);
const otherPrice = deskBot("desk-price", "Price", {
  ...perps,
  triggerPrice: "1",
});
const renamed = deskBot("desk-renamed", "Renamed", {
  ...perps,
  name: "Renamed bot",
});
const indexed = indexBacktestRunsByDesk(
  [
    { id: "run-btc", recipe: perps },
    { id: "run-eth", recipe: { ...perps, symbol: "ETHUSDT" } },
    { id: "run-other", recipe: { ...perps, triggerPrice: "9" } },
  ],
  [paper, alpha, otherSymbol, otherPrice, renamed],
);
assert.deepEqual(
  indexed.desks.map((desk) => desk.name),
  ["Alpha", "Ether", "Paper", "Price", "Renamed"],
);
assert.deepEqual(indexed.runDeskIds["run-btc"], [
  "desk-paper",
  "desk-alpha",
  "desk-renamed",
]);
assert.deepEqual(indexed.runDeskIds["run-eth"], ["desk-eth"]);
assert.equal(indexed.runDeskIds["run-other"], undefined);
const withEmpty = indexBacktestRunsByDesk(
  [{ id: "run-btc", recipe: perps }],
  [alpha],
  [{ id: "desk-empty", name: "ByBit Paper", deskType: "dca" }],
);
assert.deepEqual(
  withEmpty.desks.map((desk) => desk.name),
  ["Alpha", "ByBit Paper"],
);
assert.deepEqual(withEmpty.runDeskIds["run-btc"], ["desk-alpha"]);
assert.equal(indexed.desks.find((desk) => desk.id === "desk-alpha")?.deskType, "flex");
assert.equal(
  backtestDeskFilterLabel(
    { id: "desk-alpha", name: "Alpha", deskType: "flex" },
    indexed.desks,
  ),
  "Alpha",
);
assert.equal(
  backtestDeskFilterLabel(
    { id: "desk-a", name: "ByBit", deskType: "dca" },
    [
      { id: "desk-a", name: "ByBit", deskType: "dca" },
      { id: "desk-b", name: "ByBit", deskType: "flex" },
    ],
  ),
  "DCA · ByBit",
);
const mixedDesks = [
  { id: "desk-flex", name: "Flex desk", deskType: "flex" as const },
  { id: "desk-dca", name: "DCA desk", deskType: "dca" as const },
];
assert.deepEqual(
  backtestDeskFilterChoices(mixedDesks, "all").map((desk) => desk.id),
  ["desk-flex", "desk-dca"],
);
assert.deepEqual(
  backtestDeskFilterChoices(mixedDesks, "flex").map((desk) => desk.id),
  ["desk-flex"],
);
assert.deepEqual(
  backtestDeskFilterChoices(mixedDesks, "dca").map((desk) => desk.id),
  ["desk-dca"],
);
assert.deepEqual(backtestDeskTypeFilterChoices(mixedDesks, "all"), [
  "all",
  "flex",
  "dca",
]);
assert.deepEqual(backtestDeskTypeFilterChoices(mixedDesks, "desk-dca"), [
  "all",
  "dca",
]);
assert.deepEqual(backtestDeskTypeFilterChoices(mixedDesks, "desk-flex"), [
  "all",
  "flex",
]);
assert.deepEqual(backtestDeskTypeFilterChoices(mixedDesks, "missing"), [
  "all",
  "flex",
  "dca",
]);

console.log("backtest library checks passed");
