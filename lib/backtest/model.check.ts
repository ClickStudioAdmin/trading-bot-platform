import assert from "node:assert/strict";
import {
  BACKTEST_CANDLE_LIMIT,
  backtestLinkHighlight,
  backtestDrainMaxBars,
  backtestPageCanRun,
  backtestShouldRunInline,
  estimateBacktestBars,
  formatBacktestReturnPct,
  intervalMs,
  backtestChartFetchBounds,
  backtestChartIntervalChoices,
  replayPlayRestarts,
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
  backtestWindowDays,
  backtestWindowEndingToday,
  matchingBacktestWindowDays,
  parseBacktestDates,
  backtestAprPct,
  backtestDrawdownCard,
  backtestOnNotionalPct,
  backtestQueueSeedFromRun,
  backtestRoePct,
  backtestRunTitle,
  detachBacktestFromTemplateDecision,
  templateBacktestLinks,
  templateBacktestLinksByTemplate,
  comparableBacktestName,
  parseBacktestName,
  readBacktestName,
  backtestVariantEdited,
  comparableSymbolsAfterDetach,
  isBacktestComparableChild,
  splitBacktestFamily,
  savedBacktestChildBadge,
  savedBacktestFamilies,
  filterSavedBacktestFamilies,
  savedBacktestListRows,
  backtestListSnapshot,
  completedBacktestNotionalUsdt,
  backtestListEntryHref,
  backtestNewHref,
  backtestReplayHref,
  backtestRerunHref,
  backtestSavedListHref,
  markReplayPlaybackConsumed,
  replayAutoplayStep,
  replayPlaybackConsumed,
  replayPlaybackRunId,
  replayRequestsPlayback,
  replaySearchWithoutPlayback,
  paginateBacktestList,
  parseBacktestListPage,
  parseBacktestRunIds,
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
for (const days of [30, 365, 1825, 3650]) {
  const window = backtestWindowEndingToday(days);
  const range = parseBacktestDates(window.from, window.to);
  assert.equal(range.ok, true);
  if (range.ok) {
    assert.equal(backtestWindowDays(range.fromMs, range.toMs), days);
  }
}

assert.equal(parseBacktestFillReason("liquidation"), "liquidation");
assert.equal(parseBacktestFillReason("exit_if"), "exit_if");
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
const tenYearMs = 10 * 366 * 24 * 60 * 60 * 1000;
const tenYearFifteen = estimateBacktestBars(0, tenYearMs, "15");
assert.ok(tenYearFifteen > 350_000);
assert.ok(tenYearFifteen <= BACKTEST_CANDLE_LIMIT);
assert.equal(
  chartIntervalForWindow(Date.UTC(2026, 6, 1), Date.UTC(2026, 6, 31), "15"),
  "30",
);
assert.equal(
  chartIntervalForWindow(Date.UTC(2026, 6, 1), Date.UTC(2026, 6, 31), "60"),
  "60",
);
assert.equal(
  chartIntervalForWindow(Date.UTC(2021, 9, 18), Date.UTC(2026, 9, 16), "15"),
  "D",
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
  backtestChartFetchBounds({
    fromMs: Date.UTC(2020, 11, 14),
    toMs: Date.UTC(2026, 9, 19),
  }),
  { fromMs: Date.UTC(2020, 11, 14), toMs: Date.UTC(2026, 9, 19) },
);
assert.equal(
  replayPlayRestarts({ started: true, head: 13, candleCount: 14 }),
  true,
);
assert.equal(
  replayPlayRestarts({ started: true, head: 3, candleCount: 14 }),
  false,
);
assert.equal(
  replayPlayRestarts({ started: false, head: 0, candleCount: 14 }),
  true,
);
assert.equal(backtestShouldRunInline(800, 2), true);
assert.equal(backtestShouldRunInline(2000, 1), true);
assert.equal(backtestShouldRunInline(4000, 1), false);
assert.equal(backtestShouldRunInline(800, 5), false);
assert.equal(
  backtestPageCanRun({
    fromMs: Date.UTC(2026, 0, 1),
    toMs: Date.UTC(2026, 0, 2),
    interval: "60",
  }),
  true,
);
assert.equal(
  backtestPageCanRun({
    fromMs: Date.UTC(2021, 8, 25),
    toMs: Date.UTC(2026, 8, 24),
    interval: "5",
  }),
  false,
);
assert.equal(
  backtestPageCanRun({
    fromMs: Date.UTC(2021, 8, 25),
    toMs: Date.UTC(2026, 8, 24),
    interval: "15",
  }),
  false,
);
assert.equal(
  backtestPageCanRun({
    fromMs: Date.UTC(2026, 0, 1),
    toMs: Date.UTC(2026, 0, 2),
    interval: "60",
    comparableSymbols: ["ETHUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT"],
  }),
  false,
);
assert.equal(backtestDrainMaxBars("cycle"), 3000);
assert.equal(backtestDrainMaxBars("worker"), 0);
assert.deepEqual(parseComparableSymbols("ETHUSDT, SOLUSDT, BTCUSDT", "BTCUSDT"), [
  "ETHUSDT",
  "SOLUSDT",
]);
assert.deepEqual(
  parseComparableSymbols("ETH, ETHUSDT, SOLUSDT", "BTCUSDT", "bybit"),
  ["ETHUSDT", "SOLUSDT"],
);
assert.deepEqual(
  parseComparableSymbols("ETHUSDT, SOL, BTC", "BTC", "hyperliquid"),
  ["ETH", "SOL"],
);

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

const attachedRows = [
  {
    id: "older",
    userId: "owner",
    status: "done" as const,
    name: "Dip 2024",
    symbol: "BTCUSDT",
    recipeName: "Dip buyer",
    parentRunId: null,
    fromMs: Date.UTC(2024, 0, 1),
    toMs: Date.UTC(2024, 6, 1),
    createdAtMs: 1,
  },
  {
    id: "newer",
    userId: "owner",
    status: "done" as const,
    name: null,
    symbol: "BTCUSDT",
    recipeName: "Dip buyer",
    parentRunId: null,
    fromMs: Date.UTC(2025, 0, 1),
    toMs: Date.UTC(2025, 6, 1),
    createdAtMs: 2,
  },
  {
    id: "queued",
    userId: "owner",
    status: "queued" as const,
    name: "Still running",
    symbol: "BTCUSDT",
    recipeName: "Dip buyer",
    parentRunId: null,
    fromMs: Date.UTC(2025, 0, 1),
    toMs: Date.UTC(2025, 6, 1),
    createdAtMs: 3,
  },
  {
    id: "other",
    userId: "someone-else",
    status: "done" as const,
    name: "Private",
    symbol: "ETHUSDT",
    recipeName: "Breakout",
    parentRunId: null,
    fromMs: Date.UTC(2023, 0, 1),
    toMs: Date.UTC(2023, 6, 1),
    createdAtMs: 4,
  },
  {
    id: "published",
    userId: null,
    status: "done" as const,
    name: "Published",
    symbol: "ETHUSDT",
    recipeName: "Breakout",
    parentRunId: "parent",
    fromMs: Date.UTC(2022, 0, 1),
    toMs: Date.UTC(2022, 6, 1),
    createdAtMs: 0,
  },
];
const ownerLinks = templateBacktestLinks(attachedRows, "owner", false);
assert.deepEqual(
  ownerLinks.map((row) => row.runId),
  ["newer", "older", "published"],
);
assert.equal(ownerLinks[0]?.name, "Dip buyer");
assert.equal(ownerLinks[1]?.name, "Dip 2024");
assert.equal(ownerLinks[2]?.name, "Published");
assert.deepEqual(
  templateBacktestLinks(attachedRows, "someone-else", false).map((row) => row.runId),
  ["other", "published"],
);
assert.deepEqual(
  templateBacktestLinks(attachedRows, "stranger", true).map((row) => row.runId),
  ["other", "newer", "older", "published"],
);
const grouped = templateBacktestLinksByTemplate(
  attachedRows.map((row, index) => ({
    ...row,
    templateId: index === 0 ? "template-a" : "template-b",
  })),
  "owner",
  false,
);
assert.deepEqual(
  grouped["template-a"]?.map((row) => row.runId),
  ["older"],
);
assert.deepEqual(
  grouped["template-b"]?.map((row) => row.runId),
  ["newer", "published"],
);
assert.equal(grouped["template-a"]?.[0]?.templateId, "template-a");
assert.equal(grouped["template-b"]?.[0]?.templateId, "template-b");
const userTemplate = {
  id: "user",
  visibility: "user",
  userId: "owner",
};
assert.deepEqual(
  detachBacktestFromTemplateDecision({
    runTemplateId: "user",
    template: userTemplate,
    userId: "owner",
    isAdmin: false,
  }),
  { ok: true },
);
assert.equal(
  detachBacktestFromTemplateDecision({
    runTemplateId: "platform",
    template: userTemplate,
    userId: "owner",
    isAdmin: true,
  }).ok,
  false,
);
assert.equal(
  detachBacktestFromTemplateDecision({
    runTemplateId: "user",
    template: userTemplate,
    userId: "stranger",
    isAdmin: false,
  }).ok,
  false,
);
assert.equal(
  detachBacktestFromTemplateDecision({
    runTemplateId: "platform",
    template: { id: "platform", visibility: "platform", userId: null },
    userId: "owner",
    isAdmin: false,
  }).ok,
  false,
);
assert.equal(
  detachBacktestFromTemplateDecision({
    runTemplateId: "platform",
    template: { id: "platform", visibility: "platform", userId: null },
    userId: "owner",
    isAdmin: true,
  }).ok,
  true,
);
assert.equal(ownerLinks[0]?.highlight, null);
const cardLinks = templateBacktestLinks(
  [
    {
      id: "card",
      userId: "owner",
      status: "done" as const,
      name: "Card",
      symbol: "BTCUSDT",
      recipeName: "Dip",
      parentRunId: null,
      fromMs: Date.UTC(2021, 9, 15),
      toMs: Date.UTC(2026, 9, 14),
      createdAtMs: 9,
      interval: "15",
      leverage: 10,
      stats: {
        trades: 427,
        wins: 427,
        winRate: 1,
        realizedUsdt: 5334.79,
        maxDrawdownUsdt: 0,
        profitFactor: null,
        timeInMarket: 0,
        openQty: 0,
        openSide: null,
        markUsdt: 0,
        startingUsdt: 10000,
        endingUsdt: 15334.79,
        returnPct: null,
      },
      orders: [],
    },
  ],
  "owner",
  false,
);
assert.equal(cardLinks[0]?.highlight?.trades, 427);
assert.equal(cardLinks[0]?.highlight?.symbol, "BTCUSDT");
assert.equal(cardLinks[0]?.highlight?.interval, "15");
assert.equal(cardLinks[0]?.highlight?.realizedUsdt, 5334.79);
assert.equal(cardLinks[0]?.highlight?.winRate, 1);
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
const wipedDd = backtestDrawdownCard(
  {
    trades: 13,
    startingUsdt: 10_000,
    maxDrawdownUsdt: 17_631,
  },
  { liquidated: true },
);
assert.equal(wipedDd.value, "100.00%");
assert.equal(wipedDd.note, "−$17,631");
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
  "/account/backtests/new?rerun=run-abc#replay",
);
assert.equal(
  backtestReplayHref("run-abc"),
  "/account/backtests/run-abc/replay",
);
assert.equal(
  backtestReplayHref("run-abc", true),
  "/account/backtests/run-abc/replay?play=1",
);
assert.equal(replayRequestsPlayback(""), false);
assert.equal(replayRequestsPlayback("?play=1"), true);
assert.equal(replayRequestsPlayback("?page=2&play=1"), true);
assert.equal(replayRequestsPlayback("?play=0"), false);
assert.equal(replaySearchWithoutPlayback("?play=1"), "");
assert.equal(replaySearchWithoutPlayback("?page=2&play=1"), "?page=2");
assert.equal(replaySearchWithoutPlayback("?page=2"), "?page=2");
assert.equal(
  replayPlaybackRunId("/account/backtests/run-abc/replay", "?play=1"),
  "run-abc",
);
assert.equal(
  replayPlaybackRunId("/account/backtests/run-abc/replay", ""),
  null,
);
assert.equal(
  replayPlaybackRunId("/account/backtests/run-abc", "?play=1"),
  null,
);
const playbackMemory = new Map<string, string>();
const playbackStorage = {
  getItem: (key: string) => playbackMemory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    playbackMemory.set(key, value);
  },
};
assert.equal(replayPlaybackConsumed(playbackStorage, "run-abc"), false);
markReplayPlaybackConsumed(playbackStorage, "run-abc");
assert.equal(replayPlaybackConsumed(playbackStorage, "run-abc"), true);
assert.equal(replayPlaybackConsumed(playbackStorage, "other"), false);

