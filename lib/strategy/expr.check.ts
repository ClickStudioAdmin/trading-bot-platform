import assert from "node:assert/strict";
import type { DcaFilterSpec } from "@/lib/dca/filters";
import { priceClaim } from "@/lib/strategy/conflicts";
import {
  claimConflictsAt,
  confirmFromEntryStack,
  emptyEntryStack,
  entryJoinDisabled,
  entryKindDisabled,
  entryStackConflictMessage,
  entryStackError,
  entryStackFromJson,
  entryStackIsLegacy,
  entryStackMet,
  entryStackToJson,
  entryWebhookIdDisabled,
  formatEntryWithStack,
  legacyEntryStack,
  resolveEntryStack,
  STRATEGY_CONDITION_CAP,
  type EntryConflictSlot,
  type StrategyLeaf,
} from "./expr";

const rsi: DcaFilterSpec = {
  kind: "rsi",
  timeframe: "15",
  compare: "lte",
  level: 30,
  period: 14,
  multiplier: null,
};
const ema: DcaFilterSpec = {
  kind: "ema",
  timeframe: "60",
  compare: "gte",
  level: null,
  period: 21,
  multiplier: null,
};
const sma: DcaFilterSpec = {
  kind: "sma",
  timeframe: "240",
  compare: "gte",
  level: null,
  period: 21,
  multiplier: null,
};
const bb: DcaFilterSpec = {
  kind: "bb",
  timeframe: "D",
  compare: "inside",
  level: null,
  period: 20,
  multiplier: null,
};

assert.equal(
  entryStackMet({ trigger: true, leaves: [], joins: [] }),
  true,
);
assert.equal(
  entryStackMet({ trigger: false, leaves: [], joins: [] }),
  false,
);

const oneAnd = legacyEntryStack(rsi);
assert.equal(confirmFromEntryStack(oneAnd)?.kind, "rsi");
assert.equal(entryStackIsLegacy(oneAnd), true);
assert.equal(
  entryStackMet({ trigger: true, leaves: [true], joins: ["and"] }),
  true,
);
assert.equal(
  entryStackMet({ trigger: true, leaves: [false], joins: ["and"] }),
  false,
);
assert.equal(
  entryStackMet({ trigger: false, leaves: [true], joins: ["and"] }),
  false,
);

assert.equal(
  entryStackMet({ trigger: false, leaves: [true], joins: ["or"] }),
  true,
);
assert.equal(
  entryStackMet({ trigger: false, leaves: [false], joins: ["or"] }),
  false,
);

assert.equal(
  entryStackMet({
    trigger: false,
    leaves: [false, true],
    joins: ["and", "or"],
  }),
  true,
  "trigger AND miss OR hit",
);
assert.equal(
  entryStackMet({
    trigger: true,
    leaves: [false, true],
    joins: ["and", "or"],
  }),
  true,
  "the Or group can pass on its own",
);
assert.equal(
  entryStackMet({
    trigger: false,
    leaves: [true, false],
    joins: ["or", "and"],
  }),
  false,
  "Or starts a group and the following And stays inside it",
);
assert.equal(
  entryStackMet({
    trigger: false,
    leaves: [true, true],
    joins: ["or", "and"],
  }),
  true,
);

assert.equal(resolveEntryStack(undefined, rsi).leaves.length, 1);
assert.equal(resolveEntryStack(emptyEntryStack(), rsi).leaves.length, 0);
assert.equal(resolveEntryStack(null, null).leaves.length, 0);

const roundTrip = entryStackFromJson(
  entryStackToJson({
    leaves: [
      { kind: "filter", spec: rsi },
      { kind: "filter", spec: ema },
    ],
    joins: ["and", "or"],
  }),
);
assert.equal(roundTrip?.joins[1], "or");
const roundLeaf = roundTrip?.leaves[1];
assert.equal(roundLeaf?.kind === "filter" ? roundLeaf.spec.kind : "", "ema");
assert.equal(entryStackFromJson({ leaves: [], joins: ["and"] }), null);
assert.equal(entryStackFromJson({ leaves: [{ kind: "price" }], joins: ["and"] }), null);

const tooMany = {
  leaves: Array.from({ length: STRATEGY_CONDITION_CAP }, () => ({
    kind: "filter" as const,
    spec: rsi,
  })),
  joins: Array.from({ length: STRATEGY_CONDITION_CAP }, () => "and" as const),
};
assert.match(
  entryStackError({ stack: tooMany }) ?? "",
  /12 entry conditions/,
);

assert.match(
  entryStackError({
    stack: {
      leaves: [
        { kind: "filter", spec: rsi },
        { kind: "filter", spec: ema },
        { kind: "filter", spec: sma },
        { kind: "filter", spec: bb },
      ],
      joins: ["and", "and", "and", "or"],
    },
    triggerTimeframe: "5",
  }) ?? "",
  /4 timeframes/,
);

assert.equal(
  formatEntryWithStack(
    "Price",
    {
      leaves: [
        { kind: "filter", spec: rsi },
        { kind: "filter", spec: ema },
      ],
      joins: ["and", "or"],
    },
    (leaf) => (leaf.kind === "filter" ? leaf.spec.kind : leaf.kind),
  ),
  "Price, and rsi, or ema",
);

