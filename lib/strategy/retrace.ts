import type { ConflictClaim } from "@/lib/strategy/conflicts";
import {
  parseDcaIndicatorTimeframe,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import type { FuturesSide, FuturesTrigger } from "@/lib/futures/model";

export const DEFAULT_RETRACE_LOOKBACK = 20;
export const RETRACE_LOOKBACK_MIN = 1;
export const RETRACE_LOOKBACK_MAX = 400;

export type RetraceSource = FuturesTrigger;
export type RetraceFrom = "high" | "low";

export type RetraceSpec = {
  source: RetraceSource;
  from: RetraceFrom;
  pct: number;
  lookback: number;
  timeframe: DcaIndicatorTimeframe;
};

export type RetraceBar = { high: number; low: number; close: number };

export function defaultRetraceFrom(side: FuturesSide): RetraceFrom {
  return side === "short" ? "low" : "high";
}

export function parseRetraceSource(value: unknown): RetraceSource | null {
  const raw = String(value ?? "").trim();
  if (raw === "last" || raw === "mark" || raw === "index") {
    return raw;
  }
  return null;
}

export function parseRetraceFrom(value: unknown): RetraceFrom | null {
  const raw = String(value ?? "").trim();
  if (raw === "high" || raw === "low") {
    return raw;
  }
  return null;
}

export function parseRetracePct(value: unknown): number | null {
  if (value == null || String(value).trim() === "") {
    return null;
  }
  const pct = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(pct) || !(pct > 0)) {
    return null;
  }
  return pct;
}

export function parseRetraceLookback(value: unknown): number | null {
  if (value == null || String(value).trim() === "") {
    return null;
  }
  const lookback = Math.trunc(Number(value));
  if (
    !Number.isFinite(lookback) ||
    lookback < RETRACE_LOOKBACK_MIN ||
    lookback > RETRACE_LOOKBACK_MAX
  ) {
    return null;
  }
  return lookback;
}

export function parseRetraceSpec(raw: unknown): RetraceSpec | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const source = parseRetraceSource(row.source);
  const from = parseRetraceFrom(row.from);
  const pct = parseRetracePct(row.pct);
  const lookback = parseRetraceLookback(row.lookback);
  const timeframe = parseDcaIndicatorTimeframe(row.timeframe);
  if (!source || !from || pct == null || lookback == null || !timeframe) {
    return null;
  }
  return { source, from, pct, lookback, timeframe };
}

/** Price the retrace test compares against. Null until the lookback window is full. */
export function retraceLevelPrice(input: {
  spec: RetraceSpec;
  bars: readonly RetraceBar[];
}): number | null {
  const window = input.bars.slice(-input.spec.lookback);
  if (window.length < input.spec.lookback) {
    return null;
  }
  if (input.spec.from === "high") {
    const high = Math.max(...window.map((bar) => bar.high));
    if (!(high > 0)) {
      return null;
    }
    return high * (1 - input.spec.pct / 100);
  }
  const low = Math.min(...window.map((bar) => bar.low));
  if (!(low > 0)) {
    return null;
  }
  return low * (1 + input.spec.pct / 100);
}

/** Last is at least `pct` back from the high, or up from the low, of the window. */
export function retraceMet(input: {
  spec: RetraceSpec;
  price: number | null;
  bars: readonly RetraceBar[];
}): boolean {
  const price = input.price;
  if (!(price != null && price > 0)) {
    return false;
  }
  const level = retraceLevelPrice({ spec: input.spec, bars: input.bars });
  if (level == null) {
    return false;
  }
  return input.spec.from === "high" ? price <= level : price >= level;
}

export function retraceClaim(input: {
  source: unknown;
  from: unknown;
  timeframe: unknown;
}): ConflictClaim | null {
  const source = parseRetraceSource(input.source);
  const from = parseRetraceFrom(input.from);
  const timeframe = parseDcaIndicatorTimeframe(input.timeframe);
  if (!source || !from || !timeframe) {
    return null;
  }
  return {
    key: `retrace|${source}|${from}|${timeframe}`,
    pred: { type: "exclusive" },
  };
}

export function formatRetraceLabel(spec: RetraceSpec): string {
  const source =
    spec.source === "mark" ? "Mark" : spec.source === "index" ? "Index" : "Last";
  const from = spec.from === "low" ? "low" : "high";
  return `${source} retraced ${spec.pct}% from the ${from} of ${spec.lookback}`;
}
