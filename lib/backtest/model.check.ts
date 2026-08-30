import assert from "node:assert/strict";
import {
  backtestShouldRunInline,
  estimateBacktestBars,
  formatBacktestReturnPct,
  intervalMs,
  parseBacktestDateRange,
  parseComparableSymbols,
  parseStartingBalance,
  peakLockedNotionalUsdt,
  returnOnCapitalUsedPct,
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

assert.equal(formatBacktestReturnPct(0.000617), "0.06%");
assert.equal(formatBacktestReturnPct(null), "—");
assert.equal(
  peakLockedNotionalUsdt([
    {
      atMs: 1,
      action: "buy",
      side: "long",
      qty: 1,
      price: 100,
      feeUsdt: 0,
      realizedUsdt: 0,
    },
    {
      atMs: 2,
      action: "buy",
      side: "long",
      qty: 1,
      price: 120,
      feeUsdt: 0,
      realizedUsdt: 0,
    },
    {
      atMs: 3,
      action: "flatten",
      side: "long",
      qty: 2,
      price: 130,
      feeUsdt: 0,
      realizedUsdt: 40,
    },
  ]),
  220,
);
assert.equal(returnOnCapitalUsedPct(6.17, 100), 0.0617);

console.log("backtest model checks passed");
