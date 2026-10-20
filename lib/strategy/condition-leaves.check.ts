import assert from "node:assert/strict";
import { decideDcaTick } from "@/lib/dca/playbook";
import { claimsConflict } from "@/lib/strategy/conflicts";
import {
  addStackMet,
  emptyEntryStack,
  entryExprMetaFromJson,
  entryExprToJson,
  type StrategyLeaf,
} from "@/lib/strategy/expr";
import { protectionMet } from "@/lib/strategy/protection";
import { retraceClaim, retraceMet, type RetraceSpec } from "@/lib/strategy/retrace";
import {
  RSI_DIVERGENCE_LINE_COLOR,
  rsiDivergenceChartLines,
  rsiDivergenceClaim,
  rsiDivergenceLine,
  rsiDivergenceLineColor,
  rsiDivergenceMet,
  rsiDivergenceSegments,
  type RsiDivergenceBar,
  type RsiDivergenceSettings,
} from "@/lib/strategy/rsi-divergence";

const retrace: RetraceSpec = {
  source: "last",
  from: "high",
  pct: 10,
  lookback: 3,
  timeframe: "15",
};

const highBars = [
  { high: 100, low: 90, close: 95 },
  { high: 110, low: 100, close: 108 },
  { high: 120, low: 105, close: 112 },
];

assert.equal(
  retraceMet({ spec: retrace, price: 108, bars: highBars }),
  true,
  "10% back from the window high",
);
assert.equal(
  retraceMet({ spec: retrace, price: 114, bars: highBars }),
  false,
  "a smaller dip stays unmet",
);
assert.equal(
  retraceMet({
    spec: { ...retrace, from: "low" },
    price: 99,
    bars: highBars,
  }),
  true,
  "10% up from the window low",
);
assert.equal(
  retraceMet({ spec: retrace, price: 100, bars: highBars.slice(0, 2) }),
  false,
  "a short window stays unmet",
);

const sameRetrace = retraceClaim({
  source: "last",
  from: "high",
  timeframe: "15",
});
assert.equal(claimsConflict(sameRetrace, sameRetrace), true);
assert.equal(
  claimsConflict(
    sameRetrace,
    retraceClaim({ source: "mark", from: "high", timeframe: "15" }),
  ),
  false,
);

const bullish: RsiDivergenceBar[] = [
  { high: 120, low: 110, close: 112 },
  { high: 115, low: 105, close: 106 },
  { high: 108, low: 100, close: 101 },
  { high: 130, low: 108, close: 128 },
  { high: 140, low: 120, close: 138 },
  { high: 125, low: 99, close: 100 },
  { high: 150, low: 90, close: 148 },
  { high: 155, low: 140, close: 150 },
];
const regularBull: RsiDivergenceSettings = {
  when: "bullish",
  style: "regular",
  pivotBars: 1,
  span: 20,
  minPricePct: null,
  minRsi: null,
};
const bullLine = rsiDivergenceLine({
  bars: bullish,
  period: 2,
  settings: regularBull,
});
assert.ok(bullLine);
assert.equal(bullLine.olderPrice > bullLine.newerPrice, true);
assert.equal(bullLine.newerRsi > bullLine.olderRsi, true);
assert.equal(
  rsiDivergenceMet({ bars: bullish, period: 2, settings: regularBull }),
  true,
);
assert.equal(
  rsiDivergenceMet({
    bars: [...bullish, { high: 160, low: 145, close: 152 }],
    period: 2,
    settings: regularBull,
  }),
  false,
  "it fires only on the confirmation candle",
);
assert.equal(
  rsiDivergenceLine({
    bars: bullish.slice(0, 7),
    period: 2,
    settings: regularBull,
  }),
  null,
  "an unconfirmed swing is not drawn",
);

const failedMins = rsiDivergenceLine({
  bars: bullish,
  period: 2,
  settings: { ...regularBull, minPricePct: 1000 },
});
assert.ok(failedMins);
assert.equal(failedMins.minsPass, false);
assert.equal(
  rsiDivergenceMet({
    bars: bullish,
    period: 2,
    settings: { ...regularBull, minPricePct: 1000 },
  }),
  false,
);

