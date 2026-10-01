export const INDICATOR_STYLE_COLORS = [
  { id: "accent", label: "Purple" },
  { id: "warning", label: "Gold" },
  { id: "success", label: "Green" },
  { id: "danger", label: "Red" },
  { id: "ink-muted", label: "Grey" },
  { id: "ink-faint", label: "Faint" },
] as const;

export type IndicatorStyleColor = (typeof INDICATOR_STYLE_COLORS)[number]["id"];

const COLOR_IDS = new Set<string>(INDICATOR_STYLE_COLORS.map((row) => row.id));

const GRAYS = [100, 90, 78, 66, 54, 42, 30, 20, 10, 0];
const HUES = [0, 24, 45, 72, 125, 165, 190, 215, 250, 300];
const LEVELS = [86, 70, 54, 40, 26];

export const CHART_COLOR_PALETTE: readonly string[] = [
  ...GRAYS.map((light) => hslToHex(0, 0, light)),
  ...LEVELS.flatMap((light) => HUES.map((hue) => hslToHex(hue, 78, light))),
];

export function clampChartOpacity(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) {
    return 100;
  }
  return Math.max(0, Math.min(100, Math.round(amount)));
}

/** A theme token, a #rrggbb colour, or null when the value is not a colour. */
export function normalizeChartColor(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (COLOR_IDS.has(trimmed)) {
    return trimmed;
  }
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
  if (!hex) {
    return null;
  }
  const body =
    hex[1].length === 3
      ? hex[1]
          .split("")
          .map((part) => part + part)
          .join("")
      : hex[1];
  return `#${body.toLowerCase()}`;
}

export function chartColorInputHex(color: string | null, fallback: string): string {
  const chosen = normalizeChartColor(color);
  if (chosen?.startsWith("#")) {
    return chosen;
  }
  return normalizeChartColor(fallback) ?? "#000000";
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const sat = saturation / 100;
  const light = lightness / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const huePart = hue / 60;
  const x = chroma * (1 - Math.abs((huePart % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;
  if (huePart < 1) {
    red = chroma;
    green = x;
  } else if (huePart < 2) {
    red = x;
    green = chroma;
  } else if (huePart < 3) {
    green = chroma;
    blue = x;
  } else if (huePart < 4) {
    green = x;
    blue = chroma;
  } else if (huePart < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }
  const match = light - chroma / 2;
  const channel = (amount: number) =>
    Math.round((amount + match) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}
