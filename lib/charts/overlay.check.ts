import assert from "node:assert/strict";
import {
  CHART_COLORS,
  buildBacktestChartOverlay,
  buildLiveChartOverlay,
  snapOverlayToCandles,
} from "./overlay";

const live = buildLiveChartOverlay({
  symbol: "BTCUSDT",
  positions: [
    {
      id: "p1",
      symbol: "BTCUSDT",
      side: "long",
      entryPrice: 100,
      takeProfit: 110,
      stopLoss: 90,
      trailingStop: 95,
      trailingActive: 96,
    },
    {
      id: "p2",
      symbol: "ETHUSDT",
      side: "short",
      entryPrice: 3,
      takeProfit: null,
      stopLoss: null,
      trailingStop: null,
      trailingActive: null,
    },
  ],
  working: [
    {
      id: "w1",
      symbol: "BTCUSDT",
      limitPrice: 99,
      action: "buy",
    },
  ],
  orders: [
    {
      id: "o1",
      action: "buy",
      price: 100,
      filledAtMs: 1_700_000_000_000,
    },
  ],
});

assert.equal(live.lines.length, 5);
assert.equal(live.markers.length, 1);
assert.equal(live.markers[0]?.shape, "arrowUp");

const replay = buildBacktestChartOverlay({
  triggerPrice: 50,
  orders: [
    {
      atMs: 1_700_000_000_000,
      action: "sell",
      side: "short",
      qty: 1,
      price: 51,
      feeUsdt: 0.01,
      realizedUsdt: null,
    },
  ],
});
assert.equal(replay.lines.length, 1);
assert.equal(replay.lines.some((row) => row.title === "When"), true);
assert.equal(replay.markers[0]?.shape, "circle");
assert.equal(replay.markers[0]?.text, "Open short");

const closed = buildBacktestChartOverlay({
  triggerPrice: null,
  orders: [
    {
      atMs: 1_700_000_000_000,
      action: "buy",
      side: "long",
      qty: 1,
      price: 100,
      feeUsdt: 0,
      realizedUsdt: null,
    },
    {
      atMs: 1_700_000_100_000,
      action: "flatten",
      side: "long",
      qty: 1,
      price: 110,
      feeUsdt: 0,
      realizedUsdt: 10,
    },
  ],
});
assert.equal(closed.lines.some((row) => row.title.startsWith("Open")), false);
assert.equal(closed.markers[0]?.text, "Entry");
assert.equal(closed.markers[1]?.text, "Close");

const liqOverlay = buildBacktestChartOverlay({
  triggerPrice: null,
  orders: [
    {
      atMs: 1_700_000_000_000,
      action: "buy",
      side: "long",
      qty: 1,
      price: 100,
      feeUsdt: 0,
      realizedUsdt: null,
    },
    {
      atMs: 1_700_000_100_000,
      action: "flatten",
      side: "long",
      qty: 1,
      price: 90,
      feeUsdt: 0,
      realizedUsdt: -10,
      reason: "liquidation",
    },
  ],
});
assert.equal(liqOverlay.markers[1]?.text, "Liq");
assert.equal(liqOverlay.markers[1]?.color, CHART_COLORS.stopLoss);

const olderEntry = {
  atMs: 1_700_000_000_000,
  action: "buy" as const,
  side: "long" as const,
  qty: 1,
  price: 100,
  feeUsdt: 0,
  realizedUsdt: -1,
  reason: "entry" as const,
  clipIndex: 1,
};
const olderTp = {
  atMs: 1_700_000_050_000,
  action: "flatten" as const,
  side: "long" as const,
  qty: 1,
  price: 110,
  feeUsdt: 0,
  realizedUsdt: 10,
  reason: "take_profit" as const,
};
const lateEntry = {
  atMs: 1_700_000_200_000,
  action: "buy" as const,
  side: "long" as const,
  qty: 1,
  price: 100,
  feeUsdt: 0,
  realizedUsdt: -1,
  reason: "entry" as const,
  clipIndex: 1,
};
const lateAdd = {
  atMs: 1_700_000_250_000,
  action: "buy" as const,
  side: "long" as const,
  qty: 1,
  price: 90,
  feeUsdt: 0,
  realizedUsdt: -1,
  reason: "clip" as const,
  clipIndex: 2,
};
const lateLiq = {
  atMs: 1_700_000_300_000,
  action: "flatten" as const,
  side: "long" as const,
  qty: 2,
  price: 80,
  feeUsdt: 0,
  realizedUsdt: -30,
  reason: "liquidation" as const,
};
const focused = buildBacktestChartOverlay({
  triggerPrice: null,
  orders: [olderEntry, olderTp, lateEntry, lateAdd, lateLiq],
  levels: {
    entry: 95,
    takeProfit: null,
    stopLoss: null,
    liquidation: 80,
    side: "long",
  },
});
assert.deepEqual(
  focused.markers.map((row) => row.text),
  ["TP", "Entry", "Add 2", "Liq"],
);
assert.equal(
  focused.lines.some((row) => row.title === "Liquidation"),
  true,
);

const leveled = buildBacktestChartOverlay({
  triggerPrice: null,
  orders: [],
  levels: {
    entry: 100,
    takeProfit: 110,
    stopLoss: 95,
    side: "long",
  },
});
assert.equal(
  leveled.lines.some((row) => row.title === "Entry long"),
  true,
);
assert.equal(
  leveled.lines.some((row) => row.title === "Take profit"),
  true,
);
assert.equal(
  leveled.lines.some((row) => row.title === "Stop loss"),
  true,
);

const snapped = snapOverlayToCandles(
  {
    lines: [],
    markers: [
      {
        timeSec: 100,
        position: "belowBar",
        color: "#34D399",
        shape: "arrowUp",
        text: "Buy",
      },
      {
        timeSec: 101,
        position: "belowBar",
        color: "#34D399",
        shape: "arrowUp",
        text: "Buy",
      },
      {
        timeSec: 50,
        position: "aboveBar",
        color: "#F07167",
        shape: "arrowDown",
        text: "Close",
      },
      {
        timeSec: 250,
        position: "aboveBar",
        color: "#F07167",
        shape: "arrowDown",
        text: "Liq",
      },
    ],
  },
  [
    { timeMs: 100_000, open: 1, high: 1, low: 1, close: 1 },
    { timeMs: 200_000, open: 1, high: 1, low: 1, close: 1 },
  ],
);
assert.equal(snapped.markers.length, 2);
assert.equal(snapped.markers[0]?.text, "Buy ×2");
assert.equal(snapped.markers[0]?.timeSec, 100);
assert.equal(snapped.markers[1]?.text, "Liq");
assert.equal(snapped.markers[1]?.timeSec, 200);

const afternoon = snapOverlayToCandles(
  {
    lines: [],
    markers: [
      {
        timeSec: 86_400 + 50_000,
        position: "aboveBar",
        color: "#34D399",
        shape: "arrowDown",
        text: "TP",
      },
      {
        timeSec: 172_800 + 3_600,
        position: "belowBar",
        color: "#F07167",
        shape: "arrowDown",
        text: "Entry",
      },
    ],
  },
  [
    { timeMs: 86_400_000, open: 1, high: 1, low: 1, close: 1 },
    { timeMs: 172_800_000, open: 1, high: 1, low: 1, close: 1 },
  ],
);
assert.equal(afternoon.markers[0]?.text, "TP");
assert.equal(afternoon.markers[0]?.timeSec, 86_400);
assert.equal(afternoon.markers[1]?.text, "Entry");
assert.equal(afternoon.markers[1]?.timeSec, 172_800);

console.log("chart overlay checks passed");
