import { DCA_INDICATOR_TIMEFRAME_LABELS } from "@/lib/dca/indicators";
import { isoDateUtc } from "@/lib/backtest/model";

export const CANDLE_HISTORY_FLOOR_MS = Date.UTC(2016, 0, 1);

export type CandleSpan = {
  symbol: string;
  earliestMs: number;
  latestMs: number;
};

export function candleVenueLabel(venue: string): string {
  return venue === "hyperliquid" ? "Hyperliquid" : "Bybit";
}

export function utcDayFloor(ms: number): number {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function formatUtcDay(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatYearMonthSpan(fromMs: number, toMs: number): string {
  if (!(toMs > fromMs)) {
    return "0 days";
  }
  const start = new Date(fromMs);
  const end = new Date(toMs);
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) {
    months -= 1;
  }
  if (months < 1) {
    const days = Math.max(1, Math.round((toMs - fromMs) / 86_400_000));
    return days === 1 ? "1 day" : `${days} days`;
  }
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const parts: string[] = [];
  if (years > 0) {
    parts.push(years === 1 ? "1 year" : `${years} years`);
  }
  if (rem > 0) {
    parts.push(rem === 1 ? "1 month" : `${rem} months`);
  }
  return parts.join(", ");
}

/** Earliest candle in a series. `exists` is true when any candle falls in the inclusive window. */
export async function findEarliestCandleMs(input: {
  exists: (startMs: number, endMs: number) => Promise<boolean>;
  oldestIn: (startMs: number, endMs: number) => Promise<number | null>;
  nowMs: number;
  stepMs: number;
  floorMs?: number;
}): Promise<number | null> {
  const step = Math.max(1, Math.floor(input.stepMs));
  const floor = input.floorMs ?? CANDLE_HISTORY_FLOOR_MS;
  const now = input.nowMs;
  if (!(now > floor)) {
    return null;
  }
  const recentStart = Math.max(floor, now - step * 4);
  const recent = await input.oldestIn(recentStart, now);
  if (recent == null && !(await input.exists(floor, now))) {
    return null;
  }
  let low = floor;
  let high = now;
  for (let i = 0; i < 40 && high - low > step; i += 1) {
    const mid = low + Math.floor((high - low) / 2);
    if (await input.exists(low, mid)) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return input.oldestIn(low, Math.min(now, high));
}

export function limitingCandleSpan(spans: readonly CandleSpan[]): CandleSpan | null {
  if (spans.length === 0) {
    return null;
  }
  const earliestMs = Math.max(...spans.map((row) => row.earliestMs));
  const latestMs = Math.min(...spans.map((row) => row.latestMs));
  if (!(latestMs >= earliestMs)) {
    return null;
  }
  const limiting = spans.reduce((best, row) =>
    row.earliestMs > best.earliestMs ? row : best,
  );
  return { symbol: limiting.symbol, earliestMs, latestMs };
}

export function candleAvailabilityNotice(input: {
  span: CandleSpan;
  intervalLabel: string;
  venueLabel: string;
  primarySymbol: string;
}): string {
  const from = formatUtcDay(input.span.earliestMs);
  const to = formatUtcDay(input.span.latestMs);
  const length = formatYearMonthSpan(input.span.earliestMs, input.span.latestMs);
  const range = `${from} to ${to} (${length})`;
  if (input.span.symbol === input.primarySymbol) {
    return `Maximum available range for ${input.span.symbol} ${input.intervalLabel} on ${input.venueLabel} is ${range}.`;
  }
  return `Maximum available range is ${range}. ${input.span.symbol} ${input.intervalLabel} on ${input.venueLabel} is the shortest history in this test.`;
}

export function candleRangesDoNotOverlap(
  intervalLabel: string,
  venueLabel: string,
): string {
  return `These pairs have no shared ${intervalLabel} history on ${venueLabel}, so this test cannot run.`;
}

export function candleRangeError(input: {
  fromMs: number;
  toMs: number;
  earliestMs: number;
  latestMs: number;
  symbol: string;
  intervalLabel: string;
  venueLabel: string;
}): string | null {
  const earliestDay = utcDayFloor(input.earliestMs);
  const latestDay = utcDayFloor(input.latestMs);
  const fromDay = utcDayFloor(input.fromMs);
  const toDay = utcDayFloor(input.toMs);
  const pair = `${input.symbol} ${input.intervalLabel} on ${input.venueLabel}`;
  if (fromDay < earliestDay || toDay < earliestDay) {
    return `This range starts before ${pair} has candles. The earliest candle is ${formatUtcDay(input.earliestMs)}.`;
  }
  if (fromDay > latestDay || toDay > latestDay) {
    return `This range ends after the last ${input.symbol} ${input.intervalLabel} candle on ${input.venueLabel} (${formatUtcDay(input.latestMs)}).`;
  }
  return null;
}

export function maxCandleRangeDates(
  span: CandleSpan,
  today: string,
): { from: string; to: string } {
  const latest = isoDateUtc(span.latestMs);
  return {
    from: isoDateUtc(span.earliestMs),
    to: latest < today ? latest : today,
  };
}

export function candleHistoryBlockedMessage(input: {
  venueLabel: string;
  symbol: string;
  intervalLabel: string;
}): string {
  return `Could not check ${input.symbol} ${input.intervalLabel} history on ${input.venueLabel}. This test stays blocked until that check succeeds.`;
}

export function missingCandleHistoryMessage(input: {
  venueLabel: string;
  symbol: string;
  intervalLabel: string;
}): string {
  return `No ${input.intervalLabel} candles for ${input.symbol} on ${input.venueLabel}.`;
}

export function intervalHistoryLabel(
  interval: keyof typeof DCA_INDICATOR_TIMEFRAME_LABELS,
): string {
  return DCA_INDICATOR_TIMEFRAME_LABELS[interval];
}
