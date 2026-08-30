import assert from "node:assert/strict";
import {
  parseBacktestDateRange,
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
  false,
);

console.log("backtest model checks passed");
