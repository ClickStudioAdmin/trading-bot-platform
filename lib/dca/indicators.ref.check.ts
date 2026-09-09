import assert from "node:assert/strict";
import { fetchBybitKlineBars } from "@/lib/exchanges/bybit/client";
import { closedLiveIndicatorBars } from "@/lib/market/desk-klines";
import {
  bollingerBands,
  emaValues,
  indicatorStartMet,
  macdHistogram,
  rsiValue,
  smaValues,
  supertrendDirections,
  type DcaIndicatorCompare,
  type DcaIndicatorKind,
} from "./indicators";

const eurUsd = [
  1.08, 1.0825, 1.081, 1.084, 1.0835, 1.086, 1.088, 1.0865, 1.089, 1.087,
  1.0895, 1.091, 1.09, 1.092, 1.0915,
];
const rsi = rsiValue(eurUsd, 14);
assert.ok(rsi != null);
assert.ok(Math.abs(rsi - 72.55) < 0.05);

function refEma(closes: number[], period: number): number[] {
  if (closes.length < period) {
    return [];
  }
  const k = 2 / (period + 1);
  const out: number[] = [];
  let value =
    closes.slice(0, period).reduce((sum, close) => sum + close, 0) / period;
  out.push(value);
  for (let i = period; i < closes.length; i += 1) {
    value = closes[i] * k + value * (1 - k);
    out.push(value);
  }
  return out;
}

function refMacdHist(closes: number[]): number | null {
  const fast = refEma(closes, 12);
  const slow = refEma(closes, 26);
  if (slow.length === 0) {
    return null;
  }
  const macd = slow.map((value, i) => fast[fast.length - slow.length + i] - value);
  const signal = refEma(macd, 9);
  if (signal.length === 0) {
    return null;
  }
  return macd[macd.length - 1] - signal[signal.length - 1];
}

function refBb(closes: number[], period: number) {
  const window = closes.slice(-period);
  const mid = window.reduce((sum, close) => sum + close, 0) / period;
  const variance =
    window.reduce((sum, close) => sum + (close - mid) ** 2, 0) / period;
  const band = Math.sqrt(variance) * 2;
  return { mid, upper: mid + band, lower: mid - band };
}

function approxEqual(actual: number[], expected: number[], epsilon = 1e-9) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i += 1) {
    assert.ok(
      Math.abs((actual[i] ?? 0) - (expected[i] ?? 0)) < epsilon,
      `index ${i}: ${actual[i]} vs ${expected[i]}`,
    );
  }
}

const series = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 4 + i * 0.1);
assert.deepEqual(emaValues(series, 21), refEma(series, 21));
approxEqual(
  smaValues(series, 21),
  series.slice(20).map((_, i) => {
    const window = series.slice(i, i + 21);
    return window.reduce((sum, close) => sum + close, 0) / 21;
  }),
);
const bb = bollingerBands(series, 20);
const ref = refBb(series, 20);
assert.ok(bb);
assert.ok(Math.abs(bb.mid - ref.mid) < 1e-9);
assert.ok(Math.abs(bb.upper - ref.upper) < 1e-9);
assert.ok(Math.abs(bb.lower - ref.lower) < 1e-9);
const hist = macdHistogram(series);
const histRef = refMacdHist(series);
assert.ok(hist != null && histRef != null);
assert.ok(Math.abs(hist - histRef) < 1e-9);

const ramp = Array.from({ length: 40 }, (_, i) => ({
  high: 100 + i + 0.4,
  low: 100 + i - 0.4,
  close: 100 + i,
}));
const dirs = supertrendDirections(ramp, 10, 3);
assert.equal(dirs?.[dirs.length - 1], 1);
assert.equal(
  indicatorStartMet({
    kind: "supertrend",
    side: "long",
    closes: [],
    bars: ramp,
    compare: "gte",
    level: null,
  }),
  true,
);

console.log("dca indicator formula checks passed");

