import assert from "node:assert/strict";
import { claimsConflict } from "@/lib/strategy/conflicts";
import { entryStackFromJson } from "@/lib/strategy/expr";
import {
  dcaRecipeToConfig,
  recipeHasRuntimeKeys,
  snapshotDcaRecipe,
} from "@/lib/templates/recipe";
import { defaultHardExit, parseHardExitForm } from "./hard-exit";
import { parseDcaPlaybookForm } from "./playbook";
import {
  TEMPLATE_EXIT_WEBHOOK_ID,
  persistWebhookId,
  exitExpressionMet,
  exitStackError,
  exitStackMet,
  exitStackNeedsWebhook,
  hardExitClaim,
  parseExitStackForm,
  templateExitStack,
} from "./exit-stack";

assert.equal(
  exitStackMet({ first: false, leaves: [true], joins: ["and"] }),
  false,
);
assert.equal(
  exitStackMet({ first: false, leaves: [true], joins: ["or"] }),
  true,
);

function baseForm(): FormData {
  const form = new FormData();
  form.set("name", "Exit stack");
  form.set("symbol", "BTCUSDT");
  form.set("direction", "long");
  form.set("startKind", "immediate");
  form.set("clipSize", "1");
  form.set("sizeUnit", "qty");
  return form;
}

const missing = parseExitStackForm(baseForm(), "exitIf", null, null);
assert.equal(missing.ok, true);
if (missing.ok) {
  assert.equal(missing.present, false);
  assert.equal(missing.stack.leaves.length, 0);
}

const emptyStop = baseForm();
emptyStop.set("slOn", "on");
emptyStop.set("stopLossPct", "");
const emptyStopParsed = parseDcaPlaybookForm(emptyStop);
assert.equal(emptyStopParsed.ok, false);
if (!emptyStopParsed.ok) {
  assert.equal(emptyStopParsed.error, "Enter a stop loss.");
}

const round = baseForm();
round.set("exitIfTrigger", "price");
round.set("exitIfTriggerBy", "last");
round.set("exitIfTriggerCompare", "gte");
round.set("exitIfTriggerPrice", "100");
round.set("exitIfStackCount", "1");
round.set("exitIfStack0Join", "or");
round.set("exitIfStack0Trigger", "price");
round.set("exitIfStack0TriggerBy", "mark");
round.set("exitIfStack0TriggerCompare", "lte");
round.set("exitIfStack0TriggerPrice", "90");
const roundParsed = parseDcaPlaybookForm(round);
assert.equal(roundParsed.ok, true);
if (!roundParsed.ok) {
  throw new Error("price exit stack should parse");
}
assert.equal(roundParsed.config.exitStack?.leaves.length, 1);
assert.equal(roundParsed.config.exitStack?.joins[0], "or");
const roundLeaf = roundParsed.config.exitStack?.leaves[0];
assert.equal(roundLeaf?.kind, "price");
if (roundLeaf?.kind === "price") {
  assert.equal(roundLeaf.price, 90);
  assert.equal(roundLeaf.triggerBy, "mark");
}
const roundSnap = snapshotDcaRecipe(roundParsed.config);
assert.equal(roundSnap.exitStack?.leaves.length, 1);
assert.equal(recipeHasRuntimeKeys(roundSnap), false);
const roundApplied = dcaRecipeToConfig(roundSnap, { venue: "bybit" });
assert.equal(roundApplied.ok, true);
if (roundApplied.ok) {
  assert.equal(roundApplied.config.exitStack?.leaves[0]?.kind, "price");
}

const conflict = baseForm();
conflict.set("exitIfTrigger", "price");
conflict.set("exitIfTriggerBy", "last");
conflict.set("exitIfTriggerCompare", "gte");
conflict.set("exitIfTriggerPrice", "100");
conflict.set("exitIfStackCount", "1");
conflict.set("exitIfStack0Join", "and");
conflict.set("exitIfStack0Trigger", "price");
conflict.set("exitIfStack0TriggerBy", "last");
conflict.set("exitIfStack0TriggerCompare", "lte");
conflict.set("exitIfStack0TriggerPrice", "90");
const conflictParsed = parseDcaPlaybookForm(conflict);
assert.equal(conflictParsed.ok, false);
if (!conflictParsed.ok) {
  assert.equal(
    conflictParsed.error,
    "These conditions cannot be true at the same time.",
  );
}

