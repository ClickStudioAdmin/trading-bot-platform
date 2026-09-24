import assert from "node:assert/strict";
import { replayChartSeries } from "./chart-series";
import { eventParameterSections } from "./event-pane";
import type { BacktestRecipe, ReplayEvent } from "./model";
import { rsiSeries, rsiValue } from "@/lib/dca/indicators";
import { fillSentence, parseReplayEvents, skippedEntrySentence } from "./events";
import { indicatorBecause } from "./explain";
import { replayPlayStats } from "./play";

const closes = Array.from({ length: 40 }, (_, index) => 100 + Math.sin(index / 3) * 5);
const series = rsiSeries(closes, 14);
const last = series[series.length - 1];
assert.equal(last, rsiValue(closes, 14));
assert.equal(series[13], null);

const sentence = fillSentence({
  reason: "entry",
  side: "long",
  price: 100,
  because: "RSI 14 on 15m crossed below 30 (31.2 → 28.4).",
});
assert.match(sentence, /Entry long at 100/);
assert.match(sentence, /28\.4/);
assert.match(sentence, /bar close/);

assert.match(
  skippedEntrySentence("short", "RSI crossed."),
  /Skipped entry short/,
);

const parsed = parseReplayEvents([
  {
    atMs: 1_000,
    kind: "fill",
    reason: "entry",
    orderIndex: 0,
    side: "long",
    text: sentence,
  },
  { atMs: 0, text: "drop" },
]);
assert.equal(parsed?.length, 1);
assert.equal(parsed?.[0]?.orderIndex, 0);
assert.equal(parseReplayEvents(null), null);

const reading = indicatorBecause({
  kind: "rsi",
  compare: "cross_lte",
  level: 30,
  period: 14,
  slowPeriod: null,
  multiplier: null,
  timeframe: "15",
  side: "long",
  closes,
  bars: closes.map((close) => ({ high: close, low: close, close })),
});
assert.match(reading, /RSI/);
assert.match(reading, /→/);

const stats = replayPlayStats(
  [
    {
      atMs: 1,
      action: "buy",
      side: "long",
      qty: 1,
      price: 100,
      feeUsdt: 1,
      realizedUsdt: -1,
      reason: "entry",
    },
    {
      atMs: 2,
      action: "flatten",
      side: "long",
      qty: 1,
      price: 110,
      feeUsdt: 1,
      realizedUsdt: 8,
      reason: "take_profit",
    },
  ],
  1000,
);
assert.equal(stats.trades, 1);
assert.equal(stats.winRate, 1);
assert.equal(stats.realizedUsdt, 7);

const recipe = {
  kind: "dca",
  startKind: "indicator",
  indicatorKind: "rsi",
  indicatorPeriod: 14,
  indicatorTimeframe: "15",
  indicatorCompare: "cross_lte",
  indicatorLevel: 30,
  confirm: {
    kind: "supertrend",
    timeframe: "240",
    compare: "gte",
    level: null,
    period: 10,
    multiplier: 3,
  },
  exitIf: {
    kind: "supertrend",
    timeframe: "240",
    compare: "lte",
    level: null,
    period: 10,
    multiplier: 3,
  },
} as BacktestRecipe;
const bars = Array.from({ length: 30 }, (_, index) => ({
  timeMs: 1_000 + index * 60_000,
  open: 100 + index,
  high: 102 + index,
  low: 99 + index,
  close: 101 + index,
}));
const layers = replayChartSeries(recipe, bars).layers;
assert.equal(layers.length, 2);
assert.equal(layers.some((row) => row.pane === "oscillator" && row.title.includes("RSI")), true);
assert.equal(
  layers.some(
    (row) =>
      row.pane === "price" &&
      row.title.includes("Supertrend") &&
      row.roles.includes("Secondary entry") &&
      row.roles.includes("Hard exit"),
  ),
  true,
);
const entryEvent: ReplayEvent = {
  atMs: 1_000,
  kind: "fill",
  reason: "entry",
  orderIndex: 0,
  side: "long",
  text: "Entry long at 100. RSI crossed below 30.",
};
const sections = eventParameterSections(recipe, entryEvent);
assert.equal(sections.some((row) => row.role === "Entry" && row.params.some((param) => param.value === "14")), true);
assert.equal(sections.some((row) => row.role === "Secondary entry" && row.params.some((param) => param.label === "Multiplier" && param.value === "3")), true);
