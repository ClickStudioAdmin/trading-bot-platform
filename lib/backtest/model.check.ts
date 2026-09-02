import assert from "node:assert/strict";
import {
  backtestLinkHighlight,
  backtestShouldRunInline,
  estimateBacktestBars,
  formatBacktestReturnPct,
  intervalMs,
  backtestActivityBounds,
  backtestChartIntervalChoices,
  backtestChartIntervalFits,
  chartIntervalForWindow,
  parseBacktestDateRange,
  backtestTapeInterval,
  parseComparableSymbols,
  parseBacktestLeverage,
  parseStartingBalance,
  parseBacktestFillReason,
  backtestLiquidationPrice,
  backtestOutcomeLabel,
  backtestRunOutcome,
  firstAdverseFill,
  defaultBacktestDates,
  backtestWindowEndingToday,
  matchingBacktestWindowDays,
  backtestAprPct,
  backtestDrawdownCard,
  backtestOnNotionalPct,
  backtestQueueSeedFromRun,
  backtestRoePct,
  backtestRunTitle,
  comparableBacktestName,
  completedBacktestNotionalUsdt,
  backtestRerunHref,
  backtestSavedListHref,
  peakLockedNotionalUsdt,
  realizedAprPct,
  realizedEndingUsdt,
  realizedReturnPct,
  returnOnCapitalUsedPct,
  splitCompletedBacktestOrders,
  openBacktestPositionLabel,
} from "./model";

const defaultDates = defaultBacktestDates();
assert.deepEqual(defaultDates, backtestWindowEndingToday(365));
assert.equal(matchingBacktestWindowDays(defaultDates.from, defaultDates.to), 365);
assert.equal(
  matchingBacktestWindowDays(
    backtestWindowEndingToday(30).from,
    backtestWindowEndingToday(30).to,
  ),
  30,
);
assert.equal(matchingBacktestWindowDays("2020-01-01", defaultDates.to), null);

assert.equal(parseBacktestFillReason("liquidation"), "liquidation");
assert.equal(
  backtestLiquidationPrice({
    side: "long",
    entry: 100,
    qty: 10,
    cashUsdt: 100,
  }),
  90,
);
assert.equal(
  backtestLiquidationPrice({
    side: "short",
    entry: 100,
    qty: 10,
    cashUsdt: 100,
  }),
  110,
);
assert.equal(
  backtestLiquidationPrice({
    side: "long",
    entry: 100,
    qty: 1,
    cashUsdt: 10_000,
  }),
  null,
);
assert.deepEqual(
  firstAdverseFill("long", 89, [
    { price: 95, reason: "stop" },
    { price: 90, reason: "liquidation" },
  ]),
  { price: 95, reason: "stop" },
);
assert.deepEqual(
  firstAdverseFill("long", 89, [{ price: 90, reason: "liquidation" }]),
  { price: 90, reason: "liquidation" },
);
assert.equal(backtestOutcomeLabel("profit"), "Profit");
assert.equal(backtestOutcomeLabel("loss"), "Loss");
assert.equal(backtestOutcomeLabel("liquidated"), "Account Liquidated");
assert.equal(
  backtestRunOutcome({
    orders: [{ reason: "take_profit" }],
    realizedUsdt: 20,
  }),
  "profit",
);
assert.equal(
  backtestRunOutcome({
    orders: [{ reason: "stop" }],
    realizedUsdt: -20,
  }),
  "loss",
);
assert.equal(
  backtestRunOutcome({
    orders: [{ reason: "liquidation" }],
    realizedUsdt: -100,
  }),
  "liquidated",
);

