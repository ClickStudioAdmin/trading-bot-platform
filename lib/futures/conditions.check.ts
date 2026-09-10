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
  assert.equal(parsed.breakevenActivationPct, 1.5);
  assert.equal(parsed.breakevenOffsetPct, 0.2);
}

console.log("futures conditions checks passed");
