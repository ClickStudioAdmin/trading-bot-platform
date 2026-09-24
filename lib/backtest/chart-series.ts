import {
  alignedAverage,
  bollingerSeries,
  DCA_BB_STDDEV,
  DEFAULT_DCA_BB_PERIOD,
  DEFAULT_DCA_CROSS_FAST_PERIOD,
  DEFAULT_DCA_CROSS_SLOW_PERIOD,
  DEFAULT_DCA_MA_PERIOD,
  DEFAULT_DCA_RSI_PERIOD,
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DEFAULT_DCA_SUPERTREND_PERIOD,
  emaValues,
  macdSeries,
  rsiSeries,
  smaValues,
  supertrendSeries,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import type { CandleBar } from "@/lib/market/candles";
import type { BacktestRecipe } from "./model";

export type PricePlot = {
  id: string;
  title: string;
  color: string;
  values: (number | null)[];
};

export type OscillatorPlot = {
  id: string;
  title: string;
  level: number | null;
  rsi: (number | null)[] | null;
  macd: (number | null)[] | null;
  signal: (number | null)[] | null;
  histogram: (number | null)[] | null;
};

export type ReplayChartSeries = {
  price: PricePlot[];
  oscillator: OscillatorPlot | null;
  signalTimeframe: DcaIndicatorTimeframe | null;
};

const LINE = {
  ema: "#A78BFA",
  slow: "#F5B942",
  upper: "#9AA3B2",
  mid: "#6B7382",
  lower: "#9AA3B2",
  trendUp: "#34D399",
  trendDown: "#F07167",
} as const;

type IndicatorSpec = {
  id: string;
  kind: DcaIndicatorKind;
  period: number | null;
  slowPeriod: number | null;
  multiplier: number | null;
  level: number | null;
  timeframe: DcaIndicatorTimeframe | null;
};

function specFromRecipe(recipe: BacktestRecipe): IndicatorSpec | null {
  if (recipe.kind === "dca") {
    if (
      (recipe.startKind !== "indicator" && recipe.startKind !== "trend") ||
      !recipe.indicatorKind
    ) {
      return null;
    }
    return {
      id: "start",
      kind: recipe.indicatorKind,
      period: recipe.indicatorPeriod ?? null,
      slowPeriod: recipe.indicatorSlowPeriod ?? null,
      multiplier: recipe.indicatorMultiplier ?? null,
      level: recipe.indicatorLevel,
      timeframe: recipe.indicatorTimeframe,
    };
  }
  const start = recipe.indicator;
  if (
    (recipe.entrySource !== "indicator" && recipe.entrySource !== "trend") ||
    !start
  ) {
    return null;
  }
  return {
    id: "start",
    kind: start.kind,
    period: start.period,
    slowPeriod: start.slowPeriod,
    multiplier: start.multiplier ?? null,
    level: start.level,
    timeframe: start.timeframe,
  };
}

export function replayChartSeries(
  recipe: BacktestRecipe,
  candles: CandleBar[],
): ReplayChartSeries {
  const spec = specFromRecipe(recipe);
  if (!spec || candles.length === 0) {
    return {
      price: [],
      oscillator: null,
      signalTimeframe: spec?.timeframe ?? null,
    };
  }
  const closes = candles.map((row) => row.close);
  const bars = candles.map((row) => ({
    high: row.high,
    low: row.low,
    close: row.close,
  }));
  const price: PricePlot[] = [];
  let oscillator: OscillatorPlot | null = null;
  if (spec.kind === "rsi") {
    const period = spec.period ?? DEFAULT_DCA_RSI_PERIOD;
    oscillator = {
      id: spec.id,
      title: `RSI ${period}`,
      level: spec.level,
      rsi: rsiSeries(closes, period),
      macd: null,
      signal: null,
      histogram: null,
    };
  } else if (spec.kind === "macd") {
    const series = macdSeries(closes);
    oscillator = {
      id: spec.id,
      title: "MACD",
      level: spec.level ?? 0,
      rsi: null,
      macd: series.macd,
      signal: series.signal,
      histogram: series.histogram,
    };
  } else if (spec.kind === "ema" || spec.kind === "sma") {
    const period = spec.period ?? DEFAULT_DCA_MA_PERIOD;
    const values =
      spec.kind === "ema"
        ? alignedAverage(closes, emaValues(closes, period))
        : alignedAverage(closes, smaValues(closes, period));
    price.push({
      id: spec.id,
      title: `${spec.kind.toUpperCase()} ${period}`,
      color: LINE.ema,
      values,
    });
  } else if (spec.kind === "ema_cross" || spec.kind === "sma_cross") {
    const fast = spec.period ?? DEFAULT_DCA_CROSS_FAST_PERIOD;
    const slow = spec.slowPeriod ?? DEFAULT_DCA_CROSS_SLOW_PERIOD;
    const series = spec.kind === "ema_cross" ? emaValues : smaValues;
    const name = spec.kind === "ema_cross" ? "EMA" : "SMA";
    price.push({
      id: `${spec.id}-fast`,
      title: `${name} ${fast}`,
      color: LINE.ema,
      values: alignedAverage(closes, series(closes, fast)),
    });
    price.push({
      id: `${spec.id}-slow`,
      title: `${name} ${slow}`,
      color: LINE.slow,
      values: alignedAverage(closes, series(closes, slow)),
    });
  } else if (spec.kind === "bb") {
    const period = spec.period ?? DEFAULT_DCA_BB_PERIOD;
    const bands = bollingerSeries(closes, period, DCA_BB_STDDEV);
    price.push({
      id: "bb-upper",
      title: `BB ${period} upper`,
      color: LINE.upper,
      values: bands.map((row) => row?.upper ?? null),
    });
    price.push({
      id: "bb-mid",
      title: `BB ${period}`,
      color: LINE.mid,
      values: bands.map((row) => row?.mid ?? null),
    });
    price.push({
      id: "bb-lower",
      title: `BB ${period} lower`,
      color: LINE.lower,
      values: bands.map((row) => row?.lower ?? null),
    });
  } else if (spec.kind === "supertrend") {
    const period = spec.period ?? DEFAULT_DCA_SUPERTREND_PERIOD;
    const multiplier = spec.multiplier ?? DEFAULT_DCA_SUPERTREND_MULTIPLIER;
    const series = supertrendSeries(bars, period, multiplier);
    price.push({
      id: "supertrend-up",
      title: `Supertrend ${period} × ${multiplier}`,
      color: LINE.trendUp,
      values: series.map((row) => (row && row.dir === 1 ? row.line : null)),
    });
    price.push({
      id: "supertrend-down",
      title: `Supertrend ${period} × ${multiplier}`,
      color: LINE.trendDown,
      values: series.map((row) => (row && row.dir === -1 ? row.line : null)),
    });
  }
  return { price, oscillator, signalTimeframe: spec.timeframe };
}
