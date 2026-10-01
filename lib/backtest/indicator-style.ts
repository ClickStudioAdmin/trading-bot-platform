import {
  clampChartOpacity,
  normalizeChartColor,
} from "@/lib/backtest/chart-color";

export {
  INDICATOR_STYLE_COLORS,
  type IndicatorStyleColor,
} from "@/lib/backtest/chart-color";

export const REPLAY_INDICATOR_STYLE_KEY = "tbp.replay.indicator-styles";

export type IndicatorLineStyle = {
  color: string | null;
  opacity: number;
  lineWidth: 1 | 2 | 3;
  visible: boolean;
};

export type IndicatorStyleOverride = {
  lines: Record<string, IndicatorLineStyle>;
};

export type IndicatorStyleMap = Record<string, IndicatorStyleOverride>;

export function defaultIndicatorLineStyle(): IndicatorLineStyle {
  return { color: null, opacity: 100, lineWidth: 2, visible: true };
}

export function parseIndicatorStyles(raw: string | null): IndicatorStyleMap {
  if (!raw) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") {
    return {};
  }
  const map: IndicatorStyleMap = {};
  for (const [id, value] of Object.entries(parsed)) {
    const lines = lineMap(value);
    if (lines) {
      map[id] = { lines };
    }
  }
  return map;
}

export function serializeIndicatorStyles(map: IndicatorStyleMap): string {
  return JSON.stringify(map);
}

export function indicatorLineStyle(
  session: IndicatorStyleMap,
  saved: IndicatorStyleMap,
  layerId: string,
  lineId: string,
): IndicatorLineStyle {
  return completeLineStyle(
    session[layerId]?.lines[lineId] ??
      saved[layerId]?.lines[lineId] ??
      defaultIndicatorLineStyle(),
  );
}

export function writeIndicatorLineStyle(
  map: IndicatorStyleMap,
  layerId: string,
  lineId: string,
  style: IndicatorLineStyle,
): IndicatorStyleMap {
  return {
    ...map,
    [layerId]: {
      lines: {
        ...(map[layerId]?.lines ?? {}),
        [lineId]: completeLineStyle(style),
      },
    },
  };
}

export function saveIndicatorStyleGlobal(
  saved: IndicatorStyleMap,
  session: IndicatorStyleMap,
  layerId: string,
): IndicatorStyleMap {
  const lines = {
    ...(saved[layerId]?.lines ?? {}),
    ...(session[layerId]?.lines ?? {}),
  };
  return { ...saved, [layerId]: { lines } };
}

export function resetIndicatorStyle(
  map: IndicatorStyleMap,
  layerId: string,
): IndicatorStyleMap {
  if (!(layerId in map)) {
    return map;
  }
  const next = { ...map };
  delete next[layerId];
  return next;
}

function lineMap(value: unknown): Record<string, IndicatorLineStyle> | null {
  if (!value || typeof value !== "object" || !("lines" in value)) {
    return null;
  }
  const lines = (value as { lines?: unknown }).lines;
  if (!lines || typeof lines !== "object") {
    return null;
  }
  const map: Record<string, IndicatorLineStyle> = {};
  for (const [id, row] of Object.entries(lines)) {
    const style = lineStyle(row);
    if (style) {
      map[id] = style;
    }
  }
  return map;
}

function lineStyle(value: unknown): IndicatorLineStyle | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const row = value as {
    color?: unknown;
    opacity?: unknown;
    lineWidth?: unknown;
    visible?: unknown;
  };
  const width = row.lineWidth;
  const lineWidth = width === 1 || width === 2 || width === 3 ? width : 2;
  return {
    color: normalizeChartColor(row.color),
    opacity: row.opacity == null ? 100 : clampChartOpacity(row.opacity),
    lineWidth,
    visible: row.visible !== false,
  };
}

function completeLineStyle(style: IndicatorLineStyle): IndicatorLineStyle {
  const width = style.lineWidth;
  return {
    color: normalizeChartColor(style.color),
    opacity: clampChartOpacity(style.opacity),
    lineWidth: width === 1 || width === 2 || width === 3 ? width : 2,
    visible: style.visible !== false,
  };
}
