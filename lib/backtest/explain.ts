import { formatDcaFilterReason, type DcaFilterSpec } from "@/lib/dca/filters";
import {
  bollingerBands,
  DCA_INDICATOR_TIMEFRAME_LABELS,
  DEFAULT_DCA_BB_PERIOD,
  DEFAULT_DCA_CROSS_FAST_PERIOD,
  DEFAULT_DCA_CROSS_SLOW_PERIOD,
  DEFAULT_DCA_MA_PERIOD,
  DEFAULT_DCA_RSI_PERIOD,
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DEFAULT_DCA_SUPERTREND_PERIOD,
  emaValues,
  formatDcaIndicatorStartLabel,
  macdHistogram,
  rsiValue,
  smaValues,
  supertrendDirections,
  type DcaIndicatorCompare,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
  type SupertrendBar,
} from "@/lib/dca/indicators";
import type { DcaPriceTrigger } from "@/lib/dca/playbook";
import { formatPriceCrossReason } from "@/lib/bots/condition-copy";
import { formatPrice } from "@/lib/opportunities/format";
import type { FuturesSide } from "@/lib/futures/model";

function move(prev: number | null, now: number | null): string {
  if (prev == null || now == null) {
    return "";
  }
  return ` (${formatPrice(prev)} → ${formatPrice(now)})`;
}

function lastTwo(
  values: number[],
): { prev: number; now: number } | null {
  if (values.length < 2) {
    return null;
  }
  const prev = values[values.length - 2];
  const now = values[values.length - 1];
  if (prev == null || now == null) {
    return null;
  }
  return { prev, now };
}

export function indicatorBecause(input: {
  kind: DcaIndicatorKind;
  compare: DcaIndicatorCompare | null;
  level: number | null;
  period: number | null;
  slowPeriod: number | null;
  multiplier: number | null;
  timeframe: DcaIndicatorTimeframe | null;
  side: FuturesSide;
  closes: number[];
  bars: SupertrendBar[];
}): string {
  const label = formatDcaIndicatorStartLabel({
    kind: input.kind,
    compare: input.compare,
    level: input.level,
    period: input.period,
    slowPeriod: input.slowPeriod,
    multiplier: input.multiplier,
    timeframe: input.timeframe,
    side: input.side,
  });
  const tf = input.timeframe
    ? DCA_INDICATOR_TIMEFRAME_LABELS[input.timeframe]
    : "";
  if (input.kind === "rsi") {
    const period = input.period ?? DEFAULT_DCA_RSI_PERIOD;
    const now = rsiValue(input.closes, period);
    const prev = rsiValue(input.closes.slice(0, -1), period);
    return `${label}${move(prev, now)}.`;
  }
  if (input.kind === "macd") {
    const now = macdHistogram(input.closes);
    const prev = macdHistogram(input.closes.slice(0, -1));
    return `${label}${move(prev, now)}.`;
  }
  if (input.kind === "ema" || input.kind === "sma") {
    const period = input.period ?? DEFAULT_DCA_MA_PERIOD;
    const series =
      input.kind === "ema"
        ? emaValues(input.closes, period)
        : smaValues(input.closes, period);
    const pair = lastTwo(series);
    const price = input.closes[input.closes.length - 1];
    const average = pair ? ` Average ${formatPrice(pair.now)}, close ${formatPrice(price ?? null)}.` : "";
    return `${label}.${average}`;
  }
  if (input.kind === "ema_cross" || input.kind === "sma_cross") {
    const fastPeriod = input.period ?? DEFAULT_DCA_CROSS_FAST_PERIOD;
    const slowPeriod = input.slowPeriod ?? DEFAULT_DCA_CROSS_SLOW_PERIOD;
    const series = input.kind === "ema_cross" ? emaValues : smaValues;
    const fast = lastTwo(series(input.closes, fastPeriod));
    const slow = lastTwo(series(input.closes, slowPeriod));
    const detail =
      fast && slow
        ? ` Fast ${formatPrice(fast.now)}, slow ${formatPrice(slow.now)}.`
        : "";
    return `${label}.${detail}`;
  }
  if (input.kind === "bb") {
    const period = input.period ?? DEFAULT_DCA_BB_PERIOD;
    const now = bollingerBands(input.closes, period);
    const price = input.closes[input.closes.length - 1];
    const detail = now
      ? ` Close ${formatPrice(price ?? null)}, band ${formatPrice(now.lower)}–${formatPrice(now.upper)}.`
      : "";
    return `${label}.${detail}`;
  }
  if (input.kind === "supertrend") {
    const period = input.period ?? DEFAULT_DCA_SUPERTREND_PERIOD;
    const multiplier = input.multiplier ?? DEFAULT_DCA_SUPERTREND_MULTIPLIER;
    const dirs = supertrendDirections(input.bars, period, multiplier);
    const dir = dirs?.[dirs.length - 1];
    const tone = dir === 1 ? "bullish" : dir === -1 ? "bearish" : "";
    return tone ? `${label}. Supertrend is ${tone}${tf ? ` on ${tf}` : ""}.` : `${label}.`;
  }
  return label ? `${label}.` : "";
}

export function priceStartBecause(
  trigger: DcaPriceTrigger | null,
  price: number,
): string {
  if (!trigger || !(trigger.price > 0)) {
    return "Price start.";
  }
  return `${formatPriceCrossReason({
    source: trigger.triggerBy,
    compare: trigger.compare,
    level: trigger.price,
    price,
  })}.`;
}

export function filterBecause(
  spec: DcaFilterSpec | null | undefined,
  side: FuturesSide,
  role: "Confirm" | "Exit if",
): string {
  if (!spec) {
    return "";
  }
  return `${role}: ${formatDcaFilterReason(spec, side)}.`;
}
