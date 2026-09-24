import assert from "node:assert/strict";
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