const bearish: RsiDivergenceBar[] = [
  { high: 100, low: 90, close: 95 },
  { high: 110, low: 100, close: 108 },
  { high: 140, low: 120, close: 138 },
  { high: 130, low: 80, close: 82 },
  { high: 90, low: 70, close: 72 },
  { high: 145, low: 100, close: 102 },
  { high: 160, low: 110, close: 112 },
  { high: 150, low: 100, close: 104 },
];
const bearLine = rsiDivergenceLine({
  bars: bearish,
  period: 2,
  settings: { ...regularBull, when: "bearish" },
});
assert.ok(bearLine);
assert.equal(bearLine.newerPrice > bearLine.olderPrice, true);
assert.equal(bearLine.newerRsi < bearLine.olderRsi, true);

const hiddenBull: RsiDivergenceBar[] = [
  { high: 100, low: 90, close: 98 },
  { high: 110, low: 70, close: 108 },
  { high: 120, low: 60, close: 118 },
  { high: 130, low: 100, close: 125 },
  { high: 140, low: 110, close: 135 },
  { high: 120, low: 80, close: 82 },
  { high: 100, low: 75, close: 78 },
  { high: 110, low: 90, close: 95 },
];
const hiddenBullLine = rsiDivergenceLine({
  bars: hiddenBull,
  period: 2,
  settings: { ...regularBull, style: "hidden" },
});
assert.ok(hiddenBullLine);
assert.equal(hiddenBullLine.newerPrice > hiddenBullLine.olderPrice, true);
assert.equal(hiddenBullLine.newerRsi < hiddenBullLine.olderRsi, true);

const hiddenBear: RsiDivergenceBar[] = [
  { high: 200, low: 180, close: 190 },
  { high: 210, low: 100, close: 110 },
  { high: 220, low: 90, close: 95 },
  { high: 150, low: 80, close: 85 },
  { high: 140, low: 70, close: 75 },
  { high: 160, low: 100, close: 155 },
  { high: 190, low: 150, close: 185 },
  { high: 180, low: 140, close: 150 },
];
const hiddenBearLine = rsiDivergenceLine({
  bars: hiddenBear,
  period: 2,
  settings: { ...regularBull, when: "bearish", style: "hidden" },
});
assert.ok(hiddenBearLine);
assert.equal(hiddenBearLine.newerPrice < hiddenBearLine.olderPrice, true);
assert.equal(hiddenBearLine.newerRsi > hiddenBearLine.olderRsi, true);

const chartBull = rsiDivergenceChartLines({
  bars: bullish,
  period: 2,
  settings: regularBull,
  everyShape: false,
});
assert.ok(
  chartBull.some(
    (line) =>
      line.olderIndex === bullLine.olderIndex && line.newerIndex === bullLine.newerIndex,
  ),
  "the chart keeps the pair the signal would use",
);
const everyShape = rsiDivergenceChartLines({
  bars: bullish,
  period: 2,
  settings: regularBull,
  everyShape: true,
});
assert.ok(everyShape.some((line) => line.when === "bullish" && line.style === "regular"));

const gap = Array.from({ length: 30 }, (_, index) => {
  const close = 180 + (index % 2 === 0 ? 3 : -3);
  return { high: close + 2, low: close - 2, close };
});
const history = [
  ...bullish,
  ...gap,
  ...bullish.map((bar) => ({
    high: bar.high + 80,
    low: bar.low + 80,
    close: bar.close + 80,
  })),
];
const narrow = { ...regularBull, span: 8 };
const signal = rsiDivergenceLine({ bars: history, period: 2, settings: narrow });
const painted = rsiDivergenceChartLines({
  bars: history,
  period: 2,
  settings: narrow,
  everyShape: false,
});
assert.ok(signal);
assert.ok(painted.length >= 2, "older divergences stay on the chart");
assert.ok(
  painted.some((line) => line.olderIndex < history.length - narrow.span),
  "a pair outside the signal window is still drawn",
);
assert.ok(signal.olderIndex >= history.length - narrow.span);

