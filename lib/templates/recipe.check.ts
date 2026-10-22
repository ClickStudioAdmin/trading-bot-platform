import assert from "node:assert/strict";
import { entryRowsFromSources } from "@/components/entry-condition-stack";
import { exitRowsFromStack } from "@/components/exit-condition-stack";
import { initialPerpsEntryDrafts } from "@/components/perps-entry-panel";
import { parseDcaPlaybookForm } from "@/lib/dca/playbook";
import {
  futuresAutomationToRow,
  parseFuturesAutomationForm,
  parseFuturesAutomationRow,
} from "@/lib/futures/automation";
import { defaultPaperLayer } from "@/lib/engine/rules";
import {
  dcaFormToSnapshotSource,
  dcaRecipeToConfig,
  paperRecipeToLayer,
  parseTemplateName,
  parseTemplateRecipe,
  perpsRecipeToRule,
  recipeHasRuntimeKeys,
  recipePreview,
  storedTemplateRecipe,
  botNameFromTemplate,
  dcaFormMatchesPlaybook,
  snapshotDcaRecipe,
  snapshotPaperRecipe,
  findMatchingLibraryTemplate,
  recipesMatchForBacktest,
  recipesMatchReplayFields,
  snapshotPerpsRecipe,
  dcaRecipePlaybookSeed,
  perpsRecipeFormSeed,
  TEMPLATE_RECIPE_VERSION,
  uniqueAppliedName,
  templateFitsDesk,
  formatTemplateDeskType,
  parseTemplateVisibility,
  templateIsLibraryRow,
} from "./recipe";

const form = new FormData();
form.set("name", "ETH grid");
form.set("symbol", "ETHUSDT");
form.set("direction", "both");
form.set("clipSize", "0.01");
form.set("sizeUnit", "qty");
form.set("startKind", "webhook");
form.set("webhookId", "33333333-3333-4333-8333-333333333333");
form.set("dipPct", "1.5");
const parsed = parseDcaPlaybookForm(form);
assert.equal(parsed.ok, true);
if (!parsed.ok) {
  throw new Error("expected DCA parse to succeed");
}

const snapshot = snapshotDcaRecipe(parsed.config);
assert.equal(dcaFormMatchesPlaybook(parsed.config, parsed.config), true);
assert.equal(
  dcaFormMatchesPlaybook(parsed.config, { ...parsed.config, clipSize: 99 }),
  false,
);
assert.equal(
  dcaFormMatchesPlaybook(parsed.config, {
    ...parsed.config,
    shortWebhookId: "22222222-2222-4222-8222-222222222222",
  }),
  false,
);
assert.equal(snapshot.kind, "dca");
assert.equal(snapshot.symbol, "ETHUSDT");
assert.equal(snapshot.startKind, "webhook");
assert.equal(snapshot.maxValueKind, "usdt");
assert.equal(snapshot.confirm, null);
assert.equal(snapshot.exitIf, null);
const oldRecipe = parseTemplateRecipe(
  { ...snapshot, maxValueKind: undefined },
  "dca",
  1,
);
assert.equal(oldRecipe.ok, true);
if (oldRecipe.ok && oldRecipe.recipe.kind === "dca") {
  assert.equal(oldRecipe.recipe.maxValueKind, "usdt");
}
assert.equal("webhookId" in snapshot, false);
assert.equal("shortWebhookId" in snapshot, false);
assert.equal(snapshot.shortStartKind, "webhook");
assert.equal(recipeHasRuntimeKeys(snapshot), false);
assert.equal(
  JSON.stringify(snapshot).includes("33333333-3333-4333-8333-333333333333"),
  false,
);

const roundTrip = parseTemplateRecipe(snapshot, "dca", 1);
assert.equal(roundTrip.ok, true);
if (roundTrip.ok && roundTrip.recipe.kind === "dca") {
  assert.equal(roundTrip.recipe.startKind, "webhook");
}

const applied = dcaRecipeToConfig(snapshot, {});
assert.equal(applied.ok, true);
if (applied.ok) {
  assert.equal(applied.config.startKind, "webhook");
  assert.equal(applied.config.shortStartKind, "webhook");
  assert.equal(applied.config.webhookId, null);
  assert.equal(applied.config.shortWebhookId, null);
  assert.equal(applied.config.symbol, "ETHUSDT");
  assert.equal(applied.notes.length, 0);
}

const appliedHook = dcaRecipeToConfig(snapshot, {
  webhookId: "22222222-2222-4222-8222-222222222222",
});
assert.equal(appliedHook.ok, true);
if (appliedHook.ok) {
  assert.equal(appliedHook.config.startKind, "webhook");
  assert.equal(appliedHook.config.shortStartKind, "webhook");
  assert.equal(appliedHook.config.webhookId, null);
  assert.equal(appliedHook.config.shortWebhookId, null);
}

const legacySignal = {
  ...snapshot,
  webhookId: "33333333-3333-4333-8333-333333333333",
  shortWebhookId: "55555555-5555-4555-8555-555555555555",
};
const legacyApplied = dcaRecipeToConfig(legacySignal, {});
assert.equal(legacyApplied.ok, true);
if (legacyApplied.ok) {
  assert.equal(legacyApplied.config.startKind, "webhook");
  assert.equal(legacyApplied.config.shortStartKind, "webhook");
  assert.equal(legacyApplied.config.webhookId, null);
  assert.equal(legacyApplied.config.shortWebhookId, null);
  assert.equal(
    legacyApplied.notes.some((note) => note.includes("Signal")),
    false,
  );
}
const legacyBound = dcaRecipeToConfig(legacySignal, {
  webhookId: "22222222-2222-4222-8222-222222222222",
});
assert.equal(legacyBound.ok, true);
if (legacyBound.ok) {
  assert.equal(legacyBound.config.startKind, "webhook");
  assert.equal(legacyBound.config.shortStartKind, "webhook");
  assert.equal(legacyBound.config.webhookId, null);
  assert.equal(legacyBound.config.shortWebhookId, null);
}

const splitSnap = snapshotDcaRecipe({
  ...parsed.config,
  startKind: "price",
  shortStartKind: "indicator",
  webhookId: null,
  shortWebhookId: null,
  armTrigger: { triggerBy: "last", compare: "lte", price: 100 },
  indicatorKind: null,
  shortIndicatorKind: "rsi",
  shortIndicatorTimeframe: "15",
  shortIndicatorCompare: "gte",
  shortIndicatorLevel: 70,
  shortIndicatorPeriod: 14,
});
assert.equal(splitSnap.startKind, "price");
assert.equal(splitSnap.shortStartKind, "indicator");
assert.equal("shortWebhookId" in splitSnap, false);
const splitApplied = dcaRecipeToConfig(splitSnap, {});
assert.equal(splitApplied.ok, true);
if (splitApplied.ok) {
  assert.equal(splitApplied.config.startKind, "price");
  assert.equal(splitApplied.config.shortStartKind, "indicator");
  assert.equal(splitApplied.config.shortIndicatorKind, "rsi");
  assert.equal(splitApplied.config.armTrigger?.price, 100);
}

