import assert from "node:assert/strict";
import {
  clipCandlesToWindow,
  isValidCandleBar,
  parseCandleInterval,
  parseCandleLimit,
  parseCandleSymbol,
  parseCandleVenue,
  parseOptionalMs,
} from "./candles";

assert.equal(parseCandleVenue("bybit"), "bybit");
assert.equal(parseCandleVenue("Hyperliquid"), "hyperliquid");
assert.equal(parseCandleVenue("mexc"), null);
assert.equal(parseCandleInterval("60"), "60");
assert.equal(parseCandleInterval("D"), "D");
assert.equal(parseCandleInterval("3"), null);
assert.equal(parseCandleSymbol("btcusdt"), "BTCUSDT");
assert.equal(parseCandleSymbol("btc"), "BTC");
assert.equal(parseCandleSymbol("x"), null);
assert.equal(parseOptionalMs("1000"), 1000);
assert.equal(parseOptionalMs(""), null);
assert.equal(parseCandleLimit("200"), 200);
assert.equal(parseCandleLimit("99999"), 1500);
assert.equal(
  isValidCandleBar({
    timeMs: 1,
    open: 1,
    high: 2,
    low: 1,
    close: 1.5,
  }),
  true,
);
assert.equal(
  isValidCandleBar({
    timeMs: 1,
    open: 1,
    high: 1,
    low: 2,
    close: 1,
  }),
  false,
);

const clipped = clipCandlesToWindow(
  [
    { timeMs: 1_000, open: 1, high: 1, low: 1, close: 1 },
    { timeMs: 2_000, open: 1, high: 1, low: 1, close: 1 },
    { timeMs: 3_000, open: 1, high: 1, low: 1, close: 1 },
    { timeMs: 4_000, open: 1, high: 1, low: 1, close: 1 },
    { timeMs: 5_000, open: 1, high: 1, low: 1, close: 1 },
  ],
  2_500,
  3_500,
);
assert.deepEqual(
  clipped.map((row) => row.timeMs),
  [2_000, 3_000, 4_000],
);

console.log("candle parse checks passed");
