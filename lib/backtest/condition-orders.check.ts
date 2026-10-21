import assert from "node:assert/strict";
import { conditionOrderLevels } from "@/lib/backtest/condition-orders";
import type { CandleBar } from "@/lib/market/candles";
import type { PerpsTemplateRecipe } from "@/lib/templates/recipe";

function bar(index: number, close: number, low = close, high = close): CandleBar {
  return {
    timeMs: 1_700_000_000_000 + index * 300_000,
    open: close,
    high,
    low,
    close,
  };
}

const recipe: PerpsTemplateRecipe = {
  kind: "flex",
  name: "Enabled exits",
  symbol: "SOLUSDT",
  formAction: "buy",
  orderType: "market",
  sizeUnit: "qty",
  size: "1",
  limitPrice: "",
  entrySource: "price",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: "100",
  skipIfOpen: true,
  direction: "long",
  tpsl: {
    takeProfit: 130,
    stopLoss: 90,
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
  trailing: { distance: 5, activePrice: 110, peak: null },
  breakevenActivationPct: 5,
  breakevenOffsetPct: 0,
  addStack: {
    leaves: [{ kind: "price", triggerBy: "last", compare: "lte", price: 80 }],
    joins: ["and"],
    orders: [{ size: "1", sizeUnit: "qty", orderType: "market", limitPrice: "" }],
  },
};

const order = {
  atMs: bar(0, 100).timeMs,
  action: "buy" as const,
  side: "long" as const,
  qty: 1,
  price: 100,
  feeUsdt: 0,
  realizedUsdt: 0,
  reason: "entry" as const,
  clipIndex: 1,
};

function titles(candles: CandleBar[]) {
  return conditionOrderLevels({
    recipe,
    orders: [order],
    candles,
    tape: "5",
  });
}

const before = titles([bar(0, 100)]);
assert.equal(before.some((row) => row.title === "Long SL" && row.price === 90), true);
assert.equal(before.some((row) => row.title === "Long TP" && row.price === 130), true);
assert.equal(before.some((row) => row.title === "Long Trail"), false);
assert.equal(before.some((row) => row.title === "Long BE"), false);
assert.equal(before.some((row) => row.role === "add"), false);

const after = titles([bar(0, 100), bar(1, 112, 112, 112)]);
assert.equal(after.some((row) => row.title === "Long SL" && row.price === 90), true);
assert.equal(after.some((row) => row.title === "Long Trail" && row.price === 107), true);
assert.equal(after.some((row) => row.title === "Long BE" && row.price === 100), true);
assert.equal(after.some((row) => row.role === "add"), false);

const wick = titles([bar(0, 100, 96, 104), bar(1, 111, 108, 112)]);
assert.equal(wick.some((row) => row.title === "Long Trail" && row.price === 107), true);

console.log("condition order level checks passed");
