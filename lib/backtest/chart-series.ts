import {
  alignedAverage,
  atrValues,
  bollingerSeries,
  DCA_BB_STDDEV,
  DCA_INDICATOR_TIMEFRAME_LABELS,
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
import {
  DEFAULT_DCA_ATR_BAND_MULT,
  type DcaFilterSpec,
} from "@/lib/dca/filters";
import type { CandleBar } from "@/lib/market/candles";
import type { BacktestFillReason, BacktestRecipe } from "./model";

export type PricePlot = {
  id: string;
  title: string;
  color: string;
  values: (number | null)[];
};

export type OscillatorPlot = {
  title: string;
  levels: number[];
  rsi: (number | null)[] | null;
  macd: (number | null)[] | null;
  signal: (number | null)[] | null;
  histogram: (number | null)[] | null;
};

export type IndicatorLayer = {
  id: string;
  title: string;
  roles: string[];
  timeframe: DcaIndicatorTimeframe | null;
  pane: "price" | "oscillator";
  price: PricePlot[];
  oscillator: OscillatorPlot | null;
  /** Value used to place a condition dot. */
  dotValues: (number | null)[];
};

export type ReplayChartSeries = {
  layers: IndicatorLayer[];
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

type Spec = {
  key: string;
  kind: DcaIndicatorKind | "atr_band";
  roles: string[];
  period: number | null;
  slowPeriod: number | null;
  multiplier: number | null;
  levels: number[];
  timeframe: DcaIndicatorTimeframe | null;
};

function addSpec(specs: Spec[], spec: Spec | null) {
  if (!spec) {
    return;
  }
  const existing = specs.find((row) => row.key === spec.key);
  if (!existing) {
    specs.push(spec);
    return;
  }
  for (const role of spec.roles) {
    if (!existing.roles.includes(role)) {
      existing.roles.push(role);
    }
  }
  for (const level of spec.levels) {
    if (!existing.levels.includes(level)) {
      existing.levels.push(level);
    }
  }
}

function specKey(input: {
  kind: string;
  period: number | null;
  slowPeriod: number | null;
  multiplier: number | null;
  timeframe: DcaIndicatorTimeframe | null;
}): string {
  return [
    input.kind,
    input.period ?? "",
    input.slowPeriod ?? "",
    input.multiplier ?? "",
    input.timeframe ?? "",
  ].join("|");
}

function fromFilter(spec: DcaFilterSpec | null | undefined, role: string): Spec | null {
  if (!spec) {
    return null;
  }
  return {
    key: specKey({
      kind: spec.kind,
      period: spec.period,
      slowPeriod: null,
      multiplier: spec.multiplier,
      timeframe: spec.timeframe,
    }),
    kind: spec.kind,
    roles: [role],
    period: spec.period,
    slowPeriod: null,
    multiplier: spec.multiplier,
    levels: spec.level != null ? [spec.level] : [],
    timeframe: spec.timeframe,
  };
}

function specsFromRecipe(recipe: BacktestRecipe): Spec[] {
  const specs: Spec[] = [];
  if (recipe.kind === "dca") {
    if (
      (recipe.startKind === "indicator" || recipe.startKind === "trend") &&
      recipe.indicatorKind
    ) {
      addSpec(specs, {
        key: specKey({
          kind: recipe.indicatorKind,
          period: recipe.indicatorPeriod ?? null,
          slowPeriod: recipe.indicatorSlowPeriod ?? null,
          multiplier: recipe.indicatorMultiplier ?? null,
          timeframe: recipe.indicatorTimeframe,
        }),
        kind: recipe.indicatorKind,
        roles: ["Entry"],
        period: recipe.indicatorPeriod ?? null,
        slowPeriod: recipe.indicatorSlowPeriod ?? null,
        multiplier: recipe.indicatorMultiplier ?? null,
        levels: recipe.indicatorLevel != null ? [recipe.indicatorLevel] : [],
        timeframe: recipe.indicatorTimeframe,
      });
    }
    if (recipe.shortIndicatorKind) {
      addSpec(specs, {
        key: specKey({
          kind: recipe.shortIndicatorKind,
          period: recipe.shortIndicatorPeriod ?? null,
          slowPeriod: recipe.shortIndicatorSlowPeriod ?? null,
          multiplier: recipe.shortIndicatorMultiplier ?? null,
          timeframe: recipe.shortIndicatorTimeframe ?? null,
        }),
        kind: recipe.shortIndicatorKind,
        roles: ["Short entry"],
        period: recipe.shortIndicatorPeriod ?? null,
        slowPeriod: recipe.shortIndicatorSlowPeriod ?? null,
        multiplier: recipe.shortIndicatorMultiplier ?? null,
        levels:
          recipe.shortIndicatorLevel != null ? [recipe.shortIndicatorLevel] : [],
        timeframe: recipe.shortIndicatorTimeframe ?? null,
      });
    }
    addSpec(specs, fromFilter(recipe.confirm, "Secondary entry"));
    addSpec(specs, fromFilter(recipe.shortConfirm, "Short secondary entry"));
    addSpec(specs, fromFilter(recipe.exitIf, "Hard exit"));
    addSpec(specs, fromFilter(recipe.shortExitIf, "Short hard exit"));
    return specs;
  }
  const start = recipe.indicator;
  if (
    (recipe.entrySource === "indicator" || recipe.entrySource === "trend") &&
    start
  ) {
    addSpec(specs, {
      key: specKey({
        kind: start.kind,
        period: start.period,
        slowPeriod: start.slowPeriod,
        multiplier: start.multiplier ?? null,
        timeframe: start.timeframe,
      }),
      kind: start.kind,
      roles: ["Entry"],
      period: start.period,
      slowPeriod: start.slowPeriod,
      multiplier: start.multiplier ?? null,
      levels: start.level != null ? [start.level] : [],
      timeframe: start.timeframe,
    });
  }
  addSpec(specs, fromFilter(recipe.confirm, "Secondary entry"));
  addSpec(specs, fromFilter(recipe.exitIf, "Hard exit"));
  return specs;
}

function layerTitle(spec: Spec): string {
  const tf = spec.timeframe
    ? DCA_INDICATOR_TIMEFRAME_LABELS[spec.timeframe]
    : "";
  const period = spec.period ?? "";
  let name = spec.kind.toUpperCase();
  if (spec.kind === "supertrend") {
    const multiplier = spec.multiplier ?? DEFAULT_DCA_SUPERTREND_MULTIPLIER;
    name = `Supertrend ${spec.period ?? DEFAULT_DCA_SUPERTREND_PERIOD} × ${multiplier}`;
  } else if (spec.kind === "rsi") {
    name = `RSI ${spec.period ?? DEFAULT_DCA_RSI_PERIOD}`;
  } else if (spec.kind === "macd") {
    name = "MACD";
  } else if (spec.kind === "bb") {
    name = `BB ${spec.period ?? DEFAULT_DCA_BB_PERIOD}`;
  } else if (spec.kind === "atr_band") {
    name = `ATR band ${spec.period ?? DEFAULT_DCA_SUPERTREND_PERIOD}`;
  } else if (spec.kind === "ema" || spec.kind === "sma") {
    name = `${spec.kind.toUpperCase()} ${spec.period ?? DEFAULT_DCA_MA_PERIOD}`;
  } else if (spec.kind === "ema_cross" || spec.kind === "sma_cross") {
    name = spec.kind === "ema_cross" ? "EMA cross" : "SMA cross";
  }
  const where = tf ? ` · ${tf}` : "";
  const roles = spec.roles.join(", ");
  return `${name}${period && spec.kind === "atr_band" ? "" : ""}${where} · ${roles}`;
}

export function indicatorRolesForReason(reason: BacktestFillReason): string[] {
  if (reason === "entry") {
    return ["Entry", "Secondary entry", "Short entry", "Short secondary entry"];
  }
  if (reason === "exit_if") {
    return ["Hard exit", "Short hard exit"];
  }
  return [];
}

export function replayChartSeries(
  recipe: BacktestRecipe,
  candles: CandleBar[],
): ReplayChartSeries {
  const specs = specsFromRecipe(recipe);
  if (candles.length === 0 || specs.length === 0) {
    return { layers: [] };
  }
  const closes = candles.map((row) => row.close);
  const bars = candles.map((row) => ({
    high: row.high,
    low: row.low,
    close: row.close,
  }));
  const layers: IndicatorLayer[] = [];
  for (const spec of specs) {
    const title = layerTitle(spec);
    const price: PricePlot[] = [];
    let oscillator: OscillatorPlot | null = null;
    let dotValues: (number | null)[] = closes.map(() => null);
    let pane: "price" | "oscillator" = "price";
    if (spec.kind === "rsi") {
      const period = spec.period ?? DEFAULT_DCA_RSI_PERIOD;
      const rsi = rsiSeries(closes, period);
      pane = "oscillator";
      dotValues = rsi;
      oscillator = {
        title,
        levels: spec.levels,
        rsi,
        macd: null,
        signal: null,
        histogram: null,
      };
    } else if (spec.kind === "macd") {
      const series = macdSeries(closes);
      pane = "oscillator";
      dotValues = series.histogram;
      oscillator = {
        title,
        levels: spec.levels.length > 0 ? spec.levels : [0],
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
      dotValues = values;
      price.push({ id: spec.key, title, color: LINE.ema, values });
    } else if (spec.kind === "ema_cross" || spec.kind === "sma_cross") {
      const fast = spec.period ?? DEFAULT_DCA_CROSS_FAST_PERIOD;
      const slow = spec.slowPeriod ?? DEFAULT_DCA_CROSS_SLOW_PERIOD;
      const series = spec.kind === "ema_cross" ? emaValues : smaValues;
      const name = spec.kind === "ema_cross" ? "EMA" : "SMA";
      const fastValues = alignedAverage(closes, series(closes, fast));
      const slowValues = alignedAverage(closes, series(closes, slow));
      dotValues = fastValues;
      price.push({
        id: `${spec.key}-fast`,
        title: `${name} ${fast}`,
        color: LINE.ema,
        values: fastValues,
      });
      price.push({
        id: `${spec.key}-slow`,
        title: `${name} ${slow}`,
        color: LINE.slow,
        values: slowValues,
      });
    } else if (spec.kind === "bb") {
      const period = spec.period ?? DEFAULT_DCA_BB_PERIOD;
      const bands = bollingerSeries(closes, period, DCA_BB_STDDEV);
      dotValues = bands.map((row) => row?.mid ?? null);
      price.push({
        id: `${spec.key}-upper`,
        title: `${title} upper`,
        color: LINE.upper,
        values: bands.map((row) => row?.upper ?? null),
      });
      price.push({
        id: `${spec.key}-mid`,
        title,
        color: LINE.mid,
        values: bands.map((row) => row?.mid ?? null),
      });
      price.push({
        id: `${spec.key}-lower`,
        title: `${title} lower`,
        color: LINE.lower,
        values: bands.map((row) => row?.lower ?? null),
      });
    } else if (spec.kind === "supertrend") {
      const period = spec.period ?? DEFAULT_DCA_SUPERTREND_PERIOD;
      const multiplier = spec.multiplier ?? DEFAULT_DCA_SUPERTREND_MULTIPLIER;
      const series = supertrendSeries(bars, period, multiplier);
      dotValues = series.map((row) => row?.line ?? null);
      price.push({
        id: `${spec.key}-up`,
        title,
        color: LINE.trendUp,
        values: series.map((row) => (row && row.dir === 1 ? row.line : null)),
      });
      price.push({
        id: `${spec.key}-down`,
        title,
        color: LINE.trendDown,
        values: series.map((row) => (row && row.dir === -1 ? row.line : null)),
      });
    } else if (spec.kind === "atr_band") {
      const period = spec.period ?? DEFAULT_DCA_SUPERTREND_PERIOD;
      const multiplier = spec.multiplier ?? DEFAULT_DCA_ATR_BAND_MULT;
      const mid = alignedAverage(closes, emaValues(closes, period));
      const atr = atrValues(bars, period);
      dotValues = mid;
      price.push({
        id: `${spec.key}-mid`,
        title,
        color: LINE.mid,
        values: mid,
      });
      price.push({
        id: `${spec.key}-upper`,
        title: `${title} upper`,
        color: LINE.upper,
        values: mid.map((value, index) =>
          value == null || atr[index] == null ? null : value + atr[index] * multiplier,
        ),
      });
      price.push({
        id: `${spec.key}-lower`,
        title: `${title} lower`,
        color: LINE.lower,
        values: mid.map((value, index) =>
          value == null || atr[index] == null ? null : value - atr[index] * multiplier,
        ),
      });
    }
    layers.push({
      id: spec.key,
      title,
      roles: spec.roles,
      timeframe: spec.timeframe,
      pane,
      price,
      oscillator,
      dotValues,
    });
  }
  return { layers };
}