const appliedManual = dcaRecipeToConfig({ ...snapshot, startKind: "immediate" }, {});
assert.equal(appliedManual.ok, true);
if (appliedManual.ok) {
  assert.equal(appliedManual.config.startKind, "indicator");
  assert.equal(appliedManual.config.indicatorKind, "rsi");
  assert.ok(appliedManual.notes[0]?.includes("Manual"));
}

const confirmSnap = snapshotDcaRecipe({
  ...parsed.config,
  confirm: {
    kind: "ema",
    timeframe: "240",
    compare: "gte",
    level: null,
    period: 21,
    multiplier: null,
  },
  exitIf: {
    kind: "rsi",
    timeframe: "15",
    compare: "gte",
    level: 70,
    period: 14,
    multiplier: null,
  },
});
assert.equal(confirmSnap.confirm?.kind, "ema");
assert.equal(confirmSnap.exitIf?.kind, "rsi");
const confirmApplied = dcaRecipeToConfig(confirmSnap, {});
assert.equal(confirmApplied.ok, true);
if (confirmApplied.ok) {
  assert.equal(confirmApplied.config.confirm?.kind, "ema");
  assert.equal(confirmApplied.config.exitIf?.level, 70);
}

const rangeSnap = snapshotDcaRecipe({
  ...parsed.config,
  confirm: {
    kind: "rsi",
    timeframe: "15",
    compare: "between",
    level: 30,
    levelTo: 70,
    period: 14,
    multiplier: null,
  },
  exitIf: {
    kind: "bb",
    timeframe: "60",
    compare: "inside",
    level: null,
    period: 20,
    multiplier: null,
  },
});
const rangeApplied = dcaRecipeToConfig(rangeSnap, {});
assert.equal(rangeApplied.ok, true);
if (rangeApplied.ok) {
  assert.equal(rangeApplied.config.confirm?.compare, "between");
  assert.equal(rangeApplied.config.confirm?.level, 30);
  assert.equal(rangeApplied.config.confirm?.levelTo, 70);
  assert.equal(rangeApplied.config.exitIf?.compare, "inside");
}

const remapped = dcaRecipeToConfig(snapshot, { symbol: "SOLUSDT" });
assert.equal(remapped.ok, true);
if (remapped.ok) {
  assert.equal(remapped.config.symbol, "SOLUSDT");
}

const oldBothRsi = dcaRecipeToConfig(
  {
    ...snapshot,
    startKind: "indicator",
    shortStartKind: "indicator",
    webhookId: null,
    shortWebhookId: null,
    indicatorKind: "rsi",
    indicatorTimeframe: "15",
    indicatorCompare: "cross_lte",
    indicatorLevel: 30,
    shortIndicatorKind: null,
    shortIndicatorTimeframe: null,
    shortIndicatorCompare: null,
    shortIndicatorLevel: null,
  },
  {},
);
assert.equal(oldBothRsi.ok, true);
if (oldBothRsi.ok) {
  assert.equal(oldBothRsi.config.indicatorLevel, 30);
  assert.equal(oldBothRsi.config.shortIndicatorLevel, 70);
  assert.equal(oldBothRsi.config.shortIndicatorCompare, "cross_gte");
}

const hlBoth = dcaRecipeToConfig(snapshot, {
  symbol: "ETH",
  venue: "hyperliquid",
});
assert.equal(hlBoth.ok, true);
if (hlBoth.ok) {
  assert.equal(hlBoth.config.symbol, "ETH");
  assert.equal(hlBoth.config.direction, "long");
  assert.ok(hlBoth.notes.some((note) => /one-way/i.test(note)));
}

assert.equal(parseTemplateRecipe({ name: "x" }, "dca", 1).ok, false);
assert.equal(parseTemplateRecipe(snapshot, "dca", 2).ok, false);
assert.equal(parseTemplateRecipe(snapshot, "flex", 1).ok, false);

const hlCoin = { ...snapshot, symbol: "ETH" };
const hlParsed = parseTemplateRecipe(hlCoin, "dca", 1, "hyperliquid");
assert.equal(hlParsed.ok, true);
if (hlParsed.ok && hlParsed.recipe.kind === "dca") {
  assert.equal(hlParsed.recipe.symbol, "ETH");
}
const hlInferred = parseTemplateRecipe(hlCoin, "dca", 1);
assert.equal(hlInferred.ok, true);
if (hlInferred.ok && hlInferred.recipe.kind === "dca") {
  assert.equal(hlInferred.recipe.symbol, "ETH");
}
assert.equal(parseTemplateRecipe(hlCoin, "dca", 1, "bybit").ok, false);
const bybitParsed = parseTemplateRecipe(snapshot, "dca", 1, "bybit");
assert.equal(bybitParsed.ok, true);
if (bybitParsed.ok && bybitParsed.recipe.kind === "dca") {
  assert.equal(bybitParsed.recipe.symbol, "ETHUSDT");
}
const hlFromPair = parseTemplateRecipe(snapshot, "dca", 1, "hyperliquid");
assert.equal(hlFromPair.ok, true);
if (hlFromPair.ok && hlFromPair.recipe.kind === "dca") {
  assert.equal(hlFromPair.recipe.symbol, "ETH");
}

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
assert.equal(perps.kind, "flex");
assert.equal(perps.tpsl, null);
assert.equal(perps.trailing, null);
assert.equal(recipesMatchForBacktest(perps, { ...perps, name: "Other" }), true);
assert.equal(
  findMatchingLibraryTemplate(
    perps,
    [
      { name: "Library Perps", recipe: { ...perps, name: "Library Perps" }, visibility: "user" },
      { name: "Platform Perps", recipe: { ...perps, name: "Platform Perps" }, visibility: "platform" },
    ],
    "user",
  )?.name,
  "Library Perps",
);
assert.equal(
  findMatchingLibraryTemplate(
    perps,
    [
      { name: "Library Perps", recipe: { ...perps, name: "Library Perps" }, visibility: "user" },
      { name: "Platform Perps", recipe: { ...perps, name: "Platform Perps" }, visibility: "platform" },
    ],
    "platform",
  )?.name,
  "Platform Perps",
);
assert.equal(
  findMatchingLibraryTemplate(perps, [
    { name: "Other", recipe: { ...perps, triggerPrice: "1" }, visibility: "user" },
  ], "user"),
  null,
);
assert.equal(
  recipesMatchForBacktest(perps, { ...perps, triggerPrice: "1" }),
  false,
);
assert.equal(recipesMatchReplayFields(perps, { ...perps, name: "Other" }), true);
assert.equal(
  recipesMatchReplayFields(perps, { ...perps, symbol: "ETHUSDT" }),
  false,
);
assert.equal(
  recipesMatchReplayFields(perps, { ...perps, triggerPrice: "1" }),
  false,
);
assert.equal(
  recipesMatchForBacktest(perps, { ...perps, symbol: "ETHUSDT" }),
  false,
);
assert.equal("mode" in perps, false);
assert.equal("webhookId" in perps, false);
assert.equal(recipeHasRuntimeKeys(perps), false);
const hlPerps = parseTemplateRecipe(
  { ...perps, symbol: "ETH" },
  "flex",
  1,
  "hyperliquid",
);
assert.equal(hlPerps.ok, true);
if (hlPerps.ok && hlPerps.recipe.kind === "flex") {
  assert.equal(hlPerps.recipe.symbol, "ETH");
}
assert.equal(
  parseTemplateRecipe({ ...perps, symbol: "ETH" }, "flex", 1, "bybit").ok,
  false,
);
assert.equal(parseTemplateRecipe(perps, "flex", 1, "bybit").ok, true);
const perpsRule = perpsRecipeToRule(perps, { sortOrder: 3 });
assert.equal(perpsRule.ok, true);
if (perpsRule.ok) {
  assert.equal(perpsRule.rule.mode, "disabled");
  assert.equal(perpsRule.rule.conditionTrue, false);
  assert.equal(perpsRule.rule.id, null);
  assert.equal(perpsRule.rule.sortOrder, 3);
  assert.equal(perpsRule.rule.triggerPrice, 50000);
  assert.equal(perpsRule.rule.tpsl, null);
}

