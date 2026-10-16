import assert from "node:assert/strict";
import {
  hyperliquidCandleInterval,
  indicatorBarsAreCurrent,
  tallyBacktestCandles,
} from "./desk-klines";

assert.equal(hyperliquidCandleInterval("5"), "5m");
assert.equal(hyperliquidCandleInterval("60"), "1h");
assert.equal(hyperliquidCandleInterval("D"), "1d");
assert.equal(hyperliquidCandleInterval("720"), "12h");
assert.equal(hyperliquidCandleInterval("360"), "4h");

const openBar = [{ timeMs: 1_000, open: 1, high: 1, low: 1, close: 1 }];
assert.equal(indicatorBarsAreCurrent(openBar, "15", 1_000 + 15 * 60_000 - 1), true);
assert.equal(indicatorBarsAreCurrent(openBar, "15", 1_000 + 15 * 60_000), false);
assert.equal(indicatorBarsAreCurrent([], "15", 1_000), false);

const seen = new Set<number>();
const page = [
  { timeMs: 900, open: 1, high: 1, low: 1, close: 1 },
  { timeMs: 1_000, open: 1, high: 1, low: 1, close: 1 },
  { timeMs: 2_000, open: 1, high: 1, low: 1, close: 1 },
];
assert.equal(
  tallyBacktestCandles({ seen, bars: page, fromMs: 1_000, toMs: 2_000 }),
  2,
);
assert.equal(
  tallyBacktestCandles({
    seen,
    bars: [
      { timeMs: 2_000, open: 1, high: 1, low: 1, close: 1 },
      { timeMs: 3_000, open: 1, high: 1, low: 1, close: 1 },
    ],
    fromMs: 1_000,
    toMs: 3_000,
  }),
  3,
);

console.log("desk kline interval checks passed");