const priceLeaf: StrategyLeaf = {
  kind: "price",
  triggerBy: "mark",
  compare: "lte",
  price: 100,
};
const webhookLeaf: StrategyLeaf = { kind: "webhook", webhookId: "hook-a" };
const otherWebhook: StrategyLeaf = { kind: "webhook", webhookId: "hook-b" };
const indicatorLeaf: StrategyLeaf = {
  kind: "indicator",
  start: {
    kind: "rsi",
    timeframe: "15",
    compare: "lte",
    level: 30,
    period: 14,
    slowPeriod: null,
  },
};
const triggerRound = entryStackFromJson(
  entryStackToJson({
    leaves: [priceLeaf, indicatorLeaf, webhookLeaf],
    joins: ["and", "or", "or"],
  }),
);
assert.equal(triggerRound?.leaves[0]?.kind, "price");
assert.equal(
  triggerRound?.leaves[0]?.kind === "price"
    ? triggerRound.leaves[0].triggerBy
    : "",
  "mark",
);
assert.equal(triggerRound?.leaves[1]?.kind, "indicator");
assert.equal(
  triggerRound?.leaves[2]?.kind === "webhook"
    ? triggerRound.leaves[2].webhookId
    : "",
  "hook-a",
);

function slots(
  trigger: EntryConflictSlot["kind"],
  rows: EntryConflictSlot[],
  webhookId: string | null = null,
): EntryConflictSlot[] {
  return [{ kind: trigger, join: "and", webhookId }, ...rows];
}

const priceBand = slots("price", [
  {
    kind: "price",
    join: "and",
    webhookId: null,
    claim: priceClaim({ source: "last", compare: "lte", price: 100 }),
  },
]);
priceBand[0] = {
  ...priceBand[0],
  claim: priceClaim({ source: "last", compare: "gte", price: 90 }),
};
assert.equal(
  entryKindDisabled({ slots: priceBand, index: 1, kind: "price" }),
  false,
);
assert.equal(claimConflictsAt(priceBand, 1, priceBand[1]?.claim), false);
assert.equal(entryJoinDisabled({ slots: priceBand, index: 1, join: "and" }), false);
const priceGap = slots("price", [
  {
    kind: "price",
    join: "and",
    webhookId: null,
    claim: priceClaim({ source: "last", compare: "lte", price: 90 }),
  },
]);
priceGap[0] = {
  ...priceGap[0],
  claim: priceClaim({ source: "last", compare: "gte", price: 100 }),
};
assert.equal(claimConflictsAt(priceGap, 1, priceGap[1]?.claim), true);
assert.equal(entryJoinDisabled({ slots: priceGap, index: 1, join: "and" }), true);
const priceOrPrice = slots("price", [
  {
    kind: "price",
    join: "or",
    webhookId: null,
    claim: priceClaim({ source: "last", compare: "lte", price: 90 }),
  },
]);
priceOrPrice[0] = {
  ...priceOrPrice[0],
  claim: priceClaim({ source: "last", compare: "gte", price: 100 }),
};
assert.equal(
  entryKindDisabled({ slots: priceOrPrice, index: 1, kind: "price" }),
  false,
);
assert.equal(claimConflictsAt(priceOrPrice, 1, priceOrPrice[1]?.claim), false);
assert.equal(
  entryJoinDisabled({ slots: priceOrPrice, index: 1, join: "and" }),
  true,
);

const sameHook = slots(
  "webhook",
  [{ kind: "webhook", join: "or", webhookId: "hook-a" }],
  "hook-a",
);
assert.equal(
  entryWebhookIdDisabled({ slots: sameHook, index: 1, webhookId: "hook-a" }),
  true,
);
assert.equal(
  entryWebhookIdDisabled({ slots: sameHook, index: 1, webhookId: "hook-b" }),
  false,
);
assert.equal(
  entryKindDisabled({
    slots: sameHook,
    index: 1,
    kind: "webhook",
    webhookIds: ["hook-a"],
  }),
  true,
  "the only webhook id is already used",
);
const twoHooksAnd = slots(
  "price",
  [
    { kind: "webhook", join: "and", webhookId: "hook-a" },
    { kind: "webhook", join: "and", webhookId: "hook-b" },
  ],
);
assert.equal(
  entryKindDisabled({ slots: twoHooksAnd, index: 2, kind: "webhook" }),
  true,
);
assert.equal(
  entryStackConflictMessage({
    trigger: { kind: "price", join: "and" },
    stack: {
      leaves: [webhookLeaf, otherWebhook],
      joins: ["and", "and"],
    },
  }),
  "Two webhooks cannot be joined with And.",
);
assert.equal(
  entryStackConflictMessage({
    trigger: {
      kind: "price",
      join: "and",
      claim: priceClaim({ source: "mark", compare: "gte", price: 120 }),
    },
    stack: { leaves: [priceLeaf], joins: ["and"] },
  }),
  "These conditions cannot be true at the same time.",
);
assert.equal(
  entryStackConflictMessage({
    trigger: {
      kind: "price",
      join: "and",
      claim: priceClaim({ source: "mark", compare: "gte", price: 80 }),
    },
    stack: { leaves: [priceLeaf], joins: ["and"] },
  }),
  null,
);
assert.equal(
  entryStackConflictMessage({
    trigger: { kind: "webhook", join: "and", webhookId: "hook-a" },
    stack: { leaves: [webhookLeaf], joins: ["or"] },
  }),
  "The same webhook cannot be used twice.",
);
assert.equal(
  entryStackConflictMessage({
    trigger: { kind: "indicator", join: "and" },
    stack: { leaves: [priceLeaf, indicatorLeaf], joins: ["and", "and"] },
  }),
  null,
);

console.log("strategy expr checks passed");