const perpsWithExits = snapshotPerpsRecipe({
  name: "Buy with TP",
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
  tpsl: {
    takeProfit: 55000,
    stopLoss: 48000,
    tpTrigger: "last",
    slTrigger: "mark",
    mode: "full",
    tpQty: null,
    slQty: null,
    tpOrderType: "market",
    slOrderType: "market",
    tpLimitPrice: null,
    slLimitPrice: null,
  },
  trailing: { distance: 200, activePrice: 49000, peak: null },
});
const exitsRule = perpsRecipeToRule(perpsWithExits, { sortOrder: 0 });
assert.equal(exitsRule.ok, true);
if (exitsRule.ok) {
  assert.equal(exitsRule.rule.tpsl?.takeProfit, 55000);
  assert.equal(exitsRule.rule.tpsl?.stopLoss, 48000);
  assert.equal(exitsRule.rule.trailing?.distance, 200);
  assert.equal(exitsRule.rule.trailing?.activePrice, 49000);
}

const flexWithExitActions = snapshotPerpsRecipe({
  name: "Flex Entry — ATR band",
  symbol: "BCHUSDT",
  action: "buy",
  closeSide: null,
  orderType: "market",
  sizeUnit: "qty",
  size: 1,
  limitPrice: null,
  entrySource: "price",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: 1,
  skipIfOpen: true,
  tpsl: null,
  trailing: null,
  breakevenActivationPct: null,
  breakevenOffsetPct: null,
  exitActions: [
    {
      id: "take-profit",
      kind: "take_profit",
      scope: { kind: "all" },
      groups: [{ anchor: { trigger: "target" }, rows: [] }],
      takeProfitPct: 3,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: null,
      trailingDistance: null,
      trailingActivation: null,
      trailingPct: null,
      trailingTriggerPct: null,
      breakevenActivationPct: null,
      breakevenOffsetPct: null,
    },
  ],
});
const loadedFlexExits = parseTemplateRecipe(flexWithExitActions, "flex", 1);
assert.equal(loadedFlexExits.ok, true);
if (loadedFlexExits.ok && loadedFlexExits.recipe.kind === "flex") {
  assert.equal(loadedFlexExits.recipe.exitActions?.length, 1);
  assert.equal(loadedFlexExits.recipe.exitActions?.[0]?.takeProfitPct, 3);
  assert.equal(loadedFlexExits.recipe.breakevenOffsetPct, null);
  assert.equal(
    recipesMatchReplayFields(flexWithExitActions, loadedFlexExits.recipe),
    true,
  );
}

const percentTrail = snapshotPerpsRecipe({
  name: "Advanced - Scale In BTD when Protected + Trailing Stop",
  symbol: "SOLUSDT",
  action: "buy",
  closeSide: null,
  orderType: "market",
  sizeUnit: "usdt",
  size: 500,
  limitPrice: null,
  entrySource: "retrace",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: 1,
  skipIfOpen: true,
  tpsl: null,
  trailing: { distance: 5, activePrice: null, peak: null },
  retrace: { source: "last", from: "high", pct: 5, lookback: 20, timeframe: "60" },
  addStack: {
    leaves: [
      {
        kind: "retrace",
        source: "last",
        from: "high",
        pct: 2,
        lookback: 20,
        timeframe: "15",
      },
      { kind: "protection", is: "protected", amount: "entire", pct: null },
    ],
    joins: ["and", "and"],
  },
  exitActions: [
    {
      id: "trail",
      kind: "trailing_stop",
      scope: { kind: "all" },
      groups: [],
      takeProfitPct: null,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: null,
      trailingDistance: null,
      trailingActivation: null,
      trailingPct: 5,
      trailingTriggerPct: 8,
      breakevenActivationPct: null,
      breakevenOffsetPct: null,
    },
  ],
});
const loadedPercentTrail = parseTemplateRecipe(percentTrail, "flex", 1);
assert.equal(
  loadedPercentTrail.ok,
  true,
  loadedPercentTrail.ok ? "" : loadedPercentTrail.error,
);
if (loadedPercentTrail.ok && loadedPercentTrail.recipe.kind === "flex") {
  assert.equal(loadedPercentTrail.recipe.exitActions?.[0]?.trailingTriggerPct, 8);
  assert.equal(loadedPercentTrail.recipe.exitActions?.[0]?.trailingPct, 5);
  assert.equal(loadedPercentTrail.recipe.trailing?.activePrice ?? null, null);
  assert.equal(loadedPercentTrail.recipe.retrace?.pct, 5);
  assert.equal(loadedPercentTrail.recipe.addStack?.leaves.length, 2);
  assert.equal(
    recipesMatchReplayFields(percentTrail, loadedPercentTrail.recipe),
    true,
  );
}

