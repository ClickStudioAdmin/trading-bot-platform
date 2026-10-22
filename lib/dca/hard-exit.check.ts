import assert from "node:assert/strict";
import { parseDcaPlaybookForm } from "./playbook";
import {
  dcaRecipeToConfig,
  recipeHasRuntimeKeys,
  snapshotDcaRecipe,
} from "@/lib/templates/recipe";
import {
  hardExitDraftFromStored,
  hardExitMet,
  parseHardExitForm,
} from "./hard-exit";

function baseForm(): FormData {
  const form = new FormData();
  form.set("name", "Hard exit");
  form.set("symbol", "BTCUSDT");
  form.set("direction", "long");
  form.set("startKind", "immediate");
  form.set("clipSize", "1");
  form.set("sizeUnit", "qty");
  return form;
}

const legacy = baseForm();
legacy.set("exitIfKind", "rsi");
legacy.set("exitIfTimeframe", "5");
legacy.set("exitIfCompare", "gte");
legacy.set("exitIfLevel", "70");
legacy.set("exitIfPeriod", "14");
const legacyParsed = parseDcaPlaybookForm(legacy);
assert.equal(legacyParsed.ok, true);
if (!legacyParsed.ok) {
  throw new Error("legacy hard exit should parse");
}
assert.equal(legacyParsed.config.exitIf?.kind, "rsi");
assert.equal(legacyParsed.config.exitHard ?? null, null);
assert.equal(
  hardExitDraftFromStored(legacyParsed.config.exitIf, null)?.trigger,
  "indicator",
);

const trendLegacy = baseForm();
trendLegacy.set("exitIfKind", "supertrend");
trendLegacy.set("exitIfTimeframe", "240");
trendLegacy.set("exitIfCompare", "lte");
trendLegacy.set("exitIfPeriod", "10");
trendLegacy.set("exitIfMultiplier", "3");
const trendLegacyParsed = parseDcaPlaybookForm(trendLegacy);
assert.equal(trendLegacyParsed.ok, true);
if (trendLegacyParsed.ok) {
  assert.equal(trendLegacyParsed.config.exitIf?.kind, "supertrend");
  assert.equal(
    hardExitDraftFromStored(trendLegacyParsed.config.exitIf, null)?.trigger,
    "trend",
  );
}

const macdExit = baseForm();
macdExit.set("exitIfTrigger", "indicator");
macdExit.set("exitIfKind", "macd");
macdExit.set("exitIfTimeframe", "60");
macdExit.set("exitIfCompare", "cross_gte");
macdExit.set("exitIfLevel", "0");
const macdExitParsed = parseDcaPlaybookForm(macdExit);
assert.equal(macdExitParsed.ok, true);
if (macdExitParsed.ok) {
  assert.equal(macdExitParsed.config.exitIf?.kind, "macd");
  assert.equal(macdExitParsed.config.exitIf?.compare, "cross_gte");
  assert.equal(macdExitParsed.config.exitIf?.level, 0);
  assert.equal(macdExitParsed.config.exitIf?.period, null);
}

const crossExit = baseForm();
crossExit.set("exitIfTrigger", "indicator");
crossExit.set("exitIfKind", "ema_cross");
crossExit.set("exitIfTimeframe", "240");
crossExit.set("exitIfCompare", "cross_lte");
crossExit.set("exitIfPeriod", "9");
crossExit.set("exitIfSlowPeriod", "21");
const crossExitParsed = parseDcaPlaybookForm(crossExit);
assert.equal(crossExitParsed.ok, true);
if (crossExitParsed.ok) {
  assert.equal(crossExitParsed.config.exitIf?.kind, "ema_cross");
  assert.equal(crossExitParsed.config.exitIf?.compare, "cross_lte");
  assert.equal(crossExitParsed.config.exitIf?.period, 9);
  assert.equal(crossExitParsed.config.exitIf?.slowPeriod, 21);
}

const indicator = baseForm();
indicator.set("exitIfTrigger", "indicator");
indicator.set("exitIfKind", "ema");
indicator.set("exitIfTimeframe", "60");
indicator.set("exitIfCompare", "gte");
indicator.set("exitIfPeriod", "21");
const indicatorParsed = parseDcaPlaybookForm(indicator);
assert.equal(indicatorParsed.ok, true);
if (indicatorParsed.ok) {
  assert.equal(indicatorParsed.config.exitIf?.kind, "ema");
  assert.equal(indicatorParsed.config.exitIf?.timeframe, "60");
  assert.equal(indicatorParsed.config.exitHard ?? null, null);
}

const forcedTrend = baseForm();
forcedTrend.set("exitIfTrigger", "trend");
forcedTrend.set("exitIfKind", "ema");
forcedTrend.set("exitIfTimeframe", "60");
forcedTrend.set("exitIfPeriod", "21");
const forcedParsed = parseDcaPlaybookForm(forcedTrend);
assert.equal(forcedParsed.ok, true);
if (forcedParsed.ok) {
  assert.equal(forcedParsed.config.exitIf?.kind, "supertrend");
  assert.equal(forcedParsed.config.exitIf?.timeframe, "60");
}

