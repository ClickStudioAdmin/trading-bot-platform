import assert from "node:assert/strict";
import {
  futuresBreakevenDue,
  futuresBreakevenStop,
  futuresEntryConditionMet,
  futuresFilterMet,
  parseFuturesConditionForm,
} from "./conditions";
import type { CandleBar } from "@/lib/market/candles";

const rising: CandleBar[] = Array.from({ length: 30 }, (_, index) => {
  const close = 100 + index;
  return {
    timeMs: index * 60_000,
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close,
  };
});

const bars = new Map([["15" as const, rising]]);

assert.equal(
  futuresEntryConditionMet({
    rule: {
      entrySource: "price",
      triggerCompare: "gte",
      triggerPrice: 120,
    },
    side: "long",
    price: 120,
    barsByTimeframe: bars,
  }),
  true,
);
assert.equal(
  futuresEntryConditionMet({
    rule: {
      entrySource: "price",
      triggerCompare: "gte",
      triggerPrice: 120,
    },
    side: "long",
    price: 119,
    barsByTimeframe: bars,
  }),
  false,
);

assert.equal(
  futuresEntryConditionMet({
    rule: {
      entrySource: "indicator",
      indicator: {
        kind: "ema",
        timeframe: "15",
        compare: "gte",
        level: null,
        period: 5,
        slowPeriod: null,
      },
      confirm: {
        kind: "sma",
        timeframe: "15",
        compare: "gte",
        level: null,
        period: 5,
        multiplier: null,
      },
      triggerCompare: "gte",
      triggerPrice: 1,
    },
    side: "long",
    price: 129,
    barsByTimeframe: bars,
  }),
  true,
);

assert.equal(
  futuresEntryConditionMet({
    rule: {
      entrySource: "indicator",
      indicator: {
        kind: "ema",
        timeframe: "15",
        compare: "gte",
        level: null,
        period: 5,
        slowPeriod: null,
      },
      confirm: {
        kind: "sma",
        timeframe: "15",
        compare: "lte",
        level: null,
        period: 5,
        multiplier: null,
      },
      triggerCompare: "gte",
      triggerPrice: 1,
    },
    side: "long",
    price: 129,
    barsByTimeframe: bars,
  }),
  false,
);

assert.equal(
  futuresFilterMet({
    spec: {
      kind: "rsi",
      timeframe: "15",
      compare: "lte",
      level: 20,
      period: 14,
      multiplier: null,
    },
    side: "long",
    barsByTimeframe: bars,
  }),
  false,
);

assert.equal(
  futuresBreakevenDue({
    side: "long",
    qty: 1,
    entryPrice: 100,
    mark: 102,
    activationPct: 1,
    done: false,
  }),
  true,
);
assert.equal(
  futuresBreakevenDue({
    side: "long",
    qty: 1,
    entryPrice: 100,
    mark: 100.5,
    activationPct: 1,
    done: false,
  }),
  false,
);
assert.equal(
  futuresBreakevenDue({
    side: "long",
    qty: 1,
    entryPrice: 100,
    mark: 110,
    activationPct: 1,
    done: true,
  }),
  false,
);

assert.equal(
  futuresBreakevenStop({
    side: "long",
    entryPrice: 100,
    currentStop: 95,
    offsetPct: 1,
  }),
  101,
);

const form = new FormData();
form.set("r0_entrySource", "indicator");
form.set("r0_indicatorKind", "rsi");
form.set("r0_indicatorTimeframe", "15");
form.set("r0_indicatorCompare", "cross_lte");
form.set("r0_indicatorLevel", "30");
form.set("r0_indicatorPeriod", "14");
form.set("r0_confirmKind", "ema");
form.set("r0_confirmTimeframe", "240");
form.set("r0_confirmCompare", "gte");
form.set("r0_confirmPeriod", "20");
form.set("r0_breakevenActivationPct", "1.5");
form.set("r0_breakevenOffsetPct", "0.2");
const parsed = parseFuturesConditionForm(form, "r0_", {
  entrySource: "indicator",
  closing: false,
});
assert.equal(parsed.ok, true);
if (parsed.ok) {
  assert.equal(parsed.indicator?.kind, "rsi");
  assert.equal(parsed.confirm?.kind, "ema");
  assert.equal(parsed.entryStack.leaves.length, 1);
  assert.equal(parsed.entryStack.joins[0], "and");
  assert.equal(parsed.breakevenActivationPct, 1.5);
  assert.equal(parsed.breakevenOffsetPct, 0.2);
}