const shortPercentTrail = snapshotPerpsRecipe({
  name: "Both percent trail",
  symbol: "SOLUSDT",
  action: "buy",
  closeSide: null,
  orderType: "market",
  sizeUnit: "usdt",
  size: 500,
  limitPrice: null,
  entrySource: "price",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: 100,
  skipIfOpen: true,
  tpsl: null,
  trailing: { distance: 5, activePrice: null, peak: null },
  direction: "both",
  exitActions: [
    {
      id: "long-trail",
      kind: "trailing_stop",
      scope: { kind: "all" },
      groups: [],
      takeProfitPct: null,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: null,
      trailingDistance: null,
      trailingActivation: null,
      trailingPct: 5,
      trailingTriggerPct: 8,
      breakevenActivationPct: null,
      breakevenOffsetPct: null,
    },
  ],
  shortEntry: {
    entrySource: "price",
    webhookId: null,
    triggerBy: "last",
    triggerCompare: "lte",
    triggerPrice: 90,
    skipIfOpen: true,
    indicator: null,
    confirm: null,
    entryStack: { leaves: [], joins: [] },
    classic: {
      tpsl: null,
      trailing: { distance: 4, activePrice: null, peak: null },
      breakevenActivationPct: null,
      breakevenOffsetPct: null,
    },
    actions: [
      {
        id: "short-trail",
        kind: "trailing_stop",
        scope: { kind: "all" },
        groups: [],
        takeProfitPct: null,
        takeProfitPrice: null,
        stopLossPct: null,
        stopLossPrice: null,
        trailingDistance: null,
        trailingActivation: null,
        trailingPct: 4,
        trailingTriggerPct: 6,
        breakevenActivationPct: null,
        breakevenOffsetPct: null,
      },
    ],
  },
});
const loadedShortTrail = parseTemplateRecipe(shortPercentTrail, "flex", 1);
assert.equal(
  loadedShortTrail.ok,
  true,
  loadedShortTrail.ok ? "" : loadedShortTrail.error,
);
if (loadedShortTrail.ok && loadedShortTrail.recipe.kind === "flex") {
  assert.equal(loadedShortTrail.recipe.shortEntry?.actions?.[0]?.trailingTriggerPct, 6);
  assert.equal(loadedShortTrail.recipe.shortEntry?.actions?.[0]?.trailingPct, 4);
  assert.equal(loadedShortTrail.recipe.exitActions?.[0]?.trailingTriggerPct, 8);
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
  tpsl: null,
  trailing: null,
});
const coerced = perpsRecipeToRule(webhookPerps, { sortOrder: 0 });
assert.equal(coerced.ok, true);
if (coerced.ok) {
  assert.equal(coerced.rule.entrySource, "webhook");
  assert.equal(coerced.rule.webhookId, null);
  assert.equal(coerced.rule.mode, "disabled");
  assert.equal(coerced.notes.length, 0);
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
  assert.equal(paperLayer.layer.stopLossPct, null);
  assert.equal(paper.stopLossPct, null);
  assert.equal(paperLayer.layer.sortOrder, 2);
}

assert.equal(uniqueAppliedName("Core", []), "Core");
assert.equal(uniqueAppliedName("Core", ["Core"]), "Core (from template)");
assert.equal(
  uniqueAppliedName("Core", ["Core", "Core (from template)"]),
  "Core (from template 2)",
);
assert.equal(recipePreview(snapshot), "ETHUSDT");
assert.equal(recipePreview(paper), "");
assert.equal(storedTemplateRecipe(snapshot).name, "");
assert.equal(snapshot.name, "ETH grid");
assert.equal(botNameFromTemplate("  Grid idea  "), "Grid idea");
assert.equal(botNameFromTemplate("x".repeat(80)).length, 80);
assert.equal(botNameFromTemplate("x".repeat(81)).length, 80);
assert.equal(botNameFromTemplate("   "), "Template");
const unnamed = parseTemplateRecipe({ ...snapshot, name: "" }, "dca", 1);
assert.equal(unnamed.ok, true);
if (unnamed.ok) {
  assert.equal(unnamed.recipe.name, "");
}
const namedRoundTrip = parseTemplateRecipe(snapshot, "dca", 1);
assert.equal(namedRoundTrip.ok, true);
if (namedRoundTrip.ok) {
  assert.equal(namedRoundTrip.recipe.name, "ETH grid");
}
const unnamedPerps = parseTemplateRecipe({ ...perps, name: "" }, "flex", 1);
assert.equal(unnamedPerps.ok, true);
if (unnamedPerps.ok) {
  assert.equal(unnamedPerps.recipe.name, "");
}
const unnamedPaper = parseTemplateRecipe({ ...paper, name: "" }, "cash_and_carry", 1);
assert.equal(unnamedPaper.ok, true);
if (unnamedPaper.ok) {
  assert.equal(unnamedPaper.recipe.name, "");
}

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

const fromState = dcaFormToSnapshotSource(null, {
  name: "DCA 123",
  symbol: "BTCUSDT",
  direction: "long",
  startKind: "immediate",
  averaging: "dip",
  restGrid: false,
  sizeUnit: "usdt",
  clipSize: "1,000",
  maxType: "orders",
  maxClips: "5",
  dipPct: "1.5",
  sizeMultiplier: "1",
  deviationMultiplier: "1",
});
const fromStateParsed = parseDcaPlaybookForm(fromState);
assert.equal(fromStateParsed.ok, true);
if (fromStateParsed.ok) {
  assert.equal(fromStateParsed.config.clipSize, 1000);
  assert.equal(fromStateParsed.config.name, "DCA 123");
  assert.equal(fromStateParsed.config.maxClips, 5);
}

const missingSize = dcaFormToSnapshotSource(null, {
  symbol: "BTCUSDT",
  direction: "long",
  sizeUnit: "usdt",
  clipSize: "",
});
const missingSizeParsed = parseDcaPlaybookForm(missingSize);
assert.equal(missingSizeParsed.ok, false);
if (!missingSizeParsed.ok) {
  assert.equal(missingSizeParsed.error, "Enter an order size.");
}

assert.equal(templateFitsDesk("flex", "flex"), true);
assert.equal(templateFitsDesk("flex", "manual"), false);
assert.equal(templateFitsDesk("dca", "dca"), true);
assert.equal(formatTemplateDeskType("flex"), "Flex");
assert.equal(parseTemplateVisibility("backtested"), "backtested");
assert.equal(parseTemplateVisibility("platform"), "platform");
assert.equal(templateIsLibraryRow("backtested"), false);
assert.equal(templateIsLibraryRow("user"), true);

