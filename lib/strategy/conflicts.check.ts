import assert from "node:assert/strict";
import {
  claimsConflict,
  indicatorClaim,
  priceClaim,
} from "@/lib/strategy/conflicts";

function entry(
  kind: string,
  compare: string,
  extra: {
    timeframe?: string;
    level?: number | null;
    levelTo?: number | null;
    period?: number | null;
    slowPeriod?: number | null;
    multiplier?: number | null;
  } = {},
) {
  return indicatorClaim({
    surface: "entry",
    kind,
    timeframe: extra.timeframe ?? "15",
    compare,
    level: extra.level,
    levelTo: extra.levelTo,
    period: extra.period,
    slowPeriod: extra.slowPeriod,
    multiplier: extra.multiplier,
  });
}

function filter(
  kind: string,
  compare: string,
  extra: {
    timeframe?: string;
    level?: number | null;
    levelTo?: number | null;
    period?: number | null;
    multiplier?: number | null;
  } = {},
) {
  return indicatorClaim({
    surface: "filter",
    kind,
    timeframe: extra.timeframe ?? "240",
    compare,
    level: extra.level,
    levelTo: extra.levelTo,
    period: extra.period,
    multiplier: extra.multiplier,
  });
}

assert.equal(
  claimsConflict(
    entry("macd", "cross_gte", { level: 0 }),
    entry("macd", "cross_lte", { level: 5 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    entry("macd", "cross_gte", { level: 0 }),
    entry("macd", "cross_lte", { level: 0, timeframe: "60" }),
  ),
  false,
);
assert.equal(
  claimsConflict(
    entry("macd", "gte", { level: 0 }),
    entry("macd", "lte", { level: 5 }),
  ),
  false,
);
assert.equal(
  claimsConflict(
    entry("macd", "gte", { level: 5 }),
    entry("macd", "lte", { level: 0 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    entry("macd", "cross_gte", { level: 0 }),
    entry("macd", "lte", { level: 0 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    entry("macd", "cross_gte", { level: 0 }),
    entry("macd", "gte", { level: 0 }),
  ),
  false,
);
assert.equal(
  claimsConflict(
    entry("rsi", "cross_gte", { level: 30, period: 14 }),
    entry("rsi", "cross_lte", { level: 70, period: 14 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    entry("rsi", "gte", { level: 30, period: 14 }),
    entry("rsi", "lte", { level: 70, period: 14 }),
  ),
  false,
);
assert.equal(
  claimsConflict(
    entry("rsi", "gte", { level: 70, period: 14 }),
    entry("rsi", "lte", { level: 30, period: 14 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    entry("rsi", "gte", { level: 50, period: 14 }),
    entry("rsi", "lte", { level: 50, period: 14 }),
  ),
  false,
);
assert.equal(
  claimsConflict(
    entry("rsi", "cross_gte", { level: 30, period: 14 }),
    entry("rsi", "cross_lte", { level: 30, period: 7 }),
  ),
  false,
);
assert.equal(
  claimsConflict(
    entry("ema_cross", "cross_gte", { period: 9, slowPeriod: 21 }),
    entry("ema_cross", "cross_lte", { period: 9, slowPeriod: 21 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    entry("ema", "cross_gte", { period: 21 }),
    entry("ema", "cross_lte", { period: 21 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    entry("ema", "gte", { period: 21 }),
    entry("ema", "lte", { period: 21 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    entry("ema", "cross_gte", { period: 21 }),
    entry("ema", "lte", { period: 21 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    entry("ema", "cross_gte", { period: 21 }),
    entry("ema", "gte", { period: 21 }),
  ),
  false,
);
assert.equal(
  claimsConflict(
    entry("ema", "cross_gte", { period: 21 }),
    entry("ema", "cross_lte", { period: 50 }),
  ),
  false,
);
assert.equal(
  claimsConflict(
    entry("bb", "cross_gte", { period: 20 }),
    entry("bb", "cross_lte", { period: 20 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    entry("bb", "gte", { period: 20 }),
    entry("bb", "lte", { period: 20 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    entry("supertrend", "cross_gte", { period: 10, multiplier: 3 }),
    entry("supertrend", "lte", { period: 10, multiplier: 3 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    entry("supertrend", "cross_gte", { period: 10, multiplier: 3 }),
    entry("supertrend", "gte", { period: 10, multiplier: 3 }),
  ),
  false,
);
assert.equal(
  claimsConflict(
    filter("rsi", "between", { level: 30, levelTo: 70, period: 14 }),
    filter("rsi", "gte", { level: 80, period: 14 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    filter("rsi", "between", { level: 30, levelTo: 70, period: 14 }),
    filter("rsi", "gte", { level: 50, period: 14 }),
  ),
  false,
);
assert.equal(
  claimsConflict(
    filter("rsi", "between", { level: 30, levelTo: 40, period: 14 }),
    filter("rsi", "between", { level: 50, levelTo: 60, period: 14 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    filter("bb", "gte", { period: 20 }),
    filter("bb", "inside", { period: 20 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    filter("atr_band", "gte", { period: 10, multiplier: 2 }),
    filter("atr_band", "lte", { period: 10, multiplier: 2 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    filter("atr_band", "gte", { period: 10, multiplier: 2 }),
    filter("atr_band", "inside", { period: 10, multiplier: 2 }),
  ),
  false,
);
assert.equal(
  claimsConflict(
    filter("ema", "gte", { period: 21 }),
    filter("ema", "lte", { period: 21 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    priceClaim({ source: "last", compare: "gte", price: 90 }),
    priceClaim({ source: "last", compare: "lte", price: 100 }),
  ),
  false,
);
assert.equal(
  claimsConflict(
    priceClaim({ source: "last", compare: "gte", price: 100 }),
    priceClaim({ source: "last", compare: "lte", price: 90 }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    priceClaim({ source: "last", compare: "gte", price: 100 }),
    priceClaim({ source: "mark", compare: "lte", price: 90 }),
  ),
  false,
);
assert.equal(
  claimsConflict(
    entry("ema_cross", "cross_gte", { level: 100, period: 21 }),
    entry("ema_cross", "cross_lte", { level: 90, period: 21 }),
  ),
  true,
);

console.log("conflicts.check ok");
