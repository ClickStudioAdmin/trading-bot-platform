import type { FuturesSide } from "@/lib/futures/model";

export type DcaIndicatorKind = "rsi" | "macd" | "ema_cross";
export type DcaIndicatorCompare = "gte" | "lte" | "cross_gte" | "cross_lte";
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

export function parseDcaIndicatorCompare(
  value: unknown,
): DcaIndicatorCompare | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "gte" || raw === "lte" || raw === "cross_gte" || raw === "cross_lte") {
    return raw;
  }
  return null;
}

export function crossedLevel(
  prev: number,
  now: number,
  level: number,
  direction: "up" | "down",
): boolean {
  if (direction === "up") {
    return prev < level && now >= level;
  }
  return prev > level && now <= level;
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

function lastTwoOf(
  compute: (closes: number[]) => number | null,
  closes: number[],
): { prev: number; now: number } | null {
  if (closes.length < 2) {
    return null;
  }
  const now = compute(closes);
  const prev = compute(closes.slice(0, -1));
  if (now === null || prev === null) {
    return null;
  }
  return { prev, now };
}

function lastTwoEma(
  closes: number[],
  period: number,
): { prev: number; now: number } | null {
  const ema = emaValues(closes, period);
  if (ema.length < 2) {
    return null;
  }
  return { prev: ema[ema.length - 2], now: ema[ema.length - 1] };
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
  compare: DcaIndicatorCompare | null;
  level: number | null;
  splitBySide?: boolean;
}): boolean {
  const split = Boolean(input.splitBySide);
  const cross = input.compare === "cross_gte" || input.compare === "cross_lte";
  if (input.kind === "rsi") {
    if (input.level === null || !input.compare) {
      return false;
    }
    if (cross) {
      const pair = lastTwoOf(rsiValue, input.closes);
      if (!pair) {
        return false;
      }
      const direction = split
        ? input.side === "long"
          ? "down"
          : "up"
        : input.compare === "cross_gte"
          ? "up"
          : "down";
      return crossedLevel(pair.prev, pair.now, input.level, direction);
    }
    const rsi = rsiValue(input.closes);
    if (rsi === null) {
      return false;
    }
    if (split) {
      return input.side === "long" ? rsi <= input.level : rsi >= input.level;
    }
    if (input.compare === "gte") {
      return rsi >= input.level;
    }
    return rsi <= input.level;
  }
  if (input.kind === "macd") {
    if (cross) {
      const pair = lastTwoOf(macdHistogram, input.closes);
      if (!pair) {
        return false;
      }
      return input.side === "long"
        ? crossedLevel(pair.prev, pair.now, 0, "up")
        : crossedLevel(pair.prev, pair.now, 0, "down");
    }
    const hist = macdHistogram(input.closes);
    if (hist === null) {
      return false;
    }
    return input.side === "long" ? hist > 0 : hist < 0;
  }
  if (cross) {
    if (input.level === null) {
      return false;
    }
    const pair = lastTwoEma(input.closes, 21);
    if (!pair) {
      return false;
    }
    return crossedLevel(
      pair.prev,
      pair.now,
      input.level,
      input.side === "long" ? "up" : "down",
    );
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