const idleCursor = { key: "", head: 0, playing: false };
const idlePlayback = { key: "", started: false };
const waiting = replayAutoplayStep({
  armed: true,
  candlesReady: false,
  candleKey: "run:15m:0:0",
  startHead: 0,
  cursor: idleCursor,
  playback: idlePlayback,
});
assert.equal(waiting.playing, false);
assert.equal(waiting.started, false);
assert.equal(waiting.disarm, false);
const candleKey = "run:15m:10:1000";
const starting = replayAutoplayStep({
  armed: true,
  candlesReady: true,
  candleKey,
  startHead: 0,
  cursor: waiting.cursor ?? idleCursor,
  playback: waiting.playback ?? idlePlayback,
});
assert.deepEqual(starting.cursor, { key: candleKey, head: 0, playing: true });
assert.deepEqual(starting.playback, { key: candleKey, started: true });
assert.equal(starting.playing, true);
assert.equal(starting.started, true);
assert.equal(starting.disarm, false);
const playingCursor = starting.cursor ?? idleCursor;
const playingFlag = starting.playback ?? idlePlayback;
const settled = replayAutoplayStep({
  armed: true,
  candlesReady: true,
  candleKey,
  startHead: 0,
  cursor: playingCursor,
  playback: playingFlag,
});
assert.equal(settled.cursor, null);
assert.equal(settled.playback, null);
assert.equal(settled.disarm, true);
assert.equal(settled.playing, true);
const paused = replayAutoplayStep({
  armed: false,
  candlesReady: true,
  candleKey,
  startHead: 0,
  cursor: { ...playingCursor, playing: false },
  playback: playingFlag,
});
assert.equal(paused.playing, false);
assert.equal(paused.cursor, null);
assert.equal(paused.disarm, false);
assert.equal(backtestNewHref(), "/account/backtests/new");
assert.equal(
  backtestNewHref({ draft: "d1", venue: "bybit", env: "demo", template: "" }),
  "/account/backtests/new?draft=d1&venue=bybit&env=demo",
);
assert.equal(backtestSavedListHref(), "/account/backtests");
assert.equal(backtestSavedListHref(1), "/account/backtests");
assert.equal(backtestSavedListHref(2), "/account/backtests?page=2");
assert.equal(backtestListEntryHref(null), null);
assert.equal(backtestListEntryHref({ page: "2" }), null);
assert.equal(backtestListEntryHref({ tab: "saved" }), "/account/backtests");
assert.equal(
  backtestListEntryHref({ tab: "saved", page: "2" }),
  "/account/backtests?page=2",
);
assert.equal(backtestListEntryHref({ tab: "new" }), "/account/backtests/new");
assert.equal(
  backtestListEntryHref({
    tab: "saved",
    rerun: "run-abc",
    venue: "bybit",
  }),
  "/account/backtests/new?rerun=run-abc&venue=bybit#replay",
);
assert.equal(
  backtestListEntryHref({ draft: "d1", env: "demo" }),
  "/account/backtests/new?draft=d1&env=demo",
);
assert.equal(
  backtestNewHref({ draft: "d1", bot: "flex:bot-1", venue: "bybit" }),
  "/account/backtests/new?draft=d1&bot=flex%3Abot-1&venue=bybit",
);
assert.equal(
  backtestListEntryHref({ draft: "d1", bot: "flex:bot-1" }),
  "/account/backtests/new?draft=d1&bot=flex%3Abot-1",
);
assert.equal(parseBacktestListPage("2"), 2);
assert.equal(parseBacktestListPage("0"), 1);
assert.equal(parseBacktestListPage("nope"), 1);
assert.deepEqual(paginateBacktestList(["a", "b", "c"], 2, 2), {
  rows: ["c"],
  page: 2,
  pageCount: 2,
  total: 3,
  from: 3,
  to: 3,
});
assert.equal(paginateBacktestList(["a"], 9, 25).page, 1);
assert.deepEqual(parseBacktestRunIds([" a ", "a", "", "b"]), ["a", "b"]);
const bulkForm = new FormData();
bulkForm.append("runId", "run-1");
bulkForm.append("runId", "run-2");
assert.deepEqual(parseBacktestRunIds(bulkForm), ["run-1", "run-2"]);
assert.equal(parseBacktestRunIds([]).length, 0);
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
  replayEvents: null,
  error: null,
  createdAtMs: 1,
  finishedAtMs: 2,
  parentRunId: null,
  comparableSymbols: ["SOLUSDT"],
  name: "October ETH",
  progressDone: null,
  progressTotal: null,
  progressPhase: null,
  claimCount: 0,
  retryAfterMs: null,
});
assert.equal(seeded.fromDate, "2021-01-01");
assert.equal(seeded.toDate, "2026-01-01");
assert.equal(seeded.startingUsdt, 1000);
assert.equal(seeded.leverage, 5);
assert.equal(seeded.interval, "15");
assert.equal(seeded.symbol, "ETHUSDT");
assert.equal(seeded.sourceTemplateId, "tmpl-1");
assert.deepEqual(seeded.comparables, ["SOLUSDT"]);
assert.equal(seeded.name, "October ETH");