assert.equal(parseStartingBalance("").ok, false);
assert.equal(parseStartingBalance("0").ok, false);
assert.equal(parseStartingBalance("10000").ok, true);
const leverageEmpty = parseBacktestLeverage("");
assert.equal(leverageEmpty.ok, true);
if (leverageEmpty.ok) {
  assert.equal(leverageEmpty.leverage, 1);
}
const leverageTen = parseBacktestLeverage("10");
assert.equal(leverageTen.ok, true);
if (leverageTen.ok) {
  assert.equal(leverageTen.leverage, 10);
}
assert.equal(parseBacktestLeverage("0").ok, false);
assert.equal(parseBacktestLeverage("200").ok, false);
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
  true,
);
assert.equal(
  parseBacktestDateRange("2016-01-01", "2026-01-01", "60").ok,
  true,
);
assert.equal(
  parseBacktestDateRange("2016-01-01", "2026-01-01", "5").ok,
  true,
);
assert.equal(
  parseBacktestDateRange("1970-01-01", "2026-01-01", "5").ok,
  false,
);
assert.equal(
  backtestTapeInterval(
    {
      kind: "dca",
      startKind: "indicator",
      indicatorTimeframe: "5",
    } as never,
    Date.UTC(2016, 0, 1),
    Date.UTC(2026, 0, 1),
  ),
  "5",
);
assert.equal(
  backtestTapeInterval(
    {
      kind: "dca",
      startKind: "indicator",
      indicatorTimeframe: "15",
      shortIndicatorTimeframe: "5",
    } as never,
    Date.UTC(2016, 0, 1),
    Date.UTC(2026, 0, 1),
  ),
  "5",
);
assert.equal(
  backtestTapeInterval(
    {
      kind: "dca",
      startKind: "price",
    } as never,
    Date.UTC(2026, 7, 1),
    Date.UTC(2026, 8, 1),
  ),
  "5",
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
assert.deepEqual(backtestChartIntervalChoices("5"), [
  "5",
  "15",
  "60",
  "240",
  "D",
]);
assert.deepEqual(backtestChartIntervalChoices("60"), [
  "15",
  "60",
  "240",
  "D",
]);
assert.equal(
  backtestChartIntervalFits(
    Date.UTC(2026, 0, 1),
    Date.UTC(2026, 0, 2),
    "5",
  ),
  true,
);
assert.equal(
  backtestChartIntervalFits(
    Date.UTC(2020, 0, 1),
    Date.UTC(2026, 0, 1),
    "15",
  ),
  false,
);
assert.deepEqual(
  backtestActivityBounds({
    fromMs: 1_000,
    toMs: 10_000,
    orders: [{ atMs: 4_000 }, { atMs: 7_000 }, { atMs: 5_000 }],
  }),
  { fromMs: 4_000, toMs: 7_000 },
);
assert.deepEqual(
  backtestActivityBounds({
    fromMs: 1_000,
    toMs: 10_000,
    orders: [],
  }),
  { fromMs: 1_000, toMs: 10_000 },
);
assert.deepEqual(
  backtestActivityBounds({
    fromMs: 1_000,
    toMs: 10_000,
    orders: [{ atMs: 4_000 }, { atMs: 7_000 }],
    padMs: 2_000,
  }),
  { fromMs: 2_000, toMs: 9_000 },
);
assert.equal(backtestShouldRunInline(800, 2), true);
assert.equal(backtestShouldRunInline(2000, 1), true);
assert.equal(backtestShouldRunInline(4000, 1), false);
assert.equal(backtestShouldRunInline(800, 5), false);
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
const highlight = backtestLinkHighlight({
  id: "run-1",
  symbol: "ETHUSDT",
  interval: "15",
  fromMs: Date.UTC(2021, 0, 1),
  toMs: Date.UTC(2026, 0, 1),
  leverage: 1,
  stats: {
    trades: 10,
    wins: 6,
    winRate: 0.6,
    realizedUsdt: 22,
    maxDrawdownUsdt: 0,
    profitFactor: 1,
    timeInMarket: 0.1,
    startingUsdt: 1000,
    endingUsdt: 1022,
    returnPct: 0.022,
    openQty: 0,
    openSide: null,
    markUsdt: 0,
  },
  orders: [
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
      price: 122,
      feeUsdt: 0,
      realizedUsdt: 22,
    },
  ],
});
assert.equal(highlight.runId, "run-1");
assert.equal(highlight.symbol, "ETHUSDT");
assert.equal(highlight.trades, 10);
assert.equal(highlight.winRate, 0.6);
assert.equal(highlight.realizedUsdt, 22);
assert.equal(highlight.returnPct, 0.022);
assert.equal(highlight.roePct, 0.22);
assert.ok(highlight.aprPct != null && highlight.aprPct > 0);
const closedClip = [
  {
    atMs: 1,
    action: "buy" as const,
    side: "long" as const,
    qty: 1,
    price: 100,
    feeUsdt: 0,
    realizedUsdt: 0,
  },
  {
    atMs: 2,
    action: "flatten" as const,
    side: "long" as const,
    qty: 1,
    price: 122,
    feeUsdt: 0,
    realizedUsdt: 22,
  },
];
assert.equal(completedBacktestNotionalUsdt(closedClip), 100);
assert.equal(backtestOnNotionalPct(22, closedClip), 0.22);
assert.equal(backtestRoePct(22, closedClip, 10), 2.2);
assert.equal(
  backtestAprPct(100, 0, Date.UTC(2025, 0, 1), Date.UTC(2026, 0, 1)),
  null,
);
const accountApr = backtestAprPct(
  100,
  1000,
  Date.UTC(2025, 0, 1),
  Date.UTC(2026, 0, 1),
);
assert.ok(accountApr != null && accountApr > 0 && accountApr < 0.1);
const zeroDd = backtestDrawdownCard({
  trades: 1,
  startingUsdt: 10_000,
  maxDrawdownUsdt: 0.4,
});
assert.equal(zeroDd.value, "0.00%");
assert.equal(zeroDd.toneClass, "text-ink-faint");
assert.equal(zeroDd.note, undefined);
const markedDd = backtestDrawdownCard({
  trades: 1,
  startingUsdt: 10_000,
  maxDrawdownUsdt: 80,
});
assert.equal(markedDd.value, "0.80%");
assert.equal(markedDd.toneClass, "text-danger");
assert.equal(markedDd.note, "−$80");
assert.equal(
  backtestDrawdownCard({
    trades: 0,
    startingUsdt: 10_000,
    maxDrawdownUsdt: 0,
  }).value,
  "—",
);
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
assert.equal(backtestSavedListHref(), "/account/backtests?tab=saved");
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
  leverage: 5,
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
assert.equal(seeded.leverage, 5);
assert.equal(seeded.interval, "15");
assert.equal(seeded.symbol, "ETHUSDT");
assert.equal(seeded.sourceTemplateId, "tmpl-1");
assert.deepEqual(seeded.comparables, ["SOLUSDT"]);

assert.equal(comparableBacktestName("DCA Test - SOL", "XRPUSDT"), "DCA Test - SOL · XRPUSDT");
assert.equal(comparableBacktestName("DCA Test - XRPUSDT", "XRPUSDT"), "DCA Test - XRPUSDT");
assert.equal(
  backtestRunTitle({
    recipe: { name: "DCA Test - SOL" },
    symbol: "XRPUSDT",
    parentRunId: "parent-1",
  }),
  "DCA Test - SOL · XRPUSDT",
);
assert.equal(
  backtestRunTitle({
    recipe: { name: "DCA Test - SOL" },
    symbol: "SOLUSDT",
    parentRunId: null,
  }),
  "DCA Test - SOL",
);

console.log("backtest model checks passed");