const bothPerps = snapshotPerpsRecipe({
  name: "Both stack",
  symbol: "BTCUSDT",
  action: "buy",
  closeSide: null,
  orderType: "market",
  sizeUnit: "qty",
  size: 1,
  limitPrice: null,
  entrySource: "price",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: 100,
  skipIfOpen: true,
  tpsl: {
    takeProfit: null,
    stopLoss: 80,
    tpTrigger: "last",
    slTrigger: "last",
    mode: "full",
    tpQty: null,
    slQty: null,
    tpOrderType: "market",
    slOrderType: "market",
    tpLimitPrice: null,
    slLimitPrice: null,
  },
  trailing: null,
  confirm: null,
  direction: "both",
  entryStack: {
    leaves: [{ kind: "price", triggerBy: "last", compare: "gte", price: 130 }],
    joins: ["and"],
  },
  exitHard: { trigger: "price", triggerBy: "last", compare: "lte", price: 90 },
  exitStack: {
    leaves: [{ kind: "price", triggerBy: "last", compare: "lte", price: 70 }],
    joins: ["and"],
  },
  shortEntry: {
    entrySource: "price",
    webhookId: null,
    triggerBy: "last",
    triggerCompare: "lte",
    triggerPrice: 90,
    skipIfOpen: true,
    indicator: null,
    confirm: null,
    entryStack: {
      leaves: [{ kind: "price", triggerBy: "last", compare: "lte", price: 70 }],
      joins: ["or"],
    },
    exitHard: { trigger: "price", triggerBy: "last", compare: "gte", price: 120 },
    exitStack: {
      leaves: [{ kind: "price", triggerBy: "last", compare: "gte", price: 140 }],
      joins: ["and"],
    },
  },
});
const loadedPerps = parseTemplateRecipe(bothPerps, "flex", TEMPLATE_RECIPE_VERSION);
assert.equal(loadedPerps.ok, true);
if (!loadedPerps.ok || loadedPerps.recipe.kind !== "flex") {
  throw new Error("expected a perps recipe");
}
assert.equal(loadedPerps.recipe.direction, "both");
assert.equal(loadedPerps.recipe.entryStack?.leaves.length, 1);
assert.equal(loadedPerps.recipe.shortEntry?.triggerPrice, 90);
assert.equal(loadedPerps.recipe.shortEntry?.entryStack.leaves.length, 1);
assert.equal(loadedPerps.recipe.shortEntry?.exitHard?.trigger, "price");
const shortAddPerps = snapshotPerpsRecipe({
  name: "Short add",
  symbol: "SOLUSDT",
  action: "buy",
  closeSide: null,
  orderType: "market",
  sizeUnit: "usdt",
  size: 500,
  limitPrice: null,
  entrySource: "retrace",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: 1,
  skipIfOpen: true,
  tpsl: null,
  trailing: null,
  retrace: { source: "last", from: "high", pct: 5, lookback: 20, timeframe: "60" },
  confirm: null,
  direction: "both",
  shortEntry: {
    entrySource: "retrace",
    webhookId: null,
    triggerBy: "last",
    triggerCompare: "lte",
    triggerPrice: 1,
    skipIfOpen: true,
    indicator: null,
    retrace: { source: "last", from: "low", pct: 5, lookback: 20, timeframe: "15" },
    confirm: null,
    entryStack: { leaves: [], joins: [] },
    addStack: {
      leaves: [
        {
          kind: "retrace",
          source: "last",
          from: "low",
          pct: 2,
          lookback: 20,
          timeframe: "15",
        },
      ],
      joins: ["and"],
      orders: [
        { size: "500", sizeUnit: "usdt", orderType: "market", limitPrice: "" },
      ],
    },
  },
});
const loadedShortAdd = parseTemplateRecipe(shortAddPerps, "flex", TEMPLATE_RECIPE_VERSION);
assert.equal(loadedShortAdd.ok, true);
if (!loadedShortAdd.ok || loadedShortAdd.recipe.kind !== "flex") {
  throw new Error("expected a short additional-order recipe");
}
assert.equal(loadedShortAdd.recipe.shortEntry?.addStack?.leaves[0]?.kind, "retrace");
assert.equal(loadedShortAdd.recipe.shortEntry?.addStack?.leaves[0]?.pct, 2);
assert.equal(loadedShortAdd.recipe.shortEntry?.addStack?.orders?.[0]?.size, "500");
const shortAddSeed = perpsRecipeFormSeed(loadedShortAdd.recipe);
assert.equal(shortAddSeed.shortEntry?.addStack?.leaves.length, 1);
assert.equal(loadedPerps.recipe.exitStack?.leaves.length, 1);
const perpsSeed = perpsRecipeFormSeed(loadedPerps.recipe);
assert.equal(perpsSeed.direction, "both");
assert.equal(perpsSeed.shortEntry?.triggerPrice, 90);
assert.equal(perpsSeed.entryStack.leaves.length, 1);
assert.equal(perpsSeed.shortEntry?.exitStack?.leaves.length, 1);
const perpsDrafts = initialPerpsEntryDrafts(perpsSeed);
assert.equal(perpsDrafts.long.entrySource, "price");
assert.equal(perpsDrafts.long.triggerPrice, "100");
assert.equal(perpsDrafts.long.entryRows.length, 1);
assert.equal(perpsDrafts.short.entrySource, "price");
assert.equal(perpsDrafts.short.triggerPrice, "90");
assert.equal(perpsDrafts.short.entryRows.length, 1);
assert.equal(perpsDrafts.short.entryRows[0]?.join, "or");
assert.equal(exitRowsFromStack(perpsSeed.exitStack).length, 1);
assert.equal(exitRowsFromStack(perpsSeed.shortEntry?.exitStack).length, 1);
const trailedPerps = perpsRecipeFormSeed({
  ...loadedPerps.recipe,
  entrySource: "retrace",
  retrace: {
    source: "last",
    from: "high",
    pct: 5,
    lookback: 20,
    timeframe: "60",
  },
  exitActions: [
    {
      id: "trail",
      kind: "trailing_stop",
      scope: { kind: "all" },
      groups: [{ anchor: { trigger: "webhook", webhookId: "arm" }, rows: [] }],
      takeProfitPct: null,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: null,
      trailingDistance: null,
      trailingActivation: null,
      trailingPct: 5,
      trailingTriggerPct: 8,
    },
  ],
});
assert.equal(trailedPerps.retrace?.pct, 5);
assert.equal(trailedPerps.exitActions?.[0]?.trailingTriggerPct, 8);
assert.equal(trailedPerps.exitActions?.[0]?.trailingPct, 5);
const scaleIn = perpsRecipeToRule(
  {
    ...loadedPerps.recipe,
    name: "Scale in",
    symbol: "SOLUSDT",
    entrySource: "retrace",
    size: "500",
    sizeUnit: "usdt",
    triggerPrice: "0",
    retrace: {
      source: "last",
      from: "high",
      pct: 5,
      lookback: 20,
      timeframe: "60",
    },
    exitActions: trailedPerps.exitActions,
  },
  { sortOrder: 0 },
);
assert.equal(scaleIn.ok, true);
if (scaleIn.ok) {
  assert.equal(scaleIn.rule.retrace?.pct, 5);
  assert.equal(scaleIn.rule.exitActions?.[0]?.trailingTriggerPct, 8);
}