assert.equal(comparableBacktestName("DCA Test - SOL"), "DCA Test - SOL");
assert.equal(comparableBacktestName("DCA Test - XRPUSDT"), "DCA Test - XRPUSDT");
assert.equal(comparableBacktestName("   "), "Backtest");
assert.equal(
  backtestRunTitle({
    recipe: { name: "DCA Test - SOL" },
    symbol: "XRPUSDT",
    parentRunId: "parent-1",
  }),
  "DCA Test - SOL",
);
assert.equal(
  backtestRunTitle({
    recipe: { name: "DCA Test - SOL" },
    symbol: "SOLUSDT",
    parentRunId: null,
  }),
  "DCA Test - SOL",
);
assert.equal(
  backtestRunTitle({
    name: "October ETH",
    recipe: { name: "My Winning Strategy" },
    symbol: "ETHUSDT",
    parentRunId: null,
  }),
  "October ETH",
);
assert.equal(
  backtestRunTitle({
    name: "   ",
    recipe: { name: "My Winning Strategy" },
    symbol: "ETHUSDT",
    parentRunId: "parent-1",
  }),
  "My Winning Strategy",
);
assert.equal(readBacktestName("  October   ETH  "), "October ETH");
assert.equal(readBacktestName(""), null);
const parsedBacktestName = parseBacktestName("  October   ETH  ");
assert.equal(parsedBacktestName.ok, true);
if (parsedBacktestName.ok) {
  assert.equal(parsedBacktestName.name, "October ETH");
}
assert.equal(parseBacktestName("   ").ok, false);

