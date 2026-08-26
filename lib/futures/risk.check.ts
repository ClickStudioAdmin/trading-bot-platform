import assert from "node:assert/strict";
import {
  checkFuturesRiskCaps,
  parseOptionalPositive,
  parseOptionalPositiveInt,
} from "./risk";

assert.deepEqual(parseOptionalPositive("", "Max value"), { ok: true, value: null });
assert.deepEqual(parseOptionalPositive("1.5", "Max value"), { ok: true, value: 1.5 });
assert.equal(parseOptionalPositive("0", "Max value").ok, false);
assert.equal(parseOptionalPositiveInt("3", "Max rows").ok, true);
assert.equal(parseOptionalPositiveInt("1.5", "Max rows").ok, false);

const base = {
  caps: {
    maxValuePerSymbol: null as number | null,
    maxOpenPositions: null as number | null,
  },
  symbol: "BTCUSDT",
  side: "long" as const,
  orderValue: 10_000,
  opens: [] as { symbol: string; side: "long" | "short"; qty: number; notionalUsdt: number }[],
  working: [] as {
    symbol: string;
    side: "long" | "short";
    remainingQty: number;
    limitPrice: number;
    reduceOnly: boolean;
  }[],
};

assert.equal(checkFuturesRiskCaps(base).ok, true);

assert.equal(
  checkFuturesRiskCaps({
    ...base,
    caps: { ...base.caps, maxValuePerSymbol: 9_000 },
  }).ok,
  false,
);
assert.equal(
  checkFuturesRiskCaps({
    ...base,
    caps: { ...base.caps, maxValuePerSymbol: 20_000 },
  }).ok,
  true,
);
const valueBreach = checkFuturesRiskCaps({
  ...base,
  caps: { ...base.caps, maxValuePerSymbol: 9_000 },
});
assert.equal(valueBreach.ok, false);
if (!valueBreach.ok) {
  assert.match(valueBreach.error, /Max value/);
}

const rowsBreach = checkFuturesRiskCaps({
  ...base,
  caps: { ...base.caps, maxOpenPositions: 1 },
  opens: [{ symbol: "ETHUSDT", side: "long", qty: 1, notionalUsdt: 4_000 }],
});
assert.equal(rowsBreach.ok, false);
if (!rowsBreach.ok) {
  assert.match(rowsBreach.error, /Max open positions/);
}
assert.equal(
  checkFuturesRiskCaps({
    ...base,
    caps: { ...base.caps, maxOpenPositions: 1 },
    opens: [{ symbol: "BTCUSDT", side: "long", qty: 0.01, notionalUsdt: 1_000 }],
  }).ok,
  true,
);
assert.equal(
  checkFuturesRiskCaps({
    ...base,
    caps: { ...base.caps, maxOpenPositions: 1 },
    working: [
      {
        symbol: "ETHUSDT",
        side: "short",
        remainingQty: 1,
        limitPrice: 4000,
        reduceOnly: false,
      },
    ],
  }).ok,
  false,
);
assert.equal(
  checkFuturesRiskCaps({
    ...base,
    caps: { ...base.caps, maxOpenPositions: 1 },
    working: [
      {
        symbol: "ETHUSDT",
        side: "short",
        remainingQty: 1,
        limitPrice: 4000,
        reduceOnly: true,
      },
    ],
  }).ok,
  true,
);

console.log("futures risk checks passed");