const legacyConfirm = snapshotPerpsRecipe({
  name: "Confirm only",
  symbol: "BTCUSDT",
  action: "buy",
  closeSide: null,
  orderType: "market",
  sizeUnit: "qty",
  size: 1,
  limitPrice: null,
  entrySource: "price",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: 100,
  skipIfOpen: true,
  tpsl: null,
  trailing: null,
  confirm: {
    kind: "ema",
    timeframe: "60",
    compare: "gte",
    level: null,
    period: 21,
    multiplier: null,
  },
  direction: "long",
});
const legacyLoaded = parseTemplateRecipe(
  legacyConfirm,
  "flex",
  TEMPLATE_RECIPE_VERSION,
);
assert.equal(legacyLoaded.ok, true);
if (!legacyLoaded.ok || legacyLoaded.recipe.kind !== "flex") {
  throw new Error("expected a perps recipe");
}
const legacySeed = perpsRecipeFormSeed(legacyLoaded.recipe);
assert.equal(legacySeed.direction, "long");
assert.equal(legacySeed.entryStack.leaves.length, 1);
assert.equal(initialPerpsEntryDrafts(legacySeed).long.entryRows.length, 1);

const bothDca = new FormData();
bothDca.set("name", "Both stack");
bothDca.set("symbol", "BTCUSDT");
bothDca.set("direction", "both");
bothDca.set("startKind", "price");
bothDca.set("armTriggerBy", "last");
bothDca.set("armCompare", "gte");
bothDca.set("armPrice", "100");
bothDca.set("shortStartKind", "price");
bothDca.set("shortArmTriggerBy", "last");
bothDca.set("shortArmCompare", "lte");
bothDca.set("shortArmPrice", "90");
bothDca.set("clipSize", "1");
bothDca.set("sizeUnit", "qty");
bothDca.set("entryCount", "1");
bothDca.set("entry0Join", "and");
bothDca.set("entry0Source", "price");
bothDca.set("entry0TriggerBy", "last");
bothDca.set("entry0TriggerCompare", "gte");
bothDca.set("entry0TriggerPrice", "130");
bothDca.set("short_entryCount", "1");
bothDca.set("short_entry0Join", "or");
bothDca.set("short_entry0Source", "price");
bothDca.set("short_entry0TriggerBy", "last");
bothDca.set("short_entry0TriggerCompare", "lte");
bothDca.set("short_entry0TriggerPrice", "70");
const bothDcaParsed = parseDcaPlaybookForm(bothDca);
assert.equal(bothDcaParsed.ok, true);
if (!bothDcaParsed.ok) {
  throw new Error("expected a DCA playbook");
}
const bothDcaRecipe = snapshotDcaRecipe(bothDcaParsed.config);
const loadedDca = parseTemplateRecipe(bothDcaRecipe, "dca", TEMPLATE_RECIPE_VERSION);
assert.equal(loadedDca.ok, true);
if (!loadedDca.ok || loadedDca.recipe.kind !== "dca") {
  throw new Error("expected a dca recipe");
}
assert.equal(loadedDca.recipe.direction, "both");
assert.equal(loadedDca.recipe.entryStack?.leaves.length, 1);
assert.equal(loadedDca.recipe.shortEntryStack?.leaves.length, 1);
const dcaSeed = dcaRecipePlaybookSeed(loadedDca.recipe);
assert.equal(dcaSeed.direction, "both");
assert.equal(dcaSeed.shortStartKind, "price");
const trailedDca = dcaRecipePlaybookSeed({
  ...loadedDca.recipe,
  exitActions: [
    {
      id: "trail",
      kind: "trailing_stop",
      scope: { kind: "all" },
      groups: [{ anchor: { trigger: "webhook", webhookId: "arm" }, rows: [] }],
      takeProfitPct: null,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: null,
      trailingDistance: null,
      trailingActivation: null,
      trailingPct: 5,
      trailingTriggerPct: 8,
    },
  ],
  shortExitActions: [
    {
      id: "short-trail",
      kind: "trailing_stop",
      scope: { kind: "all" },
      groups: [{ anchor: { trigger: "webhook", webhookId: "arm" }, rows: [] }],
      takeProfitPct: null,
      takeProfitPrice: null,
      stopLossPct: null,
      stopLossPrice: null,
      trailingDistance: null,
      trailingActivation: null,
      trailingPct: 4,
      trailingTriggerPct: 6,
    },
  ],
});
assert.equal(trailedDca.exitActions?.[0]?.trailingTriggerPct, 8);
assert.equal(trailedDca.shortExitActions?.[0]?.trailingTriggerPct, 6);
assert.equal(entryRowsFromSources(dcaSeed.entryStack, dcaSeed.confirm).length, 1);
assert.equal(
  entryRowsFromSources(dcaSeed.shortEntryStack, dcaSeed.shortConfirm).length,
  1,
);
assert.equal(
  entryRowsFromSources(dcaSeed.shortEntryStack, dcaSeed.shortConfirm)[0]?.join,
  "or",
);

