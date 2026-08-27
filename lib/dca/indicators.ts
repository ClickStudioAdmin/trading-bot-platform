import type { FuturesSide } from "@/lib/futures/model";
import type { FuturesTriggerCompare } from "@/lib/futures/automation";

export type DcaIndicatorKind = "rsi" | "macd" | "ema_cross";
export const DCA_INDICATOR_TIMEFRAMES = [
  "5",
  "15",
  "30",
  "60",
  "120",
  "240",
  "360",
  "720",
  "D",
] as const;
export type DcaIndicatorTimeframe = (typeof DCA_INDICATOR_TIMEFRAMES)[number];
export const DCA_INDICATOR_TIMEFRAME_LABELS: Record<
  DcaIndicatorTimeframe,
  string
> = {
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1h",
  "120": "2h",
  "240": "4h",
  "360": "6h",
  "720": "12h",
  D: "Daily",
};

export function parseDcaIndicatorTimeframe(
  value: unknown,
): DcaIndicatorTimeframe | null {
  const raw = String(value ?? "").trim();
  return (DCA_INDICATOR_TIMEFRAMES as readonly string[]).includes(raw)
    ? (raw as DcaIndicatorTimeframe)
    : null;
}

export function emaValues(closes: number[], period: number): number[] {
  if (period < 1 || closes.length < period) {
    return [];
  }
  const k = 2 / (period + 1);
  const out: number[] = [];
  let ema =
    closes.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  out.push(ema);
  for (let i = period; i < closes.length; i += 1) {
    ema = closes[i] * k + ema * (1 - k);
    out.push(ema);
  }
  return out;
}

export function rsiValue(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) {
    return null;
  }
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) {
      gain += delta;
    } else {
      loss -= delta;
    }
  }
  gain /= period;
  loss /= period;
  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1];
    const up = delta > 0 ? delta : 0;
    const down = delta < 0 ? -delta : 0;
    gain = (gain * (period - 1) + up) / period;
    loss = (loss * (period - 1) + down) / period;
  }
  if (loss === 0) {
    return 100;
  }
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
}

export function macdHistogram(closes: number[]): number | null {
  const fast = emaValues(closes, 12);
  const slow = emaValues(closes, 26);
  if (fast.length === 0 || slow.length === 0) {
    return null;
  }
  const alignedFast = fast.slice(fast.length - slow.length);
  const macdLine = alignedFast.map((value, i) => value - slow[i]);
  const signal = emaValues(macdLine, 9);
  if (signal.length === 0) {
    return null;
  }
  return macdLine[macdLine.length - 1] - signal[signal.length - 1];
}

export function emaCrossBullish(closes: number[]): boolean | null {
  const fast = emaValues(closes, 9);
  const slow = emaValues(closes, 21);
  if (fast.length < 2 || slow.length < 2) {
    return null;
  }
  const fastNow = fast[fast.length - 1];
  const slowNow = slow[slow.length - 1];
  const fastPrev = fast[fast.length - 2];
  const slowPrev = slow[slow.length - 2];
  return fastNow > slowNow && fastPrev <= slowPrev;
}

export function indicatorStartMet(input: {
  kind: DcaIndicatorKind;
  side: FuturesSide;
  closes: number[];
  compare: FuturesTriggerCompare | null;
  level: number | null;
}): boolean {
  if (input.kind === "rsi") {
    const rsi = rsiValue(input.closes);
    if (rsi === null || input.level === null || !input.compare) {
      return false;
    }
    if (input.compare === "gte") {
      return rsi >= input.level;
    }
    return rsi <= input.level;
  }
  if (input.kind === "macd") {
    const hist = macdHistogram(input.closes);
    if (hist === null) {
      return false;
    }
    return input.side === "long" ? hist > 0 : hist < 0;
  }
  if (input.side === "long") {
    return emaCrossBullish(input.closes) === true;
  }
  return emaCrossBearish(input.closes);
}

function emaCrossBearish(closes: number[]): boolean {
  const fast = emaValues(closes, 9);
  const slow = emaValues(closes, 21);
  if (fast.length < 2 || slow.length < 2) {
    return false;
  }
  const fastNow = fast[fast.length - 1];
  const slowNow = slow[slow.length - 1];
  const fastPrev = fast[fast.length - 2];
  const slowPrev = slow[slow.length - 2];
  return fastNow < slowNow && fastPrev >= slowPrev;
}