const stacked = new FormData();
stacked.set("r0_entryCount", "1");
stacked.set("r0_entry0Join", "or");
stacked.set("r0_entry0Kind", "ema");
stacked.set("r0_entry0Timeframe", "15");
stacked.set("r0_entry0Compare", "gte");
stacked.set("r0_entry0Period", "5");
const stackedParsed = parseFuturesConditionForm(stacked, "r0_", {
  entrySource: "price",
  closing: false,
});
assert.equal(stackedParsed.ok, true);
if (stackedParsed.ok) {
  assert.equal(stackedParsed.confirm, null);
  assert.equal(stackedParsed.entryStack.joins[0], "or");
  const stackedLeaf = stackedParsed.entryStack.leaves[0];
  assert.equal(stackedLeaf?.kind, "filter");
  assert.equal(
    stackedLeaf?.kind === "filter" ? stackedLeaf.spec.kind : "",
    "ema",
  );
}

assert.equal(
  futuresEntryConditionMet({
    rule: {
      entrySource: "price",
      triggerCompare: "gte",
      triggerPrice: 200,
      entryStack: stackedParsed.ok ? stackedParsed.entryStack : undefined,
    },
    side: "long",
    price: 100,
    barsByTimeframe: bars,
  }),
  true,
  "Or passes when the trigger misses and the second condition is true",
);

const priceOr = new FormData();
priceOr.set("r0_entryCount", "1");
priceOr.set("r0_entry0Join", "or");
priceOr.set("r0_entry0Source", "price");
priceOr.set("r0_entry0TriggerBy", "mark");
priceOr.set("r0_entry0TriggerCompare", "lte");
priceOr.set("r0_entry0TriggerPrice", "150");
const priceOrParsed = parseFuturesConditionForm(priceOr, "r0_", {
  entrySource: "price",
  closing: false,
});
assert.equal(priceOrParsed.ok, true);
assert.equal(
  futuresEntryConditionMet({
    rule: {
      entrySource: "price",
      triggerCompare: "gte",
      triggerPrice: 200,
      entryStack: priceOrParsed.ok ? priceOrParsed.entryStack : undefined,
    },
    side: "long",
    price: 100,
    prices: { last: 100, mark: 140, index: 100 },
    barsByTimeframe: bars,
  }),
  true,
  "Or price leaf uses its own price source",
);

const priceAnd = new FormData();
priceAnd.set("r0_webhookId", "hook-a");
priceAnd.set("r0_entryCount", "1");
priceAnd.set("r0_entry0Join", "and");
priceAnd.set("r0_entry0Source", "price");
priceAnd.set("r0_entry0TriggerBy", "last");
priceAnd.set("r0_entry0TriggerCompare", "gte");
priceAnd.set("r0_entry0TriggerPrice", "90");
const priceAndParsed = parseFuturesConditionForm(priceAnd, "r0_", {
  entrySource: "price",
  closing: false,
});
assert.equal(priceAndParsed.ok, false);
if (!priceAndParsed.ok) {
  assert.match(priceAndParsed.error, /price crosses/);
}

const webhookAnd = new FormData();
webhookAnd.set("r0_webhookId", "hook-a");
webhookAnd.set("r0_entryCount", "1");
webhookAnd.set("r0_entry0Join", "and");
webhookAnd.set("r0_entry0Source", "webhook");
webhookAnd.set("r0_entry0WebhookId", "hook-b");
const webhookAndParsed = parseFuturesConditionForm(webhookAnd, "r0_", {
  entrySource: "webhook",
  closing: false,
});
assert.equal(webhookAndParsed.ok, false);

const webhookOr = new FormData();
webhookOr.set("r0_entryCount", "1");
webhookOr.set("r0_entry0Join", "or");
webhookOr.set("r0_entry0Source", "webhook");
webhookOr.set("r0_entry0WebhookId", "hook-b");
const webhookOrParsed = parseFuturesConditionForm(webhookOr, "r0_", {
  entrySource: "price",
  closing: false,
});
assert.equal(webhookOrParsed.ok, true);
assert.equal(
  futuresEntryConditionMet({
    rule: {
      entrySource: "price",
      triggerCompare: "gte",
      triggerPrice: 200,
      entryStack: webhookOrParsed.ok ? webhookOrParsed.entryStack : undefined,
    },
    side: "long",
    price: 100,
    barsByTimeframe: bars,
    firedWebhookId: "hook-b",
  }),
  true,
);
assert.equal(
  futuresEntryConditionMet({
    rule: {
      entrySource: "price",
      triggerCompare: "gte",
      triggerPrice: 200,
      entryStack: webhookOrParsed.ok ? webhookOrParsed.entryStack : undefined,
    },
    side: "long",
    price: 100,
    barsByTimeframe: bars,
    firedWebhookId: null,
  }),
  false,
);

console.log("futures conditions checks passed");
