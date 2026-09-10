import assert from "node:assert/strict";
import {
  formatBreakevenReason,
  formatDcaStartReasons,
  formatFuturesEntryReasons,
  formatHardExitReason,
  formatPriceCrossReason,
  formatSecondaryEntryReason,
  futuresActionLabel,
  futuresBreakevenMessage,
  futuresFiredMessage,
  futuresHardExitMessage,
  joinConditionReasons,
} from "./condition-copy";

assert.equal(
  formatPriceCrossReason({
    source: "last",
    compare: "gte",
    level: 67000,
    price: 67120,
  }),
  "Last is at or above 67000 (now 67120)",
);

assert.equal(
  formatFuturesEntryReasons({
    entrySource: "indicator",
    side: "long",
    triggerBy: "last",
    triggerCompare: "gte",
    triggerPrice: 0,
    indicator: {
      kind: "rsi",
      timeframe: "15",
      compare: "cross_lte",
      level: 30,
      period: 14,
      slowPeriod: null,
      multiplier: null,
    },
    confirm: {
      kind: "rsi",
      timeframe: "60",
      compare: "lte",
      level: 50,
      period: 14,
      multiplier: null,
    },
  }),
  "RSI 14 crosses below 30 · 15m, and Secondary Entry RSI 14 at or below 50 · 1h",
);

assert.equal(
  formatFuturesEntryReasons({
    entrySource: "webhook",
    side: "short",
    triggerBy: "last",
    triggerCompare: "gte",
    triggerPrice: 0,
    confirm: {
      kind: "supertrend",
      timeframe: "15",
      compare: "lte",
      level: null,
      period: 10,
      multiplier: 3,
    },
  }),
  "Signal webhook, and Secondary Entry Supertrend 10 × 3 is bearish · 15m",
);

assert.equal(
  formatHardExitReason(
    {
      kind: "rsi",
      timeframe: "15",
      compare: "gte",
      level: 70,
      period: 14,
      multiplier: null,
    },
    "long",
  ),
  "RSI 14 at or above 70 · 15m",
);

assert.match(
  formatBreakevenReason({
    side: "long",
    entryPrice: 100,
    mark: 101.5,
    activationPct: 1,
    offsetPct: 0,
    stop: 100,
  }),
  /Long up 1\.5% from entry \(activation 1%\); stop set to 100 \(offset 0%\)/,
);

assert.equal(
  formatDcaStartReasons({
    startKind: "trend",
    side: "long",
    indicator: {
      kind: "supertrend",
      timeframe: "15",
      compare: "cross_gte",
      level: null,
      period: 10,
      slowPeriod: null,
      multiplier: 3,
    },
  }),
  "Supertrend 10 × 3 turns bullish · 15m",
);

assert.equal(
  futuresFiredMessage({
    name: "Sample bot",
    symbol: "BTCUSDT",
    action: "buy",
    reasons: "RSI 14 crosses below 30 · 15m",
  }),
  "Sample bot fired on BTCUSDT. Buy because RSI 14 crosses below 30 · 15m.",
);

assert.equal(
  futuresHardExitMessage({
    name: "Sample bot",
    symbol: "BTCUSDT",
    reasons: "RSI 14 at or above 70 · 15m",
  }),
  "Hard Exit flattened Sample bot on BTCUSDT. RSI 14 at or above 70 · 15m.",
);

assert.equal(
  futuresBreakevenMessage({
    name: "Sample bot",
    symbol: "BTCUSDT",
    reasons: "Long up 1.5% from entry (activation 1%)",
  }),
  "Moved stop to breakeven for Sample bot on BTCUSDT. Long up 1.5% from entry (activation 1%).",
);

assert.equal(futuresActionLabel("flatten", "short"), "Close short");
assert.equal(
  joinConditionReasons(["RSI 14 crosses below 30 · 15m", null, ""]),
  "RSI 14 crosses below 30 · 15m",
);
assert.equal(
  formatSecondaryEntryReason(
    {
      kind: "ema",
      timeframe: "60",
      compare: "gte",
      level: null,
      period: 21,
      multiplier: null,
    },
    "long",
  ),
  "Secondary Entry Price is above EMA 21 · 1h",
);

console.log("condition-copy checks passed");
