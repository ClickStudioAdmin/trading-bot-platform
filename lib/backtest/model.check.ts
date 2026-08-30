import assert from "node:assert/strict";
import {
  backtestShouldRunInline,
  estimateBacktestBars,
  formatBacktestReturnPct,
  intervalMs,
  chartIntervalForWindow,
  parseBacktestDateRange,
  parseComparableSymbols,
  parseStartingBalance,
  backtestQueueSeedFromRun,
  backtestRerunHref,
  peakLockedNotionalUsdt,
  realizedAprPct,
  realizedEndingUsdt,
  realizedReturnPct,
  returnOnCapitalUsedPct,
  splitCompletedBacktestOrders,
  openBacktestPositionLabel,
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
assert.equal(
  parseBacktestDateRange("2016-01-01", "2026-01-01", "60").ok,
  true,
);
assert.equal(
  parseBacktestDateRange("2016-01-01", "2026-01-01", "5").ok,
  false,
);
assert.equal(intervalMs("5"), 5 * 60 * 1000);
assert.equal(intervalMs("120"), 120 * 60 * 1000);
assert.equal(
  estimateBacktestBars(Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 2), "60"),
  24,
);
assert.equal(
  chartIntervalForWindow(Date.UTC(2026, 6, 1), Date.UTC(2026, 6, 31), "15"),
  "30",
);
assert.equal(
  chartIntervalForWindow(Date.UTC(2026, 6, 1), Date.UTC(2026, 6, 31), "60"),
  "60",
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
assert.equal(
  realizedEndingUsdt({ startingUsdt: 1000, realizedUsdt: 72.25 }),
  1072.25,
);
assert.equal(
  realizedReturnPct({ startingUsdt: 1000, realizedUsdt: 72.25 }),
  0.07225,
);
const yearMs = 365.25 * 24 * 60 * 60 * 1000;
const fromApr = Date.UTC(2025, 0, 1);
const oneYearApr = realizedAprPct(100, 1000, fromApr, fromApr + yearMs);
assert.ok(oneYearApr != null && Math.abs(oneYearApr - 0.1) < 1e-6);
const oneYearOnClip = realizedAprPct(100, 100, fromApr, fromApr + yearMs);
assert.ok(oneYearOnClip != null && Math.abs(oneYearOnClip - 1) < 1e-6);
assert.equal(
  realizedAprPct(100, 1000, Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 1)),
  null,
);
assert.equal(realizedAprPct(100, 0, fromApr, fromApr + yearMs), null);

const split = splitCompletedBacktestOrders([
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
    action: "flatten",
    side: "long",
    qty: 1,
    price: 110,
    feeUsdt: 0,
    realizedUsdt: 10,
  },
  {
    atMs: 3,
    action: "buy",
    side: "long",
    qty: 0.5,
    price: 120,
    feeUsdt: 0,
    realizedUsdt: 0,
  },
]);
assert.equal(split.completed.length, 2);
assert.equal(split.open.length, 1);
assert.equal(split.open[0]?.qty, 0.5);
assert.equal(openBacktestPositionLabel(split.open), "long 0.5000");

assert.equal(
  backtestRerunHref("run-abc"),
  "/account/backtests?rerun=run-abc#replay",
);
const seeded = backtestQueueSeedFromRun({
  id: "run-abc",
  userId: "user-1",
  templateId: null,
  sourceTemplateId: "tmpl-1",
  studyId: null,
  deskType: "dca",
  venue: "bybit",
  venueEnvironment: null,
  symbol: "ETHUSDT",
  interval: "15",
  fromMs: Date.UTC(2021, 0, 1),
  toMs: Date.UTC(2026, 0, 1),
  startingUsdt: 1000,
  feePreset: "vip0_taker",
  feeRate: 0.0006,
  status: "done",
  recipe: {
    kind: "dca",
    name: "RSI",
    symbol: "BTCUSDT",
  } as import("./model").BacktestRecipe,
  stats: null,
  orders: [],
  error: null,
  createdAtMs: 1,
  finishedAtMs: 2,
  parentRunId: null,
  comparableSymbols: ["SOLUSDT"],
});
assert.equal(seeded.fromDate, "2021-01-01");
assert.equal(seeded.toDate, "2026-01-01");
assert.equal(seeded.startingUsdt, 1000);
assert.equal(seeded.interval, "15");
assert.equal(seeded.symbol, "ETHUSDT");
assert.equal(seeded.sourceTemplateId, "tmpl-1");
assert.deepEqual(seeded.comparables, ["SOLUSDT"]);

console.log("backtest model checks passed");
