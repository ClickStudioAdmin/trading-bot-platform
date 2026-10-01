export const REPLAY_INDICATOR_STYLE_KEY = "tbp.replay.indicator-styles";

export const INDICATOR_STYLE_COLORS = [
  { id: "accent", label: "Purple" },
  { id: "warning", label: "Gold" },
  { id: "success", label: "Green" },
  { id: "danger", label: "Red" },
  { id: "ink-muted", label: "Grey" },
  { id: "ink-faint", label: "Faint" },
] as const;

export type IndicatorStyleColor = (typeof INDICATOR_STYLE_COLORS)[number]["id"];

export type IndicatorLineStyle = {
  color: IndicatorStyleColor | null;
  lineWidth: 1 | 2 | 3;
  visible: boolean;
};

export type IndicatorStyleOverride = {
  lines: Record<string, IndicatorLineStyle>;
};

export type IndicatorStyleMap = Record<string, IndicatorStyleOverride>;

const COLOR_IDS = new Set<string>(INDICATOR_STYLE_COLORS.map((row) => row.id));

export function defaultIndicatorLineStyle(): IndicatorLineStyle {
  return { color: null, lineWidth: 2, visible: true };
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
  return (
    session[layerId]?.lines[lineId] ??
    saved[layerId]?.lines[lineId] ??
    defaultIndicatorLineStyle()
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
        [lineId]: style,
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
  const row = value as { color?: unknown; lineWidth?: unknown; visible?: unknown };
  const color =
    row.color == null
      ? null
      : typeof row.color === "string" && COLOR_IDS.has(row.color)
        ? (row.color as IndicatorStyleColor)
        : null;
  const width = row.lineWidth;
  const lineWidth = width === 1 || width === 2 || width === 3 ? width : 2;
  return {
    color,
    lineWidth,
    visible: row.visible !== false,
  };
}