const segments = rsiDivergenceSegments({
  bars: bullish.map((bar, index) => ({ ...bar, timeMs: (index + 1) * 86_400_000 })),
  period: 2,
  settings: regularBull,
  everyShape: true,
});
assert.ok(segments.length >= 1);
assert.ok(segments.some((segment) => segment.color === RSI_DIVERGENCE_LINE_COLOR.regularBullish));
assert.equal(
  rsiDivergenceLineColor("bearish", "hidden"),
  RSI_DIVERGENCE_LINE_COLOR.hiddenBearish,
);
assert.ok(segments.every((segment) => segment.newerTime > segment.olderTime));
assert.ok(segments.some((segment) => segment.marker === "up"));

assert.equal(
  claimsConflict(
    rsiDivergenceClaim({ when: "bullish", period: 14, timeframe: "15" }),
    rsiDivergenceClaim({ when: "bearish", period: 14, timeframe: "15" }),
  ),
  true,
);
assert.equal(
  claimsConflict(
    rsiDivergenceClaim({ when: "bullish", period: 14, timeframe: "15" }),
    rsiDivergenceClaim({ when: "bullish", period: 14, timeframe: "15" }),
  ),
  false,
);

assert.equal(
  protectionMet({
    spec: { is: "protected", amount: "entire", pct: null },
    openQty: 0,
    provenPct: 100,
  }),
  false,
);
assert.equal(
  protectionMet({
    spec: { is: "no_loss", amount: "entire", pct: null },
    openQty: null,
    provenPct: 100,
    noLossProvenPct: 100,
  }),
  false,
);
assert.equal(
  protectionMet({
    spec: { is: "protected", amount: "entire", pct: null },
    openQty: 2,
    provenPct: 100,
  }),
  true,
);
assert.equal(
  protectionMet({
    spec: { is: "protected", amount: "at_least", pct: 40 },
    openQty: 2,
    provenPct: 39,
  }),
  false,
);
assert.equal(
  protectionMet({
    spec: { is: "no_loss", amount: "at_least", pct: 40 },
    openQty: 2,
    provenPct: 100,
    noLossProvenPct: 39,
  }),
  false,
);

const leaf: StrategyLeaf = { kind: "retrace", ...retrace };
const other: StrategyLeaf = {
  kind: "retrace",
  ...retrace,
  source: "mark",
};
assert.equal(addStackMet({ stack: emptyEntryStack(), leaves: [] }), true);
assert.equal(
  addStackMet({
    stack: { leaves: [leaf], joins: ["and"] },
    leaves: [false],
  }),
  false,
);
assert.equal(
  addStackMet({
    stack: { leaves: [leaf, other], joins: ["and", "or"] },
    leaves: [false, true],
  }),
  true,
  "an Or group does not pass on a dummy lead",
);

const saved = entryExprToJson(emptyEntryStack(), {
  retrace,
  divergence: regularBull,
  add: { leaves: [leaf], joins: ["and"] },
});
const meta = entryExprMetaFromJson(saved);
assert.deepEqual(meta.retrace, retrace);
assert.equal(meta.divergence?.when, "bullish");
assert.equal(meta.add?.leaves.length, 1);

const prices = { last: 100, mark: 100, index: 100 };
const tick = {
  side: "long" as const,
  reduceOnly: false,
  lastPrice: 90,
  mark: 90,
  lastClipPrice: 100,
  lastClipAtMs: 0,
  nowMs: 60_000,
  dipPct: 5,
  intervalMinutes: null as number | null,
  clipsFilled: 1,
  maxClips: 4,
  maxValue: null as number | null,
  positionQty: 1,
  entryPrice: 100,
  takeProfitPct: null as number | null,
  stopLossPct: null as number | null,
  armTrigger: null,
  armConditionTrue: false,
  disarmTrigger: null,
  disarmConditionTrue: false,
  triggerPrices: prices,
  status: "armed" as const,
};

assert.equal(
  decideDcaTick({
    ...tick,
    startKind: "retrace",
    clipsFilled: 0,
    positionQty: null,
  }).action.kind,
  "none",
);
assert.equal(
  decideDcaTick({
    ...tick,
    startKind: "retrace",
    clipsFilled: 0,
    positionQty: null,
    retraceMet: true,
  }).action.kind,
  "arm",
);
assert.equal(decideDcaTick(tick).action.kind, "clip");
assert.equal(decideDcaTick({ ...tick, addMet: false }).action.kind, "none");
