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
  DCA_INDICATOR_KIND_OPTIONS,
  DCA_TREND_KIND_OPTIONS,
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
  DCA_FILTER_KIND_OPTIONS,
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
  role: string;
}): string {
  return [
    input.kind,
    input.period ?? "",
    input.slowPeriod ?? "",
    input.multiplier ?? "",
    input.timeframe ?? "",
    input.role,
  ].join("|");
}

export function indicatorConditionLabel(role: string): string {
  if (role === "Entry") {
    return "Long entry";
  }
  if (role === "Secondary entry") {
    return "Long secondary entry";
  }
  if (role === "Hard exit") {
    return "Long hard exit";
  }
  return role;
}

function conditionColor(role: string, color: string): string {
  if (!role.startsWith("Short")) {
    return color;
  }
  if (color === LINE.ema || color === LINE.trendUp) {
    return LINE.trendDown;
  }
  if (color === LINE.mid) {
    return LINE.slow;
  }
  return color;
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
      role,
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
          role: "Entry",
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
          role: "Short entry",
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
        role: "Entry",
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
  const roles = spec.roles.map(indicatorConditionLabel).join(", ");
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

export type ReplayIndicatorId = DcaIndicatorKind | "atr_band";

export type ReplayIndicatorChoice = {
  id: ReplayIndicatorId;
  label: string;
  locked: boolean;
  usage: string;
};

const REPLAY_INDICATOR_CATALOG: { id: ReplayIndicatorId; label: string }[] = [];
const seenIndicatorIds = new Set<string>();
for (const row of [
  ...DCA_INDICATOR_KIND_OPTIONS,
  ...DCA_TREND_KIND_OPTIONS,
  ...DCA_FILTER_KIND_OPTIONS,
]) {
  if (seenIndicatorIds.has(row.value)) {
    continue;
  }
  seenIndicatorIds.add(row.value);
  REPLAY_INDICATOR_CATALOG.push({ id: row.value, label: row.label });
}

/** Every drawable indicator. Strategy rows stay on and cannot be removed. */
export function replayIndicatorCatalog(recipe: BacktestRecipe): ReplayIndicatorChoice[] {
  const specs = specsFromRecipe(recipe);
  return REPLAY_INDICATOR_CATALOG.map((row) => {
    const used = specs.filter((spec) => spec.kind === row.id);
    const usage = used
      .flatMap((spec) => spec.roles.map(indicatorConditionLabel))
      .filter((label, index, all) => all.indexOf(label) === index)
      .join(", ");
    return {
      id: row.id,
      label: row.label,
      locked: used.length > 0,
      usage,
    };
  });
}

function referenceSpec(kind: ReplayIndicatorId): Spec {
  const period =
    kind === "macd"
      ? null
      : kind === "bb"
        ? DEFAULT_DCA_BB_PERIOD
        : kind === "rsi"
          ? DEFAULT_DCA_RSI_PERIOD
          : kind === "supertrend" || kind === "atr_band"
            ? DEFAULT_DCA_SUPERTREND_PERIOD
            : kind === "ema_cross" || kind === "sma_cross"
              ? DEFAULT_DCA_CROSS_FAST_PERIOD
              : DEFAULT_DCA_MA_PERIOD;
  const slowPeriod =
    kind === "ema_cross" || kind === "sma_cross" ? DEFAULT_DCA_CROSS_SLOW_PERIOD : null;
  const multiplier =
    kind === "supertrend"
      ? DEFAULT_DCA_SUPERTREND_MULTIPLIER
      : kind === "atr_band"
        ? DEFAULT_DCA_ATR_BAND_MULT
        : null;
  return {
    key: specKey({
      kind,
      period,
      slowPeriod,
      multiplier,
      timeframe: null,
      role: "Reference",
    }),
    kind,
    roles: ["Reference"],
    period,
    slowPeriod,
    multiplier,
    levels: [],
    timeframe: null,
  };
}

function addReferenceSpecs(specs: Spec[], references: readonly string[]) {
  const used = new Set(specs.map((spec) => spec.kind));
  const allowed = new Set(REPLAY_INDICATOR_CATALOG.map((row) => row.id));
  for (const id of references) {
    if (!allowed.has(id as ReplayIndicatorId) || used.has(id as ReplayIndicatorId)) {
      continue;
    }
    used.add(id as ReplayIndicatorId);
    addSpec(specs, referenceSpec(id as ReplayIndicatorId));
  }
}

export function replayChartSeries(
  recipe: BacktestRecipe,
  candles: CandleBar[],
  references: readonly string[] = [],
): ReplayChartSeries {
  const specs = specsFromRecipe(recipe);
  addReferenceSpecs(specs, references);
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
    const role = spec.roles[0] ?? "";
    const tone = (color: string) => conditionColor(role, color);
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
      price.push({ id: spec.key, title, color: tone(LINE.ema), values });
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
        color: tone(LINE.ema),
        values: fastValues,
      });
      price.push({
        id: `${spec.key}-slow`,
        title: `${name} ${slow}`,
        color: tone(LINE.slow),
        values: slowValues,
      });
    } else if (spec.kind === "bb") {
      const period = spec.period ?? DEFAULT_DCA_BB_PERIOD;
      const bands = bollingerSeries(closes, period, DCA_BB_STDDEV);
      dotValues = bands.map((row) => row?.mid ?? null);
      price.push({
        id: `${spec.key}-upper`,
        title: `${title} upper`,
        color: tone(LINE.upper),
        values: bands.map((row) => row?.upper ?? null),
      });
      price.push({
        id: `${spec.key}-mid`,
        title,
        color: tone(LINE.mid),
        values: bands.map((row) => row?.mid ?? null),
      });
      price.push({
        id: `${spec.key}-lower`,
        title: `${title} lower`,
        color: tone(LINE.lower),
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
        color: tone(LINE.trendUp),
        values: series.map((row) => (row && row.dir === 1 ? row.line : null)),
      });
      price.push({
        id: `${spec.key}-down`,
        title,
        color: tone(LINE.trendDown),
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
        color: tone(LINE.mid),
        values: mid,
      });
      price.push({
        id: `${spec.key}-upper`,
        title: `${title} upper`,
        color: tone(LINE.upper),
        values: mid.map((value, index) =>
          value == null || atr[index] == null ? null : value + atr[index] * multiplier,
        ),
      });
      price.push({
        id: `${spec.key}-lower`,
        title: `${title} lower`,
        color: tone(LINE.lower),
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

export type ReplayIndicatorLegendValue = {
  id: string;
  color: string;
  text: string;
};

export type ReplayIndicatorLegendRow = {
  id: string;
  name: string;
  values: ReplayIndicatorLegendValue[];
};

function legendNumber(value: number): string {
  const abs = Math.abs(value);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 8;
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function valueAt(values: (number | null)[], index: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const at = Math.max(0, Math.min(index, values.length - 1));
  for (let i = at; i >= 0; i -= 1) {
    const value = values[i];
    if (value != null && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

export type IndicatorStyleTarget = {
  id: string;
  label: string;
  defaultColor: string;
};

function stylePartLabel(id: string): string {
  if (id.endsWith("-up")) {
    return "Up";
  }
  if (id.endsWith("-down")) {
    return "Down";
  }
  if (id.endsWith("-mid")) {
    return "Middle";
  }
  if (id.endsWith("-upper")) {
    return "Upper";
  }
  if (id.endsWith("-lower")) {
    return "Lower";
  }
  if (id.endsWith("-fast")) {
    return "Fast";
  }
  if (id.endsWith("-slow")) {
    return "Slow";
  }
  return "Line";
}

export function indicatorStyleTargets(layer: IndicatorLayer): IndicatorStyleTarget[] {
  const targets: IndicatorStyleTarget[] = layer.price.map((plot) => ({
    id: plot.id,
    label: plotCaption(plot.title, layer.title) || stylePartLabel(plot.id),
    defaultColor: plot.color,
  }));
  if (layer.oscillator?.rsi) {
    targets.push({ id: "rsi", label: "RSI", defaultColor: "#A78BFA" });
  }
  if (layer.oscillator?.macd) {
    targets.push({ id: "macd", label: "MACD", defaultColor: "#A78BFA" });
  }
  if (layer.oscillator?.signal) {
    targets.push({ id: "signal", label: "Signal", defaultColor: "#F5B942" });
  }
  if (layer.oscillator?.histogram) {
    targets.push({ id: "histogram", label: "Histogram", defaultColor: "#34D399" });
  }
  return targets;
}

function plotCaption(plotTitle: string, layerTitle: string): string {
  if (plotTitle === layerTitle) {
    return "";
  }
  if (plotTitle.startsWith(`${layerTitle} `)) {
    return plotTitle.slice(layerTitle.length).trim();
  }
  return plotTitle;
}

/** Active indicators for the chart corner, with the reading at one bar. */
export function replayIndicatorLegend(
  layers: IndicatorLayer[],
  index: number,
): ReplayIndicatorLegendRow[] {
  const rows: ReplayIndicatorLegendRow[] = [];
  for (const layer of layers) {
    const values: ReplayIndicatorLegendValue[] = [];
    for (const plot of layer.price) {
      const value = valueAt(plot.values, index);
      if (value == null) {
        continue;
      }
      const caption = plotCaption(plot.title, layer.title);
      values.push({
        id: plot.id,
        color: plot.color,
        text: caption ? `${caption} ${legendNumber(value)}` : legendNumber(value),
      });
    }
    const oscillator = layer.oscillator;
    if (oscillator?.rsi) {
      const value = valueAt(oscillator.rsi, index);
      if (value != null) {
        values.push({ id: "rsi", color: "#A78BFA", text: legendNumber(value) });
      }
    }
    if (oscillator?.macd) {
      const value = valueAt(oscillator.macd, index);
      if (value != null) {
        values.push({ id: "macd", color: "#A78BFA", text: legendNumber(value) });
      }
    }
    if (oscillator?.signal) {
      const value = valueAt(oscillator.signal, index);
      if (value != null) {
        values.push({ id: "signal", color: "#F5B942", text: legendNumber(value) });
      }
    }
    if (oscillator?.histogram) {
      const value = valueAt(oscillator.histogram, index);
      if (value != null) {
        values.push({
          id: "histogram",
          color: value >= 0 ? "#34D399" : "#F07167",
          text: legendNumber(value),
        });
      }
    }
    rows.push({ id: layer.id, name: layer.title, values });
  }
  return rows;
}