const longHook = "22222222-2222-4222-8222-222222222222";
const shortHook = "55555555-5555-4555-8555-555555555555";
const addHook = "66666666-6666-4666-8666-666666666666";
const marketGod = new FormData();
marketGod.set("deskVenue", "bybit");
marketGod.set("ruleCount", "1");
marketGod.set("r0_name", "Market God BTC 30m");
marketGod.set("r0_symbol", "BTCUSDT");
marketGod.set("r0_action", "buy");
marketGod.set("r0_direction", "both");
marketGod.set("r0_orderType", "market");
marketGod.set("r0_sizeUnit", "usdt");
marketGod.set("r0_size", "1");
marketGod.set("r0_entrySource", "webhook");
marketGod.set("r0_webhookId", longHook);
marketGod.set("r0_exitIfTrigger", "webhook");
marketGod.set("r0_exitIfWebhookId", longHook);
marketGod.set("r0_entryCount", "1");
marketGod.set("r0_entry0Join", "or");
marketGod.set("r0_entry0Source", "price");
marketGod.set("r0_entry0TriggerBy", "last");
marketGod.set("r0_entry0TriggerCompare", "gte");
marketGod.set("r0_entry0TriggerPrice", "100");
marketGod.set(
  "r0_addExpr",
  JSON.stringify({
    leaves: [{ kind: "webhook", webhookId: addHook }],
    joins: ["and"],
  }),
);
marketGod.set("r0_short_entrySource", "webhook");
marketGod.set("r0_short_webhookId", shortHook);
marketGod.set("r0_short_size", "1");
marketGod.set("r0_short_sizeUnit", "usdt");
marketGod.set("r0_short_orderType", "market");
marketGod.set("r0_short_exitIfTrigger", "webhook");
marketGod.set("r0_short_exitIfWebhookId", shortHook);
const marketParsed = parseFuturesAutomationForm(marketGod);
assert.equal(marketParsed.ok, true, marketParsed.ok ? "" : marketParsed.error);
if (!marketParsed.ok) {
  throw new Error("expected the webhook bot to parse");
}
const marketSnap = snapshotPerpsRecipe(marketParsed.rules[0]);
assert.equal(marketSnap.entrySource, "webhook");
assert.equal(marketSnap.webhookId ?? null, null);
assert.equal(marketSnap.exitHard?.trigger, "webhook");
if (marketSnap.exitHard?.trigger === "webhook") {
  assert.equal(marketSnap.exitHard.webhookId, undefined);
}
assert.equal(marketSnap.shortEntry?.entrySource, "webhook");
assert.equal(marketSnap.shortEntry?.webhookId ?? null, null);
assert.equal(marketSnap.shortEntry?.exitHard?.trigger, "webhook");
if (marketSnap.shortEntry?.exitHard?.trigger === "webhook") {
  assert.equal(marketSnap.shortEntry.exitHard.webhookId, "");
}
const addLeaf = marketSnap.addStack?.leaves[0];
assert.equal(addLeaf?.kind, "webhook");
if (addLeaf?.kind === "webhook") {
  assert.equal(addLeaf.webhookId, "template-webhook");
}
assert.equal(recipeHasRuntimeKeys(marketSnap), false);
assert.equal(JSON.stringify(marketSnap).includes(longHook), false);
assert.equal(JSON.stringify(marketSnap).includes(shortHook), false);
assert.equal(JSON.stringify(marketSnap).includes(addHook), false);
const marketLoaded = parseTemplateRecipe(marketSnap, "flex", TEMPLATE_RECIPE_VERSION);
assert.equal(marketLoaded.ok, true, marketLoaded.ok ? "" : marketLoaded.error);
if (!marketLoaded.ok || marketLoaded.recipe.kind !== "flex") {
  throw new Error("expected the webhook template to load");
}
assert.equal(marketLoaded.recipe.webhookId ?? null, null);
assert.equal(marketLoaded.recipe.entrySource, "webhook");
if (marketLoaded.recipe.exitHard?.trigger === "webhook") {
  assert.equal(marketLoaded.recipe.exitHard.webhookId ?? null, null);
}
const storedHooks = {
  ...marketLoaded.recipe,
  webhookId: longHook,
  shortEntry: marketLoaded.recipe.shortEntry
    ? { ...marketLoaded.recipe.shortEntry, webhookId: shortHook }
    : marketLoaded.recipe.shortEntry,
};
const marketApplied = perpsRecipeToRule(storedHooks, {
  sortOrder: 0,
  webhookId: "44444444-4444-4444-8444-444444444444",
});
assert.equal(marketApplied.ok, true, marketApplied.ok ? "" : marketApplied.error);
if (marketApplied.ok) {
  assert.equal(marketApplied.rule.entrySource, "webhook");
  assert.equal(marketApplied.rule.webhookId, null);
  assert.equal(marketApplied.rule.triggerPrice, 1);
  assert.equal(marketApplied.rule.exitHard?.trigger, "webhook");
  if (marketApplied.rule.exitHard?.trigger === "webhook") {
    assert.equal(marketApplied.rule.exitHard.webhookId, "");
  }
  assert.equal(marketApplied.rule.shortEntry?.entrySource, "webhook");
  assert.equal(marketApplied.rule.shortEntry?.webhookId, null);
  assert.equal(marketApplied.rule.shortEntry?.exitHard?.trigger, "webhook");
  if (marketApplied.rule.shortEntry?.exitHard?.trigger === "webhook") {
    assert.equal(marketApplied.rule.shortEntry.exitHard.webhookId, "");
  }
  const appliedAdd = marketApplied.rule.addStack?.leaves[0];
  assert.equal(appliedAdd?.kind, "webhook");
  if (appliedAdd?.kind === "webhook") {
    assert.equal(appliedAdd.webhookId, "");
  }
  const appliedOr = marketApplied.rule.entryStack.leaves.find(
    (leaf) => leaf.kind === "price",
  );
  assert.equal(appliedOr?.kind, "price");
  assert.equal(marketApplied.notes.length, 0);
  assert.equal(JSON.stringify(marketApplied.rule).includes(longHook), false);
  assert.equal(JSON.stringify(marketApplied.rule).includes(shortHook), false);
  const marketRow = futuresAutomationToRow(
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
    marketApplied.rule,
  );
  const marketReloaded = parseFuturesAutomationRow(marketRow, "bybit");
  assert.equal(marketReloaded.entrySource, "webhook");
  assert.equal(marketReloaded.webhookId, null);
  assert.equal(marketReloaded.name, "Market God BTC 30m");
  assert.equal(marketReloaded.exitHard?.trigger, "webhook");
  if (marketReloaded.exitHard?.trigger === "webhook") {
    assert.equal(marketReloaded.exitHard.webhookId, "");
  }
  assert.equal(marketReloaded.shortEntry?.entrySource, "webhook");
  assert.equal(marketReloaded.shortEntry?.webhookId, null);
  const reloadedAdd = marketReloaded.addStack?.leaves[0];
  assert.equal(reloadedAdd?.kind, "webhook");
  if (reloadedAdd?.kind === "webhook") {
    assert.equal(reloadedAdd.webhookId, "");
  }
}
const marketSeed = perpsRecipeFormSeed(marketLoaded.recipe);
assert.equal(marketSeed.entrySource, "webhook");
assert.equal(marketSeed.webhookId, "");
assert.equal(marketSeed.exitDraft?.trigger, "webhook");
if (marketSeed.exitDraft?.trigger === "webhook") {
  assert.equal(marketSeed.exitDraft.webhookId, "");
}
assert.equal(marketSeed.shortEntry?.webhookId ?? null, null);

function conditionBot(fields: { [key: string]: string | undefined }) {
  const bot = new FormData();
  bot.set("deskVenue", "bybit");
  bot.set("ruleCount", "1");
  bot.set("r0_name", "Condition");
  bot.set("r0_symbol", "BTCUSDT");
  bot.set("r0_action", "buy");
  bot.set("r0_orderType", "market");
  bot.set("r0_sizeUnit", "usdt");
  bot.set("r0_size", "1");
  for (const [key, value] of Object.entries(fields)) {
    if (value != null) {
      bot.set(key, value);
    }
  }
  return bot;
}