const price = baseForm();
price.set("exitIfTrigger", "price");
price.set("exitIfTriggerBy", "mark");
price.set("exitIfTriggerCompare", "lte");
price.set("exitIfTriggerPrice", "100");
const priceParsed = parseDcaPlaybookForm(price);
assert.equal(priceParsed.ok, true);
if (!priceParsed.ok) {
  throw new Error("price hard exit should parse");
}
assert.equal(priceParsed.config.exitIf ?? null, null);
assert.deepEqual(priceParsed.config.exitHard, {
  trigger: "price",
  triggerBy: "mark",
  compare: "lte",
  price: 100,
});
const priceSnap = snapshotDcaRecipe(priceParsed.config);
assert.equal(priceSnap.exitIf, null);
assert.equal(priceSnap.exitHard?.trigger, "price");
assert.equal(recipeHasRuntimeKeys(priceSnap), false);
const priceApplied = dcaRecipeToConfig(priceSnap, { venue: "bybit" });
assert.equal(priceApplied.ok, true);
if (priceApplied.ok) {
  assert.equal(priceApplied.config.exitHard?.trigger, "price");
  if (priceApplied.config.exitHard?.trigger === "price") {
    assert.equal(priceApplied.config.exitHard.price, 100);
    assert.equal(priceApplied.config.exitHard.triggerBy, "mark");
  }
}

const missingPrice = parseHardExitForm(baseForm(), "exitIf", "Hard Exit");
const blankPrice = baseForm();
blankPrice.set("exitIfTrigger", "price");
const blankPriceParsed = parseDcaPlaybookForm(blankPrice);
assert.equal(blankPriceParsed.ok, false);
if (!blankPriceParsed.ok) {
  assert.equal(blankPriceParsed.error, "Enter a Hard Exit price.");
}
assert.equal(missingPrice.ok, true);

const webhookId = "22222222-2222-4222-8222-222222222222";
const webhook = baseForm();
webhook.set("exitIfTrigger", "webhook");
webhook.set("exitIfWebhookId", webhookId);
const webhookParsed = parseDcaPlaybookForm(webhook);
assert.equal(webhookParsed.ok, true);
if (!webhookParsed.ok) {
  throw new Error("webhook hard exit should parse");
}
assert.equal(webhookParsed.config.exitHard?.trigger, "webhook");
const webhookSnap = snapshotDcaRecipe(webhookParsed.config);
assert.equal(webhookSnap.exitHard?.trigger, "webhook");
assert.equal("webhookId" in webhookSnap, false);
if (webhookSnap.exitHard?.trigger === "webhook") {
  assert.equal(webhookSnap.exitHard.webhookId, undefined);
}
assert.equal(JSON.stringify(webhookSnap).includes(webhookId), false);
assert.equal(recipeHasRuntimeKeys(webhookSnap), false);
const webhookOff = dcaRecipeToConfig(webhookSnap, { venue: "bybit" });
assert.equal(webhookOff.ok, true);
if (webhookOff.ok && webhookOff.config.exitHard?.trigger === "webhook") {
  assert.equal(webhookOff.config.exitHard.webhookId, "");
  assert.equal(
    webhookOff.notes.some((note) => note.includes("Hard Exit")),
    false,
  );
}
const webhookOn = dcaRecipeToConfig(webhookSnap, {
  venue: "bybit",
  webhookId: "44444444-4444-4444-8444-444444444444",
});
assert.equal(webhookOn.ok, true);
if (webhookOn.ok && webhookOn.config.exitHard?.trigger === "webhook") {
  assert.equal(webhookOn.config.exitHard.webhookId, "");
}
const unboundExit = {
  ...webhookSnap,
  exitHard: { trigger: "webhook" as const, webhookId },
};
const unboundApplied = dcaRecipeToConfig(unboundExit, { venue: "bybit" });
assert.equal(unboundApplied.ok, true);
if (unboundApplied.ok && unboundApplied.config.exitHard?.trigger === "webhook") {
  assert.equal(unboundApplied.config.exitHard.webhookId, "");
  assert.equal(
    unboundApplied.notes.some((note) => note.includes("Hard Exit")),
    false,
  );
}

const missingHook = baseForm();
missingHook.set("exitIfTrigger", "webhook");
const missingHookParsed = parseDcaPlaybookForm(missingHook);
assert.equal(missingHookParsed.ok, false);
if (!missingHookParsed.ok) {
  assert.equal(missingHookParsed.error, "Choose a Hard Exit signal webhook.");
}

assert.equal(
  hardExitMet({
    signal: { trigger: "price", triggerBy: "last", compare: "gte", price: 100 },
    side: "long",
    prices: { last: 100, mark: 90, index: 90 },
  }),
  true,
);
assert.equal(
  hardExitMet({
    signal: { trigger: "price", triggerBy: "last", compare: "lte", price: 100 },
    side: "long",
    prices: { last: 101, mark: 90, index: 90 },
  }),
  false,
);
assert.equal(
  hardExitMet({
    signal: { trigger: "webhook", webhookId },
    side: "long",
  }),
  false,
);
assert.equal(
  hardExitMet({
    signal: { trigger: "webhook", webhookId },
    side: "long",
    firedWebhookId: webhookId,
  }),
  true,
);
assert.equal(
  hardExitMet({
    signal: { trigger: "webhook", webhookId },
    side: "long",
    firedWebhookId: webhookId,
    signalSide: "short",
  }),
  true,
);
assert.equal(
  hardExitMet({
    signal: { trigger: "webhook", webhookId },
    side: "long",
    firedWebhookId: webhookId,
    signalSide: "long",
  }),
  false,
);
assert.equal(
  hardExitMet({
    signal: { trigger: "webhook", webhookId },
    side: "short",
    firedWebhookId: webhookId,
    signalSide: "long",
  }),
  true,
);
assert.equal(
  hardExitMet({
    signal: { trigger: "webhook", webhookId },
    side: "short",
    firedWebhookId: webhookId,
    signalSide: null,
  }),
  false,
);
assert.equal(
  hardExitMet({
    filter: legacyParsed.config.exitIf,
    side: "long",
    closes: [],
  }),
  false,
);
