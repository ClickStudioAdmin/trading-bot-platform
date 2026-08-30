import assert from "node:assert/strict";
import { buildBacktestChartOverlay, buildLiveChartOverlay } from "./overlay";

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

console.log("chart overlay checks passed");
