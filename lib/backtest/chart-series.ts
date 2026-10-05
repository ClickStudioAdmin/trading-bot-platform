import {
  alignedAverage,
  atrValues,
  bollingerSeries,
  DCA_BB_STDDEV,
  DCA_INDICATOR_PERIOD_MAX,
  DCA_INDICATOR_PERIOD_MIN,
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
  inputs: IndicatorInput[];
  /** Strategy inputs stay visible and cannot be edited. */
  inputsLocked: boolean;
  /** Shown on the Inputs tab. References follow the chart candles. */
  timeframeLabel: string;
};

export type IndicatorInputId =
  | "length"
  | "slowLength"
  | "multiplier"
  | "signal"
  | "stddev";

export type IndicatorInput = {
  id: IndicatorInputId;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
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
  signal?: number | null;
  stddev?: number | null;
  reference?: boolean;
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

export type ReplayReferenceSettings = Partial<Record<IndicatorInputId, number>>;

export type ReplayReferenceInputs = Partial<
  Record<ReplayIndicatorId, ReplayReferenceSettings>
>;

export type ReplayIndicatorChoice = {
  id: ReplayIndicatorId;
  label: string;
  locked: boolean;
};

const REPLAY_INDICATOR_CATALOG: {
  id: ReplayIndicatorId;
  label: string;
  kinds: readonly ReplayIndicatorId[];
}[] = [
  { id: "rsi", label: "RSI", kinds: ["rsi"] },
  { id: "macd", label: "MACD", kinds: ["macd"] },
  { id: "sma", label: "Simple Moving Average", kinds: ["sma", "sma_cross"] },
  { id: "ema", label: "Exponential Moving Average", kinds: ["ema", "ema_cross"] },
  { id: "bb", label: "Bollinger Bands", kinds: ["bb"] },
  { id: "supertrend", label: "Supertrend", kinds: ["supertrend"] },
  { id: "atr_band", label: "ATR band", kinds: ["atr_band"] },
];

/** Every drawable indicator. Strategy rows stay on and cannot be removed. */
export function replayIndicatorCatalog(recipe: BacktestRecipe): ReplayIndicatorChoice[] {
  const specs = specsFromRecipe(recipe);
  return REPLAY_INDICATOR_CATALOG.map((row) => ({
    id: row.id,
    label: row.label,
    locked: specs.some((spec) => row.kinds.includes(spec.kind)),
  }));
}

const LENGTH_RANGE = {
  min: DCA_INDICATOR_PERIOD_MIN,
  max: DCA_INDICATOR_PERIOD_MAX,
  step: 1,
};
const FACTOR_RANGE = { min: 0.1, max: 50, step: 0.1 };
const MACD_FAST = 12;
const MACD_SLOW = 26;
const MACD_SIGNAL = 9;

function clampLength(value: number | undefined, fallback: number): number {
  const raw = value == null || !Number.isFinite(value) ? fallback : value;
  return Math.min(
    DCA_INDICATOR_PERIOD_MAX,
    Math.max(DCA_INDICATOR_PERIOD_MIN, Math.round(raw)),
  );
}

function clampFactor(value: number | undefined, fallback: number): number {
  const raw = value == null || !Number.isFinite(value) ? fallback : value;
  const rounded = Math.round(raw * 10) / 10;
  return Math.min(FACTOR_RANGE.max, Math.max(FACTOR_RANGE.min, rounded));
}

function indicatorField(
  id: IndicatorInputId,
  label: string,
  value: number,
  range: { min: number; max: number; step: number },
): IndicatorInput {
  return { id, label, value, min: range.min, max: range.max, step: range.step };
}

function indicatorInputs(spec: Spec): IndicatorInput[] {
  if (spec.kind === "rsi") {
    return [
      indicatorField("length", "Length", spec.period ?? DEFAULT_DCA_RSI_PERIOD, LENGTH_RANGE),
    ];
  }
  if (spec.kind === "ema" || spec.kind === "sma") {
    return [
      indicatorField("length", "Length", spec.period ?? DEFAULT_DCA_MA_PERIOD, LENGTH_RANGE),
    ];
  }
  if (spec.kind === "bb") {
    return [
      indicatorField("length", "Length", spec.period ?? DEFAULT_DCA_BB_PERIOD, LENGTH_RANGE),
      indicatorField(
        "stddev",
        "StdDev",
        spec.reference ? (spec.stddev ?? DCA_BB_STDDEV) : DCA_BB_STDDEV,
        FACTOR_RANGE,
      ),
    ];
  }
  if (spec.kind === "ema_cross" || spec.kind === "sma_cross") {
    return [
      indicatorField(
        "length",
        "Fast length",
        spec.period ?? DEFAULT_DCA_CROSS_FAST_PERIOD,
        LENGTH_RANGE,
      ),
      indicatorField(
        "slowLength",
        "Slow length",
        spec.slowPeriod ?? DEFAULT_DCA_CROSS_SLOW_PERIOD,
        LENGTH_RANGE,
      ),
    ];
  }
  if (spec.kind === "supertrend") {
    return [
      indicatorField(
        "length",
        "Length",
        spec.period ?? DEFAULT_DCA_SUPERTREND_PERIOD,
        LENGTH_RANGE,
      ),
      indicatorField(
        "multiplier",
        "Multiplier",
        spec.multiplier ?? DEFAULT_DCA_SUPERTREND_MULTIPLIER,
        FACTOR_RANGE,
      ),
    ];
  }
  if (spec.kind === "atr_band") {
    return [
      indicatorField(
        "length",
        "Length",
        spec.period ?? DEFAULT_DCA_SUPERTREND_PERIOD,
        LENGTH_RANGE,
      ),
      indicatorField(
        "multiplier",
        "Multiplier",
        spec.multiplier ?? DEFAULT_DCA_ATR_BAND_MULT,
        FACTOR_RANGE,
      ),
    ];
  }
  if (spec.kind === "macd") {
    const fast = spec.reference ? (spec.period ?? MACD_FAST) : MACD_FAST;
    const slow = spec.reference ? (spec.slowPeriod ?? MACD_SLOW) : MACD_SLOW;
    const signal = spec.reference ? (spec.signal ?? MACD_SIGNAL) : MACD_SIGNAL;
    return [
      indicatorField("length", "Fast length", fast, LENGTH_RANGE),
      indicatorField("slowLength", "Slow length", slow, LENGTH_RANGE),
      indicatorField("signal", "Signal", signal, LENGTH_RANGE),
    ];
  }
  return [];
}

function chartTimeframeLabel(spec: Spec): string {
  if (!spec.timeframe || spec.reference) {
    return "Chart";
  }
  return DCA_INDICATOR_TIMEFRAME_LABELS[spec.timeframe];
}

function referenceSpec(
  kind: ReplayIndicatorId,
  settings: ReplayReferenceSettings = {},
): Spec {
  const period =
    kind === "macd"
      ? clampLength(settings.length, MACD_FAST)
      : kind === "bb"
        ? clampLength(settings.length, DEFAULT_DCA_BB_PERIOD)
        : kind === "rsi"
          ? clampLength(settings.length, DEFAULT_DCA_RSI_PERIOD)
          : kind === "supertrend" || kind === "atr_band"
            ? clampLength(settings.length, DEFAULT_DCA_SUPERTREND_PERIOD)
            : kind === "ema_cross" || kind === "sma_cross"
              ? clampLength(settings.length, DEFAULT_DCA_CROSS_FAST_PERIOD)
              : clampLength(settings.length, DEFAULT_DCA_MA_PERIOD);
  const slowPeriod =
    kind === "macd"
      ? clampLength(settings.slowLength, MACD_SLOW)
      : kind === "ema_cross" || kind === "sma_cross"
        ? clampLength(settings.slowLength, DEFAULT_DCA_CROSS_SLOW_PERIOD)
        : null;
  const multiplier =
    kind === "supertrend"
      ? clampFactor(settings.multiplier, DEFAULT_DCA_SUPERTREND_MULTIPLIER)
      : kind === "atr_band"
        ? clampFactor(settings.multiplier, DEFAULT_DCA_ATR_BAND_MULT)
        : null;
  const signal = kind === "macd" ? clampLength(settings.signal, MACD_SIGNAL) : null;
  const stddev = kind === "bb" ? clampFactor(settings.stddev, DCA_BB_STDDEV) : null;
  return {
    key: specKey({
      kind,
      period,
      slowPeriod,
      multiplier,
      timeframe: null,
    }),
    kind,
    roles: ["Reference"],
    period,
    slowPeriod,
    multiplier,
    signal,
    stddev,
    reference: true,
    levels: [],
    timeframe: null,
  };
}

function addReferenceSpecs(
  specs: Spec[],
  references: readonly string[],
  inputs: ReplayReferenceInputs,
) {
  const used = new Set(specs.map((spec) => spec.kind));
  for (const id of references) {
    const row = REPLAY_INDICATOR_CATALOG.find((item) => item.id === id);
    if (!row || row.kinds.some((kind) => used.has(kind))) {
      continue;
    }
    used.add(row.id);
    addSpec(specs, referenceSpec(row.id, inputs[row.id]));
  }
}

export function replayChartSeries(
  recipe: BacktestRecipe,
  candles: CandleBar[],
  references: readonly string[] = [],
  referenceInputs: ReplayReferenceInputs = {},
): ReplayChartSeries {
  const specs = specsFromRecipe(recipe);
  addReferenceSpecs(specs, references, referenceInputs);
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
    const layerId = spec.reference ? `ref:${spec.kind}` : spec.key;
    const plotId = (suffix: string) => `${layerId}-${suffix}`;
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
      const fast = spec.reference ? (spec.period ?? MACD_FAST) : MACD_FAST;
      const slow = spec.reference ? (spec.slowPeriod ?? MACD_SLOW) : MACD_SLOW;
      const signalPeriod = spec.reference ? (spec.signal ?? MACD_SIGNAL) : MACD_SIGNAL;
      const series = macdSeries(closes, fast, slow, signalPeriod);
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
      price.push({ id: layerId, title, color: tone(LINE.ema), values });
    } else if (spec.kind === "ema_cross" || spec.kind === "sma_cross") {
      const fast = spec.period ?? DEFAULT_DCA_CROSS_FAST_PERIOD;
      const slow = spec.slowPeriod ?? DEFAULT_DCA_CROSS_SLOW_PERIOD;
      const series = spec.kind === "ema_cross" ? emaValues : smaValues;
      const name = spec.kind === "ema_cross" ? "EMA" : "SMA";
      const fastValues = alignedAverage(closes, series(closes, fast));
      const slowValues = alignedAverage(closes, series(closes, slow));
      dotValues = fastValues;
      price.push({
        id: plotId("fast"),
        title: `${name} ${fast}`,
        color: tone(LINE.ema),
        values: fastValues,
      });
      price.push({
        id: plotId("slow"),
        title: `${name} ${slow}`,
        color: tone(LINE.slow),
        values: slowValues,
      });
    } else if (spec.kind === "bb") {
      const period = spec.period ?? DEFAULT_DCA_BB_PERIOD;
      const stddev = spec.reference ? (spec.stddev ?? DCA_BB_STDDEV) : DCA_BB_STDDEV;
      const bands = bollingerSeries(closes, period, stddev);
      dotValues = bands.map((row) => row?.mid ?? null);
      price.push({
        id: plotId("upper"),
        title: `${title} upper`,
        color: tone(LINE.upper),
        values: bands.map((row) => row?.upper ?? null),
      });
      price.push({
        id: plotId("mid"),
        title,
        color: tone(LINE.mid),
        values: bands.map((row) => row?.mid ?? null),
      });
      price.push({
        id: plotId("lower"),
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
        id: plotId("up"),
        title,
        color: tone(LINE.trendUp),
        values: series.map((row) => (row && row.dir === 1 ? row.line : null)),
      });
      price.push({
        id: plotId("down"),
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
        id: plotId("mid"),
        title,
        color: tone(LINE.mid),
        values: mid,
      });
      price.push({
        id: plotId("upper"),
        title: `${title} upper`,
        color: tone(LINE.upper),
        values: mid.map((value, index) =>
          value == null || atr[index] == null ? null : value + atr[index] * multiplier,
        ),
      });
      price.push({
        id: plotId("lower"),
        title: `${title} lower`,
        color: tone(LINE.lower),
        values: mid.map((value, index) =>
          value == null || atr[index] == null ? null : value - atr[index] * multiplier,
        ),
      });
    }
    layers.push({
      id: layerId,
      title,
      roles: spec.roles,
      timeframe: spec.timeframe,
      pane,
      price,
      oscillator,
      dotValues,
      inputs: indicatorInputs(spec),
      inputsLocked: spec.reference !== true,
      timeframeLabel: chartTimeframeLabel(spec),
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
  pane: "price" | "oscillator";
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

function legendPartLabel(id: string, caption: string): string {
  const part = caption.toLowerCase();
  if (part === "upper" || id.endsWith("-upper") || id === "upper") {
    return "Upper";
  }
  if (part === "lower" || id.endsWith("-lower") || id === "lower") {
    return "Lower";
  }
  if (
    part === "mid" ||
    part === "middle" ||
    id.endsWith("-mid") ||
    id === "mid"
  ) {
    return "Middle";
  }
  if (part === "up" || id.endsWith("-up")) {
    return "Up";
  }
  if (part === "down" || id.endsWith("-down")) {
    return "Down";
  }
  if (part === "fast" || id.endsWith("-fast")) {
    return "Fast";
  }
  if (part === "slow" || id.endsWith("-slow")) {
    return "Slow";
  }
  if (!caption || part === "line") {
    return "";
  }
  return caption.charAt(0).toUpperCase() + caption.slice(1);
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
      const label = legendPartLabel(plot.id, plotCaption(plot.title, layer.title));
      values.push({
        id: plot.id,
        color: plot.color,
        text: label ? `${label} ${legendNumber(value)}` : legendNumber(value),
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
        values.push({ id: "macd", color: "#A78BFA", text: `MACD ${legendNumber(value)}` });
      }
    }
    if (oscillator?.signal) {
      const value = valueAt(oscillator.signal, index);
      if (value != null) {
        values.push({ id: "signal", color: "#F5B942", text: `Signal ${legendNumber(value)}` });
      }
    }
    if (oscillator?.histogram) {
      const value = valueAt(oscillator.histogram, index);
      if (value != null) {
        values.push({
          id: "histogram",
          color: value >= 0 ? "#34D399" : "#F07167",
          text: `Histogram ${legendNumber(value)}`,
        });
      }
    }
    rows.push({ id: layer.id, name: layer.title, values, pane: layer.pane });
  }
  return groupReplayIndicatorRows(rows);
}

/** Same indicator, including another timeframe, stays on consecutive rows. */
export function groupReplayIndicatorRows(
  rows: ReplayIndicatorLegendRow[],
): ReplayIndicatorLegendRow[] {
  const groups: ReplayIndicatorLegendRow[][] = [];
  const index = new Map<string, number>();
  for (const row of rows) {
    const key = row.name.split(" · ")[0] ?? row.name;
    const at = index.get(key);
    if (at == null) {
      index.set(key, groups.length);
      groups.push([row]);
    } else {
      groups[at]?.push(row);
    }
  }
  return groups.flat();
}
