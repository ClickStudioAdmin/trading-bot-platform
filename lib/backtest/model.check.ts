import assert from "node:assert/strict";
import {
  backtestShouldRunInline,
  estimateBacktestBars,
  intervalMs,
  parseBacktestDateRange,
  parseComparableSymbols,
  parseStartingBalance,
} from "./model";

assert.equal(parseStartingBalance("").ok, false);
assert.equal(parseStartingBalance("0").ok, false);
assert.equal(parseStartingBalance("10000").ok, true);
if (parseStartingBalance("10,000").ok) {
  assert.equal(parseStartingBalance("10,000").ok, true);
}
const balance = parseStartingBalance("2500.5");
assert.equal(balance.ok, true);
if (balance.ok) {
  assert.equal(balance.startingUsdt, 2500.5);
}

assert.equal(parseBacktestDateRange("", "2026-08-01", "60").ok, false);
assert.equal(parseBacktestDateRange("2026-08-10", "2026-08-01", "60").ok, false);
const month = parseBacktestDateRange("2026-07-01", "2026-07-31", "60");
assert.equal(month.ok, true);
if (month.ok) {
  assert.equal(month.fromMs, Date.UTC(2026, 6, 1));
  assert.ok(month.toMs > month.fromMs);
}
assert.equal(
  parseBacktestDateRange("2026-01-01", "2026-08-01", "15").ok,
  true,
);
assert.equal(
  parseBacktestDateRange("2020-01-01", "2026-01-01", "5").ok,
  false,
);
assert.equal(intervalMs("5"), 5 * 60 * 1000);
assert.equal(intervalMs("120"), 120 * 60 * 1000);
assert.equal(
  estimateBacktestBars(Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 2), "60"),
  24,
);
assert.equal(backtestShouldRunInline(800, 2), true);
assert.equal(backtestShouldRunInline(2000, 1), false);
assert.deepEqual(parseComparableSymbols("ETHUSDT, SOLUSDT, BTCUSDT", "BTCUSDT"), [
  "ETHUSDT",
  "SOLUSDT",
]);

console.log("backtest model checks passed");