for (const fields of [
  {
    r0_entrySource: "price",
    r0_triggerBy: "last",
    r0_triggerCompare: "gte",
    r0_triggerPrice: "100",
    r0_exitIfTrigger: "price",
    r0_exitIfTriggerBy: "last",
    r0_exitIfTriggerCompare: "lte",
    r0_exitIfTriggerPrice: "90",
  },
  {
    r0_entrySource: "indicator",
    r0_indicatorKind: "rsi",
    r0_indicatorTimeframe: "15",
    r0_indicatorCompare: "cross_lte",
    r0_indicatorLevel: "30",
    r0_indicatorPeriod: "14",
  },
  {
    r0_entrySource: "trend",
    r0_indicatorKind: "supertrend",
    r0_indicatorTimeframe: "60",
    r0_indicatorCompare: "gte",
    r0_indicatorPeriod: "10",
    r0_indicatorMultiplier: "3",
  },
  {
    r0_entrySource: "retrace",
    r0_RetraceSource: "last",
    r0_RetraceFrom: "high",
    r0_RetracePct: "5",
    r0_RetraceLookback: "20",
    r0_RetraceTimeframe: "60",
  },
]) {
  const parsedKind = parseFuturesAutomationForm(conditionBot(fields));
  assert.equal(parsedKind.ok, true, parsedKind.ok ? "" : parsedKind.error);
  if (!parsedKind.ok) {
    continue;
  }
  const kindSnap = snapshotPerpsRecipe(parsedKind.rules[0]);
  const kindLoaded = parseTemplateRecipe(kindSnap, "flex", TEMPLATE_RECIPE_VERSION);
  assert.equal(kindLoaded.ok, true, kindLoaded.ok ? "" : kindLoaded.error);
  if (!kindLoaded.ok || kindLoaded.recipe.kind !== "flex") {
    continue;
  }
  const kindApplied = perpsRecipeToRule(kindLoaded.recipe, { sortOrder: 0 });
  assert.equal(kindApplied.ok, true, kindApplied.ok ? "" : kindApplied.error);
  if (kindApplied.ok) {
    assert.equal(kindApplied.rule.entrySource, parsedKind.rules[0].entrySource);
    assert.deepEqual(kindApplied.rule.indicator, parsedKind.rules[0].indicator);
    assert.deepEqual(kindApplied.rule.retrace ?? null, parsedKind.rules[0].retrace ?? null);
    assert.equal(kindApplied.rule.exitHard?.trigger ?? null, parsedKind.rules[0].exitHard?.trigger ?? null);
  }
}

const dcaHooks = new FormData();
dcaHooks.set("name", "DCA signals");
dcaHooks.set("symbol", "BTCUSDT");
dcaHooks.set("direction", "both");
dcaHooks.set("clipSize", "1");
dcaHooks.set("sizeUnit", "usdt");
dcaHooks.set("startKind", "webhook");
dcaHooks.set("webhookId", longHook);
dcaHooks.set("shortStartKind", "webhook");
dcaHooks.set("shortWebhookId", shortHook);
dcaHooks.set("exitIfTrigger", "webhook");
dcaHooks.set("exitIfWebhookId", longHook);
dcaHooks.set("shortExitIfTrigger", "webhook");
dcaHooks.set("shortExitIfWebhookId", shortHook);
dcaHooks.set("exitIfStackCount", "1");
dcaHooks.set("exitIfStack0Join", "or");
dcaHooks.set("exitIfStack0Trigger", "webhook");
dcaHooks.set("exitIfStack0WebhookId", addHook);
const dcaHookParsed = parseDcaPlaybookForm(dcaHooks);
assert.equal(dcaHookParsed.ok, true, dcaHookParsed.ok ? "" : dcaHookParsed.error);
if (dcaHookParsed.ok) {
  const dcaHookSnap = snapshotDcaRecipe(dcaHookParsed.config);
  assert.equal(dcaHookSnap.webhookId ?? null, null);
  assert.equal(dcaHookSnap.shortWebhookId ?? null, null);
  assert.equal(dcaHookSnap.startKind, "webhook");
  assert.equal(recipeHasRuntimeKeys(dcaHookSnap), false);
  assert.equal(JSON.stringify(dcaHookSnap).includes(longHook), false);
  assert.equal(JSON.stringify(dcaHookSnap).includes(shortHook), false);
  assert.equal(JSON.stringify(dcaHookSnap).includes(addHook), false);
  const dcaHookLoaded = parseTemplateRecipe(dcaHookSnap, "dca", TEMPLATE_RECIPE_VERSION);
  assert.equal(dcaHookLoaded.ok, true, dcaHookLoaded.ok ? "" : dcaHookLoaded.error);
  if (dcaHookLoaded.ok && dcaHookLoaded.recipe.kind === "dca") {
    const dcaHookApplied = dcaRecipeToConfig(
      {
        ...dcaHookLoaded.recipe,
        webhookId: longHook,
        shortWebhookId: shortHook,
      },
      { webhookId: "44444444-4444-4444-8444-444444444444" },
    );
    assert.equal(dcaHookApplied.ok, true, dcaHookApplied.ok ? "" : dcaHookApplied.error);
    if (dcaHookApplied.ok) {
      assert.equal(dcaHookApplied.config.startKind, "webhook");
      assert.equal(dcaHookApplied.config.webhookId, null);
      assert.equal(dcaHookApplied.config.shortStartKind, "webhook");
      assert.equal(dcaHookApplied.config.shortWebhookId, null);
      assert.equal(dcaHookApplied.config.exitHard?.trigger, "webhook");
      if (dcaHookApplied.config.exitHard?.trigger === "webhook") {
        assert.equal(dcaHookApplied.config.exitHard.webhookId, "");
      }
      assert.equal(dcaHookApplied.config.shortExitHard?.trigger, "webhook");
      if (dcaHookApplied.config.shortExitHard?.trigger === "webhook") {
        assert.equal(dcaHookApplied.config.shortExitHard.webhookId, "");
      }
      const dcaStackLeaf = dcaHookApplied.config.exitStack?.leaves[0];
      assert.equal(dcaStackLeaf?.kind, "webhook");
      if (dcaStackLeaf?.kind === "webhook") {
        assert.equal(dcaStackLeaf.webhookId, "");
      }
      assert.equal(JSON.stringify(dcaHookApplied.config).includes(longHook), false);
      assert.equal(JSON.stringify(dcaHookApplied.config).includes(addHook), false);
    }
  }
}

console.log("templates recipe ok");