const familyRecipe = {
  kind: "dca",
  name: "My Winning Strategy",
  symbol: "ETHUSDT",
} as import("./model").BacktestRecipe;
const familyPrimary = {
  id: "primary",
  parentRunId: null,
  symbol: "ETHUSDT",
  recipe: familyRecipe,
  comparableSymbols: ["SOLUSDT"],
  fromMs: Date.UTC(2021, 0, 1),
  toMs: Date.UTC(2026, 0, 1),
  startingUsdt: 1000,
  leverage: 5,
  venue: "bybit",
  interval: "15",
  feePreset: "vip0_taker",
} as unknown as import("./model").BacktestRun;
const familyComparable = {
  ...familyPrimary,
  id: "comp-sol",
  parentRunId: "primary",
  symbol: "SOLUSDT",
  recipe: { ...familyRecipe, symbol: "SOLUSDT", name: "My Winning Strategy · SOLUSDT" },
  comparableSymbols: [],
} as import("./model").BacktestRun;
const familyVariation = {
  ...familyPrimary,
  id: "var-123",
  parentRunId: "primary",
  recipe: { ...familyRecipe, name: "My Winning Strategy 123" },
  leverage: 4,
  comparableSymbols: [],
} as import("./model").BacktestRun;
assert.equal(isBacktestComparableChild(familyPrimary, familyComparable), true);
assert.equal(isBacktestComparableChild(familyPrimary, familyVariation), false);
assert.deepEqual(
  comparableSymbolsAfterDetach(familyPrimary, familyComparable),
  [],
);
assert.deepEqual(
  comparableSymbolsAfterDetach(familyPrimary, familyVariation),
  ["SOLUSDT"],
);
const family = splitBacktestFamily(familyPrimary, [
  familyComparable,
  familyVariation,
  familyPrimary,
]);
assert.deepEqual(
  family.comparables.map((row) => row.id),
  ["comp-sol"],
);
assert.deepEqual(
  family.variations.map((row) => row.id),
  ["var-123"],
);
assert.deepEqual(
  savedBacktestChildBadge([
    { role: "comparable" },
    { role: "variation" },
  ]),
  { total: 2, label: "1 comparable, 1 variation" },
);
assert.deepEqual(
  savedBacktestChildBadge([
    { role: "variation" },
    { role: "variation" },
    { role: "variation" },
  ]),
  { total: 3, label: "3 variations" },
);
assert.equal(savedBacktestChildBadge([]), null);

