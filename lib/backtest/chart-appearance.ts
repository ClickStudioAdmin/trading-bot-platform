import { clampChartOpacity, normalizeChartColor } from "@/lib/backtest/chart-color";

export const REPLAY_CHART_APPEARANCE_KEY = "tbp.replay.chart-appearance";

export type ReplayPriceSeries = "candles" | "line";

export type ReplayChartAppearance = {
  series: ReplayPriceSeries;
  up: string | null;
  down: string | null;
  background: string | null;
  grid: string | null;
  upOpacity: number;
  downOpacity: number;
  backgroundOpacity: number;
  gridOpacity: number;
};

export type ReplayChartAppearancePatch = Partial<ReplayChartAppearance>;

export const REPLAY_BAR_FIELDS = ["series"] as const;
export const REPLAY_CANVAS_FIELDS = [
  "background",
  "grid",
  "backgroundOpacity",
  "gridOpacity",
  "up",
  "down",
  "upOpacity",
  "downOpacity",
] as const;

export function defaultReplayChartAppearance(): ReplayChartAppearance {
  return {
    series: "candles",
    up: null,
    down: null,
    background: null,
    grid: null,
    upOpacity: 100,
    downOpacity: 100,
    backgroundOpacity: 100,
    gridOpacity: 30,
  };
}

export function normalizePriceSeries(value: unknown): ReplayPriceSeries {
  return value === "line" ? "line" : "candles";
}

export function clampGridOpacity(value: unknown): number {
  return clampChartOpacity(value);
}

export function colorWithOpacity(color: string, opacityPercent: number): string {
  const opacity = clampGridOpacity(opacityPercent) / 100;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const body =
      hex[1].length === 3
        ? hex[1]
            .split("")
            .map((part) => part + part)
            .join("")
        : hex[1];
    const red = Number.parseInt(body.slice(0, 2), 16);
    const green = Number.parseInt(body.slice(2, 4), 16);
    const blue = Number.parseInt(body.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color.trim());
  if (rgb) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${opacity})`;
  }
  return color;
}

export function replayGridPaint(
  color: string,
  opacity: number,
): { color: string; visible: boolean } {
  const amount = clampGridOpacity(opacity);
  if (amount <= 0) {
    return { color, visible: false };
  }
  if (amount >= 100) {
    return { color, visible: true };
  }
  return { color: colorWithOpacity(color, amount), visible: true };
}

export function parseReplayChartAppearance(raw: string | null): ReplayChartAppearance | null {
  if (!raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  return normalizeAppearance(parsed);
}

export function serializeReplayChartAppearance(value: ReplayChartAppearance): string {
  return JSON.stringify(value);
}

export function mergeReplayChartAppearance(
  saved: ReplayChartAppearance | null,
  session: ReplayChartAppearancePatch,
): ReplayChartAppearance {
  return { ...(saved ?? defaultReplayChartAppearance()), ...cleanPatch(session) };
}

export function patchReplayChartAppearance(
  session: ReplayChartAppearancePatch,
  patch: ReplayChartAppearancePatch,
): ReplayChartAppearancePatch {
  return { ...session, ...cleanPatch(patch) };
}

export function pickReplayChartFields(
  session: ReplayChartAppearancePatch,
  fields: readonly (keyof ReplayChartAppearance)[],
): ReplayChartAppearancePatch {
  const patch: ReplayChartAppearancePatch = {};
  for (const field of fields) {
    if (field in session) {
      patch[field] = session[field] as never;
    }
  }
  return patch;
}

export function clearReplayChartFields(
  session: ReplayChartAppearancePatch,
  fields: readonly (keyof ReplayChartAppearance)[],
): ReplayChartAppearancePatch {
  const next = { ...session };
  for (const field of fields) {
    delete next[field];
  }
  return next;
}

export function saveReplayChartAppearance(
  saved: ReplayChartAppearance | null,
  session: ReplayChartAppearancePatch,
): ReplayChartAppearance {
  return mergeReplayChartAppearance(saved, session);
}

export function resetReplayChartFields(
  saved: ReplayChartAppearance | null,
  fields: readonly (keyof ReplayChartAppearance)[],
): ReplayChartAppearance | null {
  if (!saved) {
    return null;
  }
  const defaults = defaultReplayChartAppearance();
  const next = { ...saved };
  for (const field of fields) {
    next[field] = defaults[field] as never;
  }
  return sameAppearance(next, defaults) ? null : next;
}

function cleanPatch(patch: ReplayChartAppearancePatch): ReplayChartAppearancePatch {
  const next: ReplayChartAppearancePatch = {};
  if ("series" in patch) {
    next.series = normalizePriceSeries(patch.series);
  }
  if ("up" in patch) {
    next.up = normalizeChartColor(patch.up);
  }
  if ("down" in patch) {
    next.down = normalizeChartColor(patch.down);
  }
  if ("background" in patch) {
    next.background = normalizeChartColor(patch.background);
  }
  if ("grid" in patch) {
    next.grid = normalizeChartColor(patch.grid);
  }
  if ("upOpacity" in patch) {
    next.upOpacity = clampChartOpacity(patch.upOpacity);
  }
  if ("downOpacity" in patch) {
    next.downOpacity = clampChartOpacity(patch.downOpacity);
  }
  if ("backgroundOpacity" in patch) {
    next.backgroundOpacity = clampChartOpacity(patch.backgroundOpacity);
  }
  if ("gridOpacity" in patch) {
    next.gridOpacity = clampChartOpacity(patch.gridOpacity);
  }
  return next;
}

function normalizeAppearance(value: object): ReplayChartAppearance {
  const row = value as Partial<ReplayChartAppearance>;
  return mergeReplayChartAppearance(null, {
    series: normalizePriceSeries(row.series),
    up: normalizeChartColor(row.up),
    down: normalizeChartColor(row.down),
    background: normalizeChartColor(row.background),
    grid: normalizeChartColor(row.grid),
    upOpacity: clampChartOpacity(row.upOpacity),
    downOpacity: clampChartOpacity(row.downOpacity),
    backgroundOpacity: clampChartOpacity(row.backgroundOpacity),
    gridOpacity:
      row.gridOpacity === undefined
        ? defaultReplayChartAppearance().gridOpacity
        : clampChartOpacity(row.gridOpacity),
  });
}

function sameAppearance(left: ReplayChartAppearance, right: ReplayChartAppearance): boolean {
  return (
    left.series === right.series &&
    left.up === right.up &&
    left.down === right.down &&
    left.background === right.background &&
    left.grid === right.grid &&
    left.upOpacity === right.upOpacity &&
    left.downOpacity === right.downOpacity &&
    left.backgroundOpacity === right.backgroundOpacity &&
    left.gridOpacity === right.gridOpacity
  );
}