const priceBand = baseForm();
priceBand.set("exitIfTrigger", "price");
priceBand.set("exitIfTriggerBy", "last");
priceBand.set("exitIfTriggerCompare", "gte");
priceBand.set("exitIfTriggerPrice", "90");
priceBand.set("exitIfStackCount", "1");
priceBand.set("exitIfStack0Join", "and");
priceBand.set("exitIfStack0Trigger", "price");
priceBand.set("exitIfStack0TriggerBy", "last");
priceBand.set("exitIfStack0TriggerCompare", "lte");
priceBand.set("exitIfStack0TriggerPrice", "100");
const priceBandParsed = parseDcaPlaybookForm(priceBand);
assert.equal(priceBandParsed.ok, true);

const priceLeaf = {
  kind: "price" as const,
  triggerBy: "last" as const,
  compare: "gte" as const,
  price: 1,
};
assert.equal(
  exitStackError({
    stack: {
      leaves: Array.from({ length: 12 }, () => priceLeaf),
      joins: Array.from({ length: 12 }, () => "or" as const),
    },
  }),
  "Use at most 12 Hard Exit conditions.",
);

const webhookId = "22222222-2222-4222-8222-222222222222";
const webhookStack = {
  leaves: [{ kind: "webhook" as const, webhookId }],
  joins: ["and" as const],
};
assert.equal(
  exitExpressionMet({
    first: true,
    stack: webhookStack,
    side: "long",
    price: 1,
    barsByTimeframe: new Map(),
    firedWebhookId: "other",
  }),
  false,
);
assert.equal(
  exitExpressionMet({
    first: true,
    stack: webhookStack,
    side: "long",
    price: 1,
    barsByTimeframe: new Map(),
    firedWebhookId: webhookId,
  }),
  true,
);

const templated = templateExitStack(webhookStack);
assert.equal(templated?.leaves[0]?.kind, "webhook");
if (templated?.leaves[0]?.kind === "webhook") {
  assert.equal(templated.leaves[0].webhookId, TEMPLATE_EXIT_WEBHOOK_ID);
}
assert.equal(JSON.stringify(templated).includes(webhookId), false);
assert.equal(exitStackNeedsWebhook(templated), true);
const blankWebhook = templateExitStack({
  leaves: [{ kind: "webhook", webhookId: "" }],
  joins: ["and"],
});
assert.equal(blankWebhook?.leaves[0]?.kind, "webhook");
if (blankWebhook?.leaves[0]?.kind === "webhook") {
  assert.equal(blankWebhook.leaves[0].webhookId, TEMPLATE_EXIT_WEBHOOK_ID);
}
assert.equal(exitStackNeedsWebhook(blankWebhook), true);
assert.equal(persistWebhookId("11111111-1111-4111-8111-111111111111"), null);
assert.equal(persistWebhookId(TEMPLATE_EXIT_WEBHOOK_ID), null);
assert.equal(persistWebhookId(webhookId), webhookId);
assert.equal(entryStackFromJson(templated)?.leaves.length, 1);