const olderComparable = {
  ...familyComparable,
  id: "comp-old",
  symbol: "XRPUSDT",
  recipe: { ...familyRecipe, symbol: "XRPUSDT" },
  createdAtMs: 10,
} as import("./model").BacktestRun;
const newerComparable = {
  ...familyComparable,
  id: "comp-new",
  createdAtMs: 20,
} as import("./model").BacktestRun;
const datedVariation = {
  ...familyVariation,
  createdAtMs: 5,
} as import("./model").BacktestRun;
const grandchild = {
  ...familyVariation,
  id: "grand",
  parentRunId: "var-123",
  leverage: 3,
  createdAtMs: 30,
} as import("./model").BacktestRun;
const orphanChild = {
  ...familyVariation,
  id: "orphan",
  parentRunId: "missing-parent",
  createdAtMs: 1,
} as import("./model").BacktestRun;
const otherPrimary = {
  ...familyPrimary,
  id: "other",
  symbol: "BTCUSDT",
  createdAtMs: 3,
} as import("./model").BacktestRun;
const savedFamilies = savedBacktestFamilies([
  newerComparable,
  datedVariation,
  familyPrimary,
  olderComparable,
  grandchild,
  orphanChild,
  otherPrimary,
]);
assert.deepEqual(
  savedFamilies.map((row) => row.head.id),
  ["primary", "orphan", "other"],
);
assert.deepEqual(
  savedFamilies[0]?.children.map((row) => [row.run.id, row.role]),
  [
    ["comp-old", "comparable"],
    ["comp-new", "comparable"],
    ["var-123", "variation"],
    ["grand", "variation"],
  ],
);
assert.deepEqual(savedFamilies[1]?.children, []);
const childMatch = filterSavedBacktestFamilies(
  savedFamilies,
  (row) => row.id === "comp-new",
);
assert.deepEqual(
  childMatch.map((row) => row.head.id),
  ["primary"],
);
assert.deepEqual(
  childMatch[0]?.children.map((row) => row.run.id),
  ["comp-new"],
);
const parentMatch = filterSavedBacktestFamilies(
  savedFamilies,
  (row) => row.id === "primary",
);
assert.equal(parentMatch.length, 1);
assert.deepEqual(parentMatch[0]?.children, []);
const noneMatch = filterSavedBacktestFamilies(savedFamilies, () => false);
assert.deepEqual(noneMatch, []);
const openList = savedBacktestListRows(savedFamilies);
assert.deepEqual(
  openList.map((row) => [row.run.id, row.role]),
  [
    ["primary", null],
    ["comp-old", "comparable"],
    ["comp-new", "comparable"],
    ["var-123", "variation"],
    ["grand", "variation"],
    ["orphan", null],
    ["other", null],
  ],
);
const collapsedList = savedBacktestListRows(savedFamilies, new Set(["primary"]));
assert.deepEqual(
  collapsedList.map((row) => row.run.id),
  ["primary", "orphan", "other"],
);
const listOrder = (
  reason: "liquidation" | "stop",
): import("./model").SimulatedOrder => ({
  atMs: 1,
  action: "sell",
  side: "long",
  qty: 1,
  price: 1,
  feeUsdt: 0,
  realizedUsdt: null,
  reason,
});
const liquidatedSnapshot = backtestListSnapshot({
  ...familyPrimary,
  orders: [listOrder("liquidation")],
  replayEvents: [],
});
assert.equal(liquidatedSnapshot.orders[0]?.reason, "liquidation");
assert.equal(liquidatedSnapshot.orders.length, 1);
assert.equal(liquidatedSnapshot.replayEvents, null);
const quietSnapshot = backtestListSnapshot({
  ...familyPrimary,
  orders: [listOrder("stop")],
  replayEvents: [],
});
assert.deepEqual(quietSnapshot.orders, []);

