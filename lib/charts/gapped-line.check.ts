import assert from "node:assert/strict";
import { supertrendSeries } from "@/lib/dca/indicators";
import { gappedLineRuns } from "./gapped-line";

const day = 86_400_000;
const candles = [1, 2, 3, 4, 5, 6].map((index) => ({ timeMs: index * day }));

const split = gappedLineRuns(candles, [10, 11, null, null, 14, null]);
assert.equal(split.length, 2);
assert.deepEqual(split[0], [
  { time: 86_400, value: 10 },
  { time: 172_800, value: 11 },
]);
assert.deepEqual(split[1], [{ time: 432_000, value: 14 }]);
assert.equal(gappedLineRuns(candles, [10, 11, null, null, 14, null], 2).length, 1);
assert.deepEqual(gappedLineRuns(candles, [null, null, null], 2), []);

const bars: Array<{ high: number; low: number; close: number }> = [];
let price = 100;
for (let i = 0; i < 40; i += 1) {
  price -= 1;
  bars.push({ high: price + 1, low: price - 1, close: price });
}
for (let i = 0; i < 15; i += 1) {
  price += 8;
  bars.push({ high: price + 1, low: price - 1, close: price });
}
for (let i = 0; i < 20; i += 1) {
  price -= 6;
  bars.push({ high: price + 1, low: price - 1, close: price });
}
const series = supertrendSeries(bars, 10, 3);
const up = series.map((row) => (row && row.dir === 1 ? row.line : null));
const down = series.map((row) => (row && row.dir === -1 ? row.line : null));
const trendCandles = bars.map((_, index) => ({ timeMs: (index + 1) * day }));
const upRuns = gappedLineRuns(trendCandles, up);
const downRuns = gappedLineRuns(trendCandles, down);
const upTimes = new Set(upRuns.flat().map((point) => point.time));
assert.ok(upRuns.length > 0);
assert.ok(downRuns.length > 0);
for (const run of downRuns) {
  for (const point of run) {
    assert.equal(upTimes.has(point.time), false);
  }
}
for (let index = 0; index < up.length; index += 1) {
  assert.ok(up[index] == null || down[index] == null);
}

console.log("gapped line checks passed");