function crossExit(slowPeriod: number, compare: "cross_gte" | "cross_lte") {
  return hardExitClaim({
    trigger: "indicator",
    spec: {
      kind: "ema_cross",
      timeframe: "15",
      compare,
      level: null,
      period: 9,
      slowPeriod,
      multiplier: null,
    },
  });
}
assert.equal(
  claimsConflict(crossExit(21, "cross_gte"), crossExit(50, "cross_lte")),
  false,
);
assert.equal(
  claimsConflict(crossExit(50, "cross_gte"), crossExit(50, "cross_lte")),
  true,
);
const shortCustom = baseForm();
shortCustom.set("direction", "both");
shortCustom.set("startKind", "trend");
shortCustom.set("shortStartKind", "trend");
shortCustom.set("indicatorKind", "supertrend");
shortCustom.set("indicatorTimeframe", "240");
shortCustom.set("indicatorCompare", "gte");
shortCustom.set("indicatorPeriod", "10");
shortCustom.set("indicatorMultiplier", "3");
shortCustom.set("shortIndicatorKind", "supertrend");
shortCustom.set("shortIndicatorTimeframe", "240");
shortCustom.set("shortIndicatorCompare", "lte");
shortCustom.set("shortIndicatorPeriod", "10");
shortCustom.set("shortIndicatorMultiplier", "3");
shortCustom.set("sizeUnit", "usdt");
shortCustom.set("clipSize", "1000");
shortCustom.set("shortExitIfTrigger", "trend");
shortCustom.set("shortExitIfKind", "supertrend");
shortCustom.set("shortExitIfTimeframe", "240");
shortCustom.set("shortExitIfCompare", "gte");
shortCustom.set("shortExitIfPeriod", "10");
shortCustom.set("shortExitIfMultiplier", "3");
shortCustom.set("shortExitIfStackCount", "1");
shortCustom.set("shortExitIfStack0Join", "and");
shortCustom.set("shortExitIfStack0Trigger", "indicator");
shortCustom.set("shortExitIfStack0Kind", "rsi");
shortCustom.set("shortExitIfStack0Timeframe", "240");
shortCustom.set("shortExitIfStack0Compare", "gte");
shortCustom.set("shortExitIfStack0Period", "14");
shortCustom.set("shortExitIfStack0Level", "70");
const shortCustomParsed = parseDcaPlaybookForm(shortCustom);
assert.equal(shortCustomParsed.ok, true);
if (!shortCustomParsed.ok) {
  throw new Error("short custom exit should parse");
}
assert.equal(shortCustomParsed.config.shortExitIf?.kind, "supertrend");
assert.equal(shortCustomParsed.config.shortExitIf?.compare, "gte");
assert.equal(shortCustomParsed.config.shortExitStack?.leaves.length, 1);
assert.equal(shortCustomParsed.config.shortExitStack?.leaves[0]?.kind, "filter");
if (shortCustomParsed.config.shortExitStack?.leaves[0]?.kind === "filter") {
  assert.equal(shortCustomParsed.config.shortExitStack.leaves[0].spec.kind, "rsi");
  assert.equal(shortCustomParsed.config.shortExitStack.leaves[0].spec.level, 70);
}

const shortIndicatorBlank = baseForm();
shortIndicatorBlank.set("direction", "both");
shortIndicatorBlank.set("shortExitIfTrigger", "trend");
shortIndicatorBlank.set("shortExitIfKind", "supertrend");
shortIndicatorBlank.set("shortExitIfTimeframe", "240");
shortIndicatorBlank.set("shortExitIfCompare", "gte");
shortIndicatorBlank.set("shortExitIfPeriod", "10");
shortIndicatorBlank.set("shortExitIfMultiplier", "3");
shortIndicatorBlank.set("shortExitIfStackCount", "1");
shortIndicatorBlank.set("shortExitIfStack0Join", "and");
shortIndicatorBlank.set("shortExitIfStack0Trigger", "indicator");
shortIndicatorBlank.set("shortExitIfStack0Kind", "");
const shortIndicatorBlankParsed = parseDcaPlaybookForm(shortIndicatorBlank);
assert.equal(shortIndicatorBlankParsed.ok, false);
if (!shortIndicatorBlankParsed.ok) {
  assert.equal(
    shortIndicatorBlankParsed.error,
    "Enter a valid Short Hard Exit filter.",
  );
}

assert.equal(defaultHardExit("long").trigger, "unset");
const blankTrigger = baseForm();
blankTrigger.set("startKind", "");
const missingTrigger = parseDcaPlaybookForm(blankTrigger);
assert.equal(missingTrigger.ok, false);
const blankExit = new FormData();
blankExit.set("exitTrigger", "unset");
const missingExit = parseHardExitForm(blankExit, "exit");
assert.equal(missingExit.ok, false);

console.log("exit-stack.check ok");
