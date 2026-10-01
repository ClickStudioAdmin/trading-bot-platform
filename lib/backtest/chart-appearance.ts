import type { IndicatorStyleColor } from "@/lib/backtest/indicator-style";
import { INDICATOR_STYLE_COLORS } from "@/lib/backtest/indicator-style";

export const REPLAY_CHART_APPEARANCE_KEY = "tbp.replay.chart-appearance";

const COLOR_IDS = new Set<string>(INDICATOR_STYLE_COLORS.map((row) => row.id));

export type ReplayChartAppearance = {
  up: IndicatorStyleColor | null;
  down: IndicatorStyleColor | null;
  background: IndicatorStyleColor | null;
  grid: IndicatorStyleColor | null;
  gridOpacity: number;
};

export type ReplayChartAppearancePatch = Partial<ReplayChartAppearance>;

export const REPLAY_BAR_FIELDS = ["up", "down"] as const;
export const REPLAY_CANVAS_FIELDS = ["background", "grid", "gridOpacity"] as const;

export function defaultReplayChartAppearance(): ReplayChartAppearance {
  return {
    up: null,
    down: null,
    background: null,
    grid: null,
    gridOpacity: 100,
  };
}

export function clampGridOpacity(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) {
    return 100;
  }
  return Math.max(0, Math.min(100, Math.round(amount)));
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
  if ("up" in patch) {
    next.up = colorId(patch.up);
  }
  if ("down" in patch) {
    next.down = colorId(patch.down);
  }
  if ("background" in patch) {
    next.background = colorId(patch.background);
  }
  if ("grid" in patch) {
    next.grid = colorId(patch.grid);
  }
  if ("gridOpacity" in patch) {
    next.gridOpacity = clampGridOpacity(patch.gridOpacity);
  }
  return next;
}

function normalizeAppearance(value: object): ReplayChartAppearance {
  const row = value as Partial<ReplayChartAppearance>;
  return mergeReplayChartAppearance(null, {
    up: colorId(row.up),
    down: colorId(row.down),
    background: colorId(row.background),
    grid: colorId(row.grid),
    gridOpacity: clampGridOpacity(row.gridOpacity),
  });
}

function colorId(value: unknown): IndicatorStyleColor | null {
  return typeof value === "string" && COLOR_IDS.has(value)
    ? (value as IndicatorStyleColor)
    : null;
}

function sameAppearance(left: ReplayChartAppearance, right: ReplayChartAppearance): boolean {
  return (
    left.up === right.up &&
    left.down === right.down &&
    left.background === right.background &&
    left.grid === right.grid &&
    left.gridOpacity === right.gridOpacity
  );
}
