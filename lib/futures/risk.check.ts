import assert from "node:assert/strict";
import {
  checkFuturesRiskCaps,
  parseOptionalPositive,
  parseOptionalPositiveInt,
} from "./risk";

assert.deepEqual(parseOptionalPositive("", "Max qty"), { ok: true, value: null });
assert.deepEqual(parseOptionalPositive("1.5", "Max qty"), { ok: true, value: 1.5 });
assert.equal(parseOptionalPositive("0", "Max qty").ok, false);
assert.equal(parseOptionalPositiveInt("3", "Max rows").ok, true);
assert.equal(parseOptionalPositiveInt("1.5", "Max rows").ok, false);

const base = {
  caps: {
    maxQtyPerSymbol: null as number | null,
    maxNotionalPerSymbol: null as number | null,
    maxOpenRows: null as number | null,
  },
  symbol: "BTCUSDT",
  side: "long" as const,
  orderQty: 0.1,
  orderNotional: 10_000,
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
    caps: { ...base.caps, maxQtyPerSymbol: 0.05 },
  }).ok,
  false,
);
assert.equal(
  checkFuturesRiskCaps({
    ...base,
    caps: { ...base.caps, maxQtyPerSymbol: 0.2 },
    opens: [{ symbol: "BTCUSDT", side: "long", qty: 0.05, notionalUsdt: 5_000 }],
  }).ok,
  true,
);
assert.equal(
  checkFuturesRiskCaps({
    ...base,
    caps: { ...base.caps, maxQtyPerSymbol: 0.1 },
    opens: [{ symbol: "BTCUSDT", side: "long", qty: 0.05, notionalUsdt: 5_000 }],
  }).ok,
  false,
);

assert.equal(
  checkFuturesRiskCaps({
    ...base,
    caps: { ...base.caps, maxNotionalPerSymbol: 9_000 },
  }).ok,
  false,
);
assert.equal(
  checkFuturesRiskCaps({
    ...base,
    caps: { ...base.caps, maxNotionalPerSymbol: 20_000 },
  }).ok,
  true,
);

assert.equal(
  checkFuturesRiskCaps({
    ...base,
    caps: { ...base.caps, maxOpenRows: 1 },
    opens: [{ symbol: "ETHUSDT", side: "long", qty: 1, notionalUsdt: 4_000 }],
  }).ok,
  false,
);
assert.equal(
  checkFuturesRiskCaps({
    ...base,
    caps: { ...base.caps, maxOpenRows: 1 },
    opens: [{ symbol: "BTCUSDT", side: "long", qty: 0.01, notionalUsdt: 1_000 }],
  }).ok,
  true,
);
assert.equal(
  checkFuturesRiskCaps({
    ...base,
    caps: { ...base.caps, maxOpenRows: 1 },
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
    caps: { ...base.caps, maxOpenRows: 1 },
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
