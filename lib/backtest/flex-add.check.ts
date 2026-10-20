import assert from "node:assert/strict";
import { conditionOrderLevels } from "@/lib/backtest/condition-orders";
import { backtestFillLogMessage } from "@/lib/backtest/positions";
import { replayPerpsPriceCross } from "@/lib/backtest/replay";
import type { CandleBar } from "@/lib/market/candles";
import { retraceLevelPrice, retraceMet } from "@/lib/strategy/retrace";
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

const retrace = {
  source: "last" as const,
  from: "low" as const,
  pct: 1,
  lookback: 3,
  timeframe: "5" as const,
};
const level = retraceLevelPrice({
  spec: retrace,
  bars: [
    { high: 90, low: 90, close: 90 },
    { high: 80, low: 80, close: 80 },
    { high: 82, low: 82, close: 82 },
  ],
});
assert.equal(level, 80 * 1.01);
assert.equal(
  retraceMet({
    spec: retrace,
    price: 82,
    bars: [
      { high: 90, low: 90, close: 90 },
      { high: 80, low: 80, close: 80 },
      { high: 82, low: 82, close: 82 },
    ],
  }),
  true,
);
assert.equal(
  retraceMet({
    spec: retrace,
    price: 80,
    bars: [
      { high: 90, low: 90, close: 90 },
      { high: 80, low: 80, close: 80 },
      { high: 80, low: 80, close: 80 },
    ],
  }),
  false,
);

const longRecipe: PerpsTemplateRecipe = {
  kind: "flex",
  name: "Retrace add",
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
  tpsl: null,
  trailing: null,
  direction: "long",
  addStack: {
    leaves: [{ kind: "retrace", ...retrace }],
    joins: ["and"],
    orders: [{ size: "1", sizeUnit: "qty", orderType: "market", limitPrice: "" }],
  },
};

async function main(): Promise<void> {
const retraceRun = await replayPerpsPriceCross({
  bars: [
    bar(0, 100),
    bar(1, 90),
    bar(2, 80),
    bar(3, 81),
    bar(4, 82),
    bar(5, 83),
    bar(6, 70),
    bar(7, 72, 71, 72),
  ],
  recipe: longRecipe,
  feeRate: 0,
  startingUsdt: 100_000,
});
const clips = retraceRun.orders.filter((row) => row.reason === "clip");
assert.equal(clips.length, 2);
assert.equal(clips[0]?.clipIndex, 2);
assert.equal(clips[0]?.price, 81);
assert.equal(clips[1]?.clipIndex, 3);
assert.equal(clips[1]?.side, "long");
assert.match(retraceRun.events.find((row) => row.clipIndex === 2)?.text ?? "", /Add 2/);
assert.match(retraceRun.events.find((row) => row.clipIndex === 2)?.text ?? "", /retraced/);
assert.equal(backtestFillLogMessage(clips[0]!), "Entry #2 filled at 81.");
assert.equal(backtestFillLogMessage(clips[1]!), "Entry #3 filled at 72.");
assert.equal(
  retraceRun.orders.filter((row) => row.reason === "entry").length,
  1,
);

const limitRecipe: PerpsTemplateRecipe = {
  ...longRecipe,
  name: "Limit add",
  addStack: {
    leaves: [{ kind: "price", triggerBy: "last", compare: "lte", price: 90 }],
    joins: ["and"],
    orders: [{ size: "2", sizeUnit: "qty", orderType: "limit", limitPrice: "85" }],
  },
};
const limitRun = await replayPerpsPriceCross({
  bars: [
    bar(0, 100),
    bar(1, 92, 91, 94),
    bar(2, 88, 86, 89),
    bar(3, 87, 86, 88),
    bar(4, 86, 84, 88),
  ],
  recipe: limitRecipe,
  feeRate: 0,
  startingUsdt: 100_000,
});
const limitClips = limitRun.orders.filter((row) => row.reason === "clip");
assert.equal(limitClips.length, 1);
assert.equal(limitClips[0]?.price, 85);
assert.equal(limitClips[0]?.qty, 2);
assert.equal(limitClips[0]?.clipIndex, 2);
assert.match(limitRun.events.find((row) => row.reason === "clip")?.text ?? "", /Filled at the limit/);

const bothRecipe: PerpsTemplateRecipe = {
  kind: "flex",
  name: "Both add",
  symbol: "SOLUSDT",
  formAction: "buy",
  orderType: "market",
  sizeUnit: "qty",
  size: "1",
  limitPrice: "",
  entrySource: "price",
  triggerBy: "last",
  triggerCompare: "gte",
  triggerPrice: "1000000",
  skipIfOpen: true,
  tpsl: null,
  trailing: null,
  direction: "both",
  shortEntry: {
    entrySource: "price",
    webhookId: null,
    triggerBy: "last",
    triggerCompare: "lte",
    triggerPrice: 90,
    skipIfOpen: true,
    indicator: null,
    confirm: null,
    entryStack: { leaves: [], joins: [] },
    addStack: {
      leaves: [{ kind: "price", triggerBy: "last", compare: "lte", price: 80 }],
      joins: ["and"],
      orders: [{ size: "4", sizeUnit: "qty", orderType: "market", limitPrice: "" }],
    },
  },
};
const bothRun = await replayPerpsPriceCross({
  bars: [bar(0, 100), bar(1, 90), bar(2, 85), bar(3, 80), bar(4, 79)],
  recipe: bothRecipe,
  feeRate: 0,
  startingUsdt: 100_000,
});
assert.equal(bothRun.orders.filter((row) => row.side === "long").length, 0);
const shortClips = bothRun.orders.filter((row) => row.reason === "clip");
assert.equal(shortClips.length, 1);
assert.equal(shortClips[0]?.side, "short");
assert.equal(shortClips[0]?.qty, 4);
assert.equal(shortClips[0]?.clipIndex, 2);
assert.equal(backtestFillLogMessage(shortClips[0]!), "Entry #2 filled at 80.");

const levels = conditionOrderLevels({
  recipe: {
    ...longRecipe,
    tpsl: {
      takeProfit: 120,
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
  orders: [
    {
      atMs: bar(0, 100).timeMs,
      action: "buy",
      side: "long",
      qty: 1,
      price: 100,
      feeUsdt: 0,
      realizedUsdt: 0,
      reason: "entry",
      clipIndex: 1,
    },
  ],
  candles: [bar(0, 90), bar(1, 80), bar(2, 82)],
  tape: "5",
});
assert.equal(levels.some((row) => row.role === "exit" && row.title === "Long TP" && row.price === 120), true);
assert.equal(levels.some((row) => row.role === "add"), false);

console.log("flex add replay checks passed");
}

void main();