async function deskCard() {
  try {
    const raw = await fetchBybitKlineBars({
      symbol: "ETHUSDT",
      interval: "15",
      limit: 500,
    });
    const bars = closedLiveIndicatorBars(raw, "15");
    const closes = bars.map((row) => row.close);
    const last = closes[closes.length - 1];
    const rsi14 = rsiValue(closes, 14);
    const macd = macdHistogram(closes);
    const ema21 = emaValues(closes, 21).at(-1);
    const bands = bollingerBands(closes, 20);
    const st = supertrendDirections(bars, 10, 3);
    const stNow = st?.[st.length - 1];
    const stPrev = st?.[st.length - 2];
    console.log(
      JSON.stringify({
        venue: "bybit",
        symbol: "ETHUSDT",
        timeframe: "15m",
        closedBars: bars.length,
        close: last,
        rsi14,
        rsiAtOrBelow30: rsi14 != null && rsi14 <= 30,
        rsiCrossesBelow30: indicatorStartMet({
          kind: "rsi",
          side: "long",
          closes,
          compare: "cross_lte",
          level: 30,
          period: 14,
        }),
        macdHist: macd,
        macdIsAbove0: macd != null && macd > 0,
        ema21,
        priceIsAboveEma21: last != null && ema21 != null && last > ema21,
        bbLower: bands?.lower,
        bbUpper: bands?.upper,
        priceIsBelowBb: last != null && bands != null && last < bands.lower,
        supertrend: stNow === 1 ? "bullish" : stNow === -1 ? "bearish" : null,
        supertrendTurnedBullish: stPrev === -1 && stNow === 1,
        supertrendTurnedBearish: stPrev === 1 && stNow === -1,
      }),
    );
  } catch (error) {
    console.log(
      "bybit desk card skipped",
      error instanceof Error ? error.message : error,
    );
  }
}

type WalkRecipe = {
  kind: DcaIndicatorKind;
  compare: DcaIndicatorCompare;
  label: string;
  level: number | null;
  period?: number;
  slowPeriod?: number;
  multiplier?: number;
};

const WALK_RECIPES: WalkRecipe[] = [
  { kind: "rsi", compare: "lte", label: "RSI 14 at or below 30", level: 30, period: 14 },
  { kind: "rsi", compare: "gte", label: "RSI 14 at or above 70", level: 70, period: 14 },
  { kind: "rsi", compare: "cross_lte", label: "RSI 14 crosses below 30", level: 30, period: 14 },
  { kind: "rsi", compare: "cross_gte", label: "RSI 14 crosses above 70", level: 70, period: 14 },
  { kind: "macd", compare: "gte", label: "MACD hist is above 0", level: 0 },
  { kind: "macd", compare: "lte", label: "MACD hist is below 0", level: 0 },
  { kind: "macd", compare: "cross_gte", label: "MACD hist crosses above 0", level: 0 },
  { kind: "macd", compare: "cross_lte", label: "MACD hist crosses below 0", level: 0 },
  { kind: "ema", compare: "gte", label: "Price is above EMA 21", level: null, period: 21 },
  { kind: "ema", compare: "lte", label: "Price is below EMA 21", level: null, period: 21 },
  { kind: "ema", compare: "cross_gte", label: "Price crosses above EMA 21", level: null, period: 21 },
  { kind: "ema", compare: "cross_lte", label: "Price crosses below EMA 21", level: null, period: 21 },
  { kind: "sma", compare: "gte", label: "Price is above SMA 21", level: null, period: 21 },
  { kind: "sma", compare: "lte", label: "Price is below SMA 21", level: null, period: 21 },
  { kind: "sma", compare: "cross_gte", label: "Price crosses above SMA 21", level: null, period: 21 },
  { kind: "sma", compare: "cross_lte", label: "Price crosses below SMA 21", level: null, period: 21 },
  { kind: "bb", compare: "lte", label: "Price is below BB bottom", level: null, period: 20 },
  { kind: "bb", compare: "gte", label: "Price is above BB top", level: null, period: 20 },
  { kind: "bb", compare: "cross_lte", label: "Price crosses below BB bottom", level: null, period: 20 },
  { kind: "bb", compare: "cross_gte", label: "Price crosses above BB top", level: null, period: 20 },
  { kind: "ema_cross", compare: "cross_gte", label: "EMA 9 crosses above 21", level: null, period: 9, slowPeriod: 21 },
  { kind: "ema_cross", compare: "cross_lte", label: "EMA 9 crosses below 21", level: null, period: 9, slowPeriod: 21 },
  { kind: "sma_cross", compare: "cross_gte", label: "SMA 9 crosses above 21", level: null, period: 9, slowPeriod: 21 },
  { kind: "sma_cross", compare: "cross_lte", label: "SMA 9 crosses below 21", level: null, period: 9, slowPeriod: 21 },
  { kind: "supertrend", compare: "gte", label: "Supertrend is bullish", level: null, period: 10, multiplier: 3 },
  { kind: "supertrend", compare: "lte", label: "Supertrend is bearish", level: null, period: 10, multiplier: 3 },
  { kind: "supertrend", compare: "cross_gte", label: "Supertrend turns bullish", level: null, period: 10, multiplier: 3 },
  { kind: "supertrend", compare: "cross_lte", label: "Supertrend turns bearish", level: null, period: 10, multiplier: 3 },
];

