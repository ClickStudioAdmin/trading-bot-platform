import {
  defaultReplayChartAppearance,
  parseReplayChartAppearance,
  type ReplayChartAppearance,
} from "@/lib/backtest/chart-appearance";
import type {
  IndicatorInputId,
  ReplayIndicatorId,
  ReplayReferenceInputs,
} from "@/lib/backtest/chart-series";
import {
  parseIndicatorStyles,
  type IndicatorLineStyle,
  type IndicatorStyleMap,
} from "@/lib/backtest/indicator-style";
import {
  DCA_INDICATOR_PERIOD_MAX,
  DCA_INDICATOR_PERIOD_MIN,
  DCA_INDICATOR_TIMEFRAMES,
  parseDcaIndicatorTimeframe,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";

export const REPLAY_VIEW_FALLBACK_KEY = "tbp.replay.view-preferences";
export const REPLAY_RUN_INDICATORS_KEY_PREFIX = "tbp.replay.run-indicators.";

const REFERENCE_IDS = [
  "rsi",
  "macd",
  "sma",
  "ema",
  "bb",
  "supertrend",
  "atr_band",
] as const satisfies readonly ReplayIndicatorId[];

const LENGTH_INPUTS = new Set<IndicatorInputId>(["length", "slowLength", "signal"]);
const FACTOR_INPUTS = new Set<IndicatorInputId>(["multiplier", "stddev"]);
const STYLE_ID = /^[a-z0-9_.:|-]{1,120}$/i;
const MAX_STYLE_LAYERS = 48;
const MAX_STYLE_LINES = 16;

/** Timeframes that always sit on the replay chart bar. */
export const REPLAY_INTERVAL_ROW_DEFAULTS = [
  "15",
  "60",
  "240",
  "D",
] as const satisfies readonly DcaIndicatorTimeframe[];

const REPLAY_INTERVAL_ROW_DEFAULT_SET = new Set<string>(REPLAY_INTERVAL_ROW_DEFAULTS);

export type ReplayViewPreferences = {
  positionsRight: boolean;
  chartAppearance: ReplayChartAppearance;
  indicatorStyles: IndicatorStyleMap;
  favoriteIntervals: DcaIndicatorTimeframe[];
};

/** Indicators a member added on one replay, plus the inputs for those lines. */
export type ReplayRunIndicators = {
  referenceIndicators: ReplayIndicatorId[];
  referenceInputs: ReplayReferenceInputs;
};

/** Default row, plus favourites, plus the interval the chart is drawing. */
export function replayIntervalRow(
  favorites: readonly DcaIndicatorTimeframe[],
  active: DcaIndicatorTimeframe,
): DcaIndicatorTimeframe[] {
  const show = new Set<string>([...REPLAY_INTERVAL_ROW_DEFAULTS, ...favorites, active]);
  return DCA_INDICATOR_TIMEFRAMES.filter((row) => show.has(row));
}

export function defaultReplayViewPreferences(): ReplayViewPreferences {
  return {
    positionsRight: true,
    chartAppearance: defaultReplayChartAppearance(),
    indicatorStyles: {},
    favoriteIntervals: [],
  };
}

export function defaultReplayRunIndicators(): ReplayRunIndicators {
  return {
    referenceIndicators: [],
    referenceInputs: {},
  };
}

export function replayRunIndicatorsStorageKey(runId: string): string {
  return `${REPLAY_RUN_INDICATORS_KEY_PREFIX}${runId}`;
}

export function parseReplayViewPreferences(raw: unknown): ReplayViewPreferences {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    positionsRight: row.positionsRight == null ? true : row.positionsRight === true,
    chartAppearance: appearanceFrom(row.chartAppearance),
    indicatorStyles: stylesFrom(row.indicatorStyles),
    favoriteIntervals: favoriteIntervalsFrom(row.favoriteIntervals),
  };
}

export function parseReplayRunIndicators(raw: unknown): ReplayRunIndicators {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    referenceIndicators: referenceIdsFrom(row.referenceIndicators),
    referenceInputs: referenceInputsFrom(row.referenceInputs),
  };
}

export function serializeReplayViewPreferences(value: unknown): string {
  const row = parseReplayViewPreferences(value);
  return JSON.stringify({
    positionsRight: row.positionsRight,
    chartAppearance: row.chartAppearance,
    indicatorStyles: sortedStyles(row.indicatorStyles),
    favoriteIntervals: row.favoriteIntervals,
  });
}

export function serializeReplayRunIndicators(value: unknown): string {
  const row = parseReplayRunIndicators(value);
  return JSON.stringify({
    referenceIndicators: row.referenceIndicators,
    referenceInputs: row.referenceInputs,
  });
}

