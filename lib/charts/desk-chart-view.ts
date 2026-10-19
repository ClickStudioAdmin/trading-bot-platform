import {
  defaultReplayChartAppearance,
  parseReplayChartAppearance,
  type ReplayChartAppearance,
} from "@/lib/backtest/chart-appearance";
import {
  type ReplayReferenceInputs,
} from "@/lib/backtest/chart-series";
import {
  parseIndicatorStyles,
  type IndicatorStyleMap,
} from "@/lib/backtest/indicator-style";
import { parseReplayRunIndicators } from "@/lib/backtest/replay-preferences";
import {
  parseDcaIndicatorTimeframe,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";

export const DESK_CHART_VIEW_KEY = "tbp.desk.chart";

export type DeskChartView = {
  interval: DcaIndicatorTimeframe;
  favoriteIntervals: DcaIndicatorTimeframe[];
  referenceIndicators: string[];
  referenceInputs: ReplayReferenceInputs;
  chartAppearance: ReplayChartAppearance;
  indicatorStyles: IndicatorStyleMap;
};

export function defaultDeskChartView(): DeskChartView {
  return {
    interval: "60",
    favoriteIntervals: [],
    referenceIndicators: [],
    referenceInputs: {},
    chartAppearance: defaultReplayChartAppearance(),
    indicatorStyles: {},
  };
}

function favoriteIntervalsFrom(value: unknown): DcaIndicatorTimeframe[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const rows: DcaIndicatorTimeframe[] = [];
  for (const item of value) {
    const parsed = parseDcaIndicatorTimeframe(item);
    if (!parsed || seen.has(parsed)) {
      continue;
    }
    seen.add(parsed);
    rows.push(parsed);
  }
  return rows;
}

export function parseDeskChartView(raw: unknown): DeskChartView {
  const row =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const indicators = parseReplayRunIndicators(row);
  const appearance =
    row.chartAppearance == null
      ? null
      : parseReplayChartAppearance(
          typeof row.chartAppearance === "string"
            ? row.chartAppearance
            : JSON.stringify(row.chartAppearance),
        );
  const styles =
    row.indicatorStyles == null
      ? {}
      : parseIndicatorStyles(
          typeof row.indicatorStyles === "string"
            ? row.indicatorStyles
            : JSON.stringify(row.indicatorStyles),
        );
  return {
    interval: parseDcaIndicatorTimeframe(row.interval) ?? "60",
    favoriteIntervals: favoriteIntervalsFrom(row.favoriteIntervals),
    referenceIndicators: indicators.referenceIndicators,
    referenceInputs: indicators.referenceInputs,
    chartAppearance: appearance ?? defaultReplayChartAppearance(),
    indicatorStyles: styles,
  };
}

export function serializeDeskChartView(value: DeskChartView): string {
  const parsed = parseDeskChartView(value);
  return JSON.stringify({
    interval: parsed.interval,
    favoriteIntervals: parsed.favoriteIntervals,
    referenceIndicators: parsed.referenceIndicators,
    referenceInputs: parsed.referenceInputs,
    chartAppearance: parsed.chartAppearance,
    indicatorStyles: parsed.indicatorStyles,
  });
}

export function readDeskChartView(raw: string | null): DeskChartView {
  if (!raw) {
    return defaultDeskChartView();
  }
  try {
    return parseDeskChartView(JSON.parse(raw) as unknown);
  } catch {
    return defaultDeskChartView();
  }
}
