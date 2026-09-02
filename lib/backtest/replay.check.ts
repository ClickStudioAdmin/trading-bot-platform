import assert from "node:assert/strict";
import type { PerpsTemplateRecipe } from "@/lib/templates/recipe";
import {
  canBacktestPerpsRecipe,
  recipeAction,
  replayPerpsPriceCross,
} from "./replay";

const base: PerpsTemplateRecipe = {
  kind: "perps",
  name: "Long cross",
  symbol: "BTCUSDT",
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
  tpsl: null,
  trailing: null,
};

assert.equal(canBacktestPerpsRecipe(base).ok, true);
assert.equal(
  canBacktestPerpsRecipe({ ...base, entrySource: "webhook" }).ok,
  false,
);
assert.equal(canBacktestPerpsRecipe({ ...base, size: "" }).ok, false);
assert.deepEqual(recipeAction({ ...base, formAction: "close_short" }), {
  action: "flatten",
  closeSide: "short",
});

const bars = [
  { timeMs: 1_000, open: 90, high: 92, low: 89, close: 91 },
  { timeMs: 2_000, open: 91, high: 101, low: 91, close: 101 },
  { timeMs: 3_000, open: 101, high: 110, low: 100, close: 109 },
  { timeMs: 4_000, open: 109, high: 109, low: 95, close: 96 },
];

const opened = replayPerpsPriceCross({
  bars,
  recipe: base,
  feeRate: 0.001,
  startingUsdt: 10_000,
});
assert.equal(opened.orders.length, 1);
assert.equal(opened.orders[0]?.action, "buy");
assert.equal(opened.orders[0]?.price, 101);
assert.equal(opened.stats.openSide, "long");
assert.equal(opened.stats.trades, 0);

const flatten: PerpsTemplateRecipe = {
  ...base,
  name: "Close long",
  formAction: "close_long",
  skipIfOpen: false,
};
const closed = replayPerpsPriceCross({
  bars: [
    { timeMs: 1_000, open: 90, high: 92, low: 89, close: 91 },
    { timeMs: 2_000, open: 101, high: 101, low: 101, close: 101 },
  ],
  recipe: flatten,
  feeRate: 0,
  startingUsdt: 10_000,
});
assert.equal(closed.orders.length, 0);
assert.equal(closed.stats.trades, 0);

const both = replayPerpsPriceCross({
  bars: [
    { timeMs: 1_000, open: 99, high: 99, low: 99, close: 99 },
    { timeMs: 2_000, open: 100, high: 100, low: 100, close: 100 },
    { timeMs: 3_000, open: 110, high: 110, low: 110, close: 110 },
    { timeMs: 4_000, open: 90, high: 90, low: 90, close: 90 },
  ],
  recipe: {
    ...base,
    triggerCompare: "gte",
    triggerPrice: "100",
    skipIfOpen: true,
  },
  feeRate: 0,
  startingUsdt: 10_000,
});
assert.equal(both.orders.length, 1);
assert.equal(both.stats.openQty, 1);

const withTp = replayPerpsPriceCross({
  bars: [
    { timeMs: 1_000, open: 99, high: 99, low: 99, close: 99 },
    { timeMs: 2_000, open: 101, high: 101, low: 101, close: 101 },
    { timeMs: 3_000, open: 101, high: 120, low: 100, close: 110 },
  ],
  recipe: {
    ...base,
    tpsl: {
      takeProfit: 110,
      stopLoss: null,
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
  },
  feeRate: 0,
  startingUsdt: 10_000,
});
assert.equal(withTp.orders.length, 2);
assert.equal(withTp.orders[0]?.action, "buy");
assert.equal(withTp.orders[1]?.action, "flatten");
assert.equal(withTp.orders[1]?.reason, "take_profit");
assert.equal(withTp.orders[1]?.price, 110);
assert.equal(withTp.stats.trades, 1);
assert.equal(withTp.stats.openQty, 0);

const withSl = replayPerpsPriceCross({
  bars: [
    { timeMs: 1_000, open: 99, high: 99, low: 99, close: 99 },
    { timeMs: 2_000, open: 101, high: 101, low: 101, close: 101 },
    { timeMs: 3_000, open: 101, high: 102, low: 90, close: 95 },
  ],
  recipe: {
    ...base,
    tpsl: {
      takeProfit: null,
      stopLoss: 95,
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
  },
  feeRate: 0,
  startingUsdt: 10_000,
});
assert.equal(withSl.orders[1]?.action, "flatten");
assert.equal(withSl.orders[1]?.price, 95);

const broke = replayPerpsPriceCross({
  bars: [
    { timeMs: 1_000, open: 99, high: 99, low: 99, close: 99 },
    { timeMs: 2_000, open: 101, high: 101, low: 101, close: 101 },
  ],
  recipe: base,
  feeRate: 0,
  startingUsdt: 50,
});
assert.equal(broke.orders.length, 0);
assert.equal(broke.stats.startingUsdt, 50);
assert.equal(broke.stats.endingUsdt, 50);

const geared = replayPerpsPriceCross({
  bars: [
    { timeMs: 1_000, open: 99, high: 99, low: 99, close: 99 },
    { timeMs: 2_000, open: 101, high: 101, low: 101, close: 101 },
  ],
  recipe: base,
  feeRate: 0,
  startingUsdt: 50,
  leverage: 10,
});
assert.ok(geared.orders.length > 0);

const wiped = replayPerpsPriceCross({
  bars: [
    { timeMs: 1_000, open: 100, high: 100, low: 100, close: 100 },
    { timeMs: 2_000, open: 100, high: 100, low: 89, close: 92 },
    { timeMs: 3_000, open: 110, high: 110, low: 110, close: 110 },
  ],
  recipe: { ...base, size: "10" },
  feeRate: 0,
  startingUsdt: 100,
  leverage: 10,
});
const wipeFlat = wiped.orders.find((row) => row.action === "flatten");
assert.equal(wipeFlat?.reason, "liquidation");
assert.equal(wipeFlat?.price, 90);
assert.ok(Math.abs(wiped.stats.endingUsdt) < 1e-8);
assert.equal(wiped.stats.openSide, null);
assert.equal(
  wiped.orders.some((row) => row.atMs === 3_000),
  false,
);

console.log("backtest replay checks passed");