export function mergeReplayIndicatorStyles(
  saved: IndicatorStyleMap,
  session: IndicatorStyleMap,
): IndicatorStyleMap {
  const ids = new Set([...Object.keys(saved), ...Object.keys(session)]);
  const next: IndicatorStyleMap = {};
  for (const id of ids) {
    const lines = {
      ...(saved[id]?.lines ?? {}),
      ...(session[id]?.lines ?? {}),
    };
    if (Object.keys(lines).length > 0) {
      next[id] = { lines };
    }
  }
  return stylesFrom(next);
}

/** Server row wins. This only fills a login that has no saved row yet. */
export function replayViewFromLocal(
  fallbackRaw: string | null,
  appearanceRaw: string | null,
  stylesRaw: string | null,
): ReplayViewPreferences {
  if (fallbackRaw) {
    try {
      const parsed = JSON.parse(fallbackRaw) as unknown;
      if (parsed && typeof parsed === "object") {
        return parseReplayViewPreferences(parsed);
      }
    } catch {
      // Fall through to the older appearance and style keys.
    }
  }
  const defaults = defaultReplayViewPreferences();
  const appearance = parseReplayChartAppearance(appearanceRaw);
  let styles: IndicatorStyleMap = {};
  if (stylesRaw) {
    try {
      styles = stylesFrom(JSON.parse(stylesRaw) as unknown);
    } catch {
      styles = {};
    }
  }
  return {
    ...defaults,
    chartAppearance: appearance ?? defaults.chartAppearance,
    indicatorStyles: styles,
  };
}

function appearanceFrom(value: unknown): ReplayChartAppearance {
  if (value == null) {
    return defaultReplayChartAppearance();
  }
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  return parseReplayChartAppearance(raw) ?? defaultReplayChartAppearance();
}

function stylesFrom(value: unknown): IndicatorStyleMap {
  if (value == null) {
    return {};
  }
  const parsed =
    typeof value === "string" ? parseIndicatorStyles(value) : parseIndicatorStyles(JSON.stringify(value));
  const next: IndicatorStyleMap = {};
  let layers = 0;
  for (const id of Object.keys(parsed).sort()) {
    if (layers >= MAX_STYLE_LAYERS || !STYLE_ID.test(id)) {
      continue;
    }
    const lines: Record<string, IndicatorLineStyle> = {};
    let count = 0;
    for (const lineId of Object.keys(parsed[id]?.lines ?? {}).sort()) {
      const style = parsed[id]?.lines[lineId];
      if (!style || count >= MAX_STYLE_LINES || !STYLE_ID.test(lineId)) {
        continue;
      }
      lines[lineId] = style;
      count += 1;
    }
    if (count > 0) {
      next[id] = { lines };
      layers += 1;
    }
  }
  return next;
}

function sortedStyles(map: IndicatorStyleMap): IndicatorStyleMap {
  return stylesFrom(map);
}

function favoriteIntervalsFrom(value: unknown): DcaIndicatorTimeframe[] {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  for (const item of raw) {
    const interval = parseDcaIndicatorTimeframe(item);
    if (interval && !REPLAY_INTERVAL_ROW_DEFAULT_SET.has(interval)) {
      seen.add(interval);
    }
  }
  return DCA_INDICATOR_TIMEFRAMES.filter((row) => seen.has(row));
}

function referenceIdsFrom(value: unknown): ReplayIndicatorId[] {
  const raw = Array.isArray(value) ? value.map((item) => String(item)) : [];
  const seen = new Set(raw);
  return REFERENCE_IDS.filter((id) => seen.has(id));
}

function referenceInputsFrom(value: unknown): ReplayReferenceInputs {
  if (!value || typeof value !== "object") {
    return {};
  }
  const source = value as Record<string, unknown>;
  const next: ReplayReferenceInputs = {};
  for (const id of REFERENCE_IDS) {
    const row = source[id];
    if (!row || typeof row !== "object") {
      continue;
    }
    const fields = row as Record<string, unknown>;
    const settings: Partial<Record<IndicatorInputId, number>> = {};
    for (const inputId of LENGTH_INPUTS) {
      const clamped = clampLength(fields[inputId]);
      if (clamped != null) {
        settings[inputId] = clamped;
      }
    }
    for (const inputId of FACTOR_INPUTS) {
      const clamped = clampFactor(fields[inputId]);
      if (clamped != null) {
        settings[inputId] = clamped;
      }
    }
    if (Object.keys(settings).length > 0) {
      next[id] = settings;
    }
  }
  return next;
}

function clampLength(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(
    DCA_INDICATOR_PERIOD_MAX,
    Math.max(DCA_INDICATOR_PERIOD_MIN, Math.round(value)),
  );
}

function clampFactor(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value * 10) / 10;
  return Math.min(50, Math.max(0.1, rounded));
}
