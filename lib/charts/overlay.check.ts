import assert from "node:assert/strict";
import {
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
assert.equal(replay.markers[0]?.shape, "arrowDown");

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
    ],
  },
  [
    { timeMs: 100_000, open: 1, high: 1, low: 1, close: 1 },
    { timeMs: 200_000, open: 1, high: 1, low: 1, close: 1 },
  ],
);
assert.equal(snapped.markers.length, 1);
assert.equal(snapped.markers[0]?.text, "Buy ×2");
assert.equal(snapped.markers[0]?.timeSec, 100);

console.log("chart overlay checks passed");