function met(
  recipe: WalkRecipe,
  closes: number[],
  bars: { high: number; low: number; close: number }[],
) {
  return indicatorStartMet({
    kind: recipe.kind,
    side: "long",
    closes,
    bars,
    compare: recipe.compare,
    level: recipe.level,
    period: recipe.period,
    slowPeriod: recipe.slowPeriod,
    multiplier: recipe.multiplier,
  });
}

async function walkLiveStarts() {
  const raw = await fetchBybitKlineBars({
    symbol: "ETHUSDT",
    interval: "15",
    limit: 500,
  });
  const bars = closedLiveIndicatorBars(raw, "15");
  assert.ok(bars.length > 80, "need closed Bybit 15m bars");
  const warmup = 40;
  const rows = WALK_RECIPES.map((recipe) => {
    let sitBars = 0;
    let fires = 0;
    let lastFire: string | null = null;
    for (let i = warmup; i < bars.length; i += 1) {
      const windowBars = bars.slice(0, i + 1);
      const windowCloses = windowBars.map((row) => row.close);
      const now = met(recipe, windowCloses, windowBars);
      if (!recipe.compare.startsWith("cross")) {
        if (now) {
          sitBars += 1;
        }
        continue;
      }
      if (now) {
        fires += 1;
        lastFire = new Date(windowBars[windowBars.length - 1]?.timeMs ?? 0).toISOString();
      }
    }
    const last = met(
      recipe,
      bars.map((row) => row.close),
      bars,
    );
    return {
      label: recipe.label,
      last,
      sitBars: recipe.compare.startsWith("cross") ? undefined : sitBars,
      fires: recipe.compare.startsWith("cross") ? fires : undefined,
      lastFire: recipe.compare.startsWith("cross") ? lastFire : undefined,
    };
  });

  const byLabel = new Map(rows.map((row) => [row.label, row]));
  const lastStBull = byLabel.get("Supertrend is bullish")?.last;
  const lastStBear = byLabel.get("Supertrend is bearish")?.last;
  assert.notEqual(lastStBull, lastStBear);
  assert.equal(Boolean(lastStBull) && Boolean(lastStBear), false);

  const lastMacdUp = byLabel.get("MACD hist is above 0")?.last;
  const lastMacdDown = byLabel.get("MACD hist is below 0")?.last;
  assert.equal(Boolean(lastMacdUp) && Boolean(lastMacdDown), false);

  const lastEmaUp = byLabel.get("Price is above EMA 21")?.last;
  const lastEmaDown = byLabel.get("Price is below EMA 21")?.last;
  assert.equal(Boolean(lastEmaUp) && Boolean(lastEmaDown), false);

  let sitBecameTrue = 0;
  let sitBecameTrueWithCross = 0;
  for (const recipe of WALK_RECIPES.filter((row) => !row.compare.startsWith("cross"))) {
    const crossCompare = recipe.compare === "gte" ? "cross_gte" : "cross_lte";
    const primed = bars.slice(0, warmup);
    let prevSit = met(
      recipe,
      primed.map((row) => row.close),
      primed,
    );
    for (let i = warmup; i < bars.length; i += 1) {
      const windowBars = bars.slice(0, i + 1);
      const windowCloses = windowBars.map((row) => row.close);
      const sit = met(recipe, windowCloses, windowBars);
      if (sit && !prevSit) {
        sitBecameTrue += 1;
        if (met({ ...recipe, compare: crossCompare }, windowCloses, windowBars)) {
          sitBecameTrueWithCross += 1;
        }
      }
      prevSit = sit;
    }
  }
  assert.equal(
    sitBecameTrue,
    sitBecameTrueWithCross,
    `sit edges must match crosses: ${sitBecameTrue} vs ${sitBecameTrueWithCross}`,
  );

  console.log(
    JSON.stringify(
      {
        venue: "bybit",
        symbol: "ETHUSDT",
        timeframe: "15m",
        closedBars: bars.length,
        close: bars[bars.length - 1]?.close,
        sitEdges: sitBecameTrue,
        recipes: rows,
      },
      null,
      2,
    ),
  );
}

if (process.argv.includes("--desk")) {
  void deskCard();
}
if (process.argv.includes("--walk")) {
  void walkLiveStarts();
}