const variantOrigin = {
  name: "October ETH",
  fromDate: "2021-10-02",
  toDate: "2026-10-01",
  startingBalance: "10,000",
  leverage: "10",
  venue: "bybit",
  venueEnvironment: null,
  symbol: "ETHUSDT",
};
assert.equal(
  backtestVariantEdited({
    origin: variantOrigin,
    current: variantOrigin,
    baselineRecipe: null,
    recipe: familyRecipe,
  }),
  false,
);
assert.equal(
  backtestVariantEdited({
    origin: variantOrigin,
    current: variantOrigin,
    baselineRecipe: familyRecipe,
    recipe: familyRecipe,
  }),
  false,
);
assert.equal(
  backtestVariantEdited({
    origin: variantOrigin,
    current: { ...variantOrigin, leverage: "4" },
    baselineRecipe: familyRecipe,
    recipe: familyRecipe,
  }),
  true,
);
assert.equal(
  backtestVariantEdited({
    origin: variantOrigin,
    current: variantOrigin,
    baselineRecipe: familyRecipe,
    recipe: { ...familyRecipe, name: "My Winning Strategy 123" },
  }),
  true,
);
assert.equal(
  backtestVariantEdited({
    origin: variantOrigin,
    current: { ...variantOrigin, name: "October ETH short" },
    baselineRecipe: familyRecipe,
    recipe: familyRecipe,
  }),
  true,
);

console.log("backtest model checks passed");
