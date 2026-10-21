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
/** Candle-window From. Entry, exit, and DCA start retrace. */
export type WindowRetraceFrom = "high" | "low";
/** Additional-order From. High and low are the position lifetime, not a candle window. */
export type PositionRetraceFrom = "high" | "low" | "initial" | "average";
export type RetraceFrom = PositionRetraceFrom;

export type RetraceSpec = {
  source: RetraceSource;
  from: WindowRetraceFrom;
  pct: number;
  lookback: number;
  timeframe: DcaIndicatorTimeframe;
};

/** Additional-order retrace. Lookback and timeframe are not part of the test. */
export type PositionRetraceSpec = {
  source: RetraceSource;
  from: PositionRetraceFrom;
  pct: number;
};

const RETRACE_SOURCES: readonly RetraceSource[] = ["last", "mark", "index"];

/**
 * Running high and low since the first fill, plus the arm for each From.
 * High and low re-arm only after a new extreme. Initial entry fires once.
 */
export type PositionRetraceMemory = {
  /** Position id in the engine, or the open time in replay. */
  positionKey: string;
  initial: number;
  initialFired: boolean;
  high: Record<RetraceSource, number>;
  low: Record<RetraceSource, number>;
  highAnchor: Record<RetraceSource, number | null>;
  lowAnchor: Record<RetraceSource, number | null>;
};

export type PositionRetraceContext = {
  /** Live average entry. Initial entry stays on the memory. */
  average: number;
  memory: PositionRetraceMemory;
};

export type RetraceBar = { high: number; low: number; close: number };

export function defaultRetraceFrom(side: FuturesSide): WindowRetraceFrom {
  return side === "short" ? "low" : "high";
}

export function parseRetraceSource(value: unknown): RetraceSource | null {
  const raw = String(value ?? "").trim();
  if (raw === "last" || raw === "mark" || raw === "index") {
    return raw;
  }
  return null;
}

export function parseRetraceFrom(value: unknown): WindowRetraceFrom | null {
  const raw = String(value ?? "").trim();
  if (raw === "high" || raw === "low") {
    return raw;
  }
  return null;
}

export function parsePositionRetraceFrom(value: unknown): PositionRetraceFrom | null {
  const raw = String(value ?? "").trim();
  if (raw === "high" || raw === "low" || raw === "initial" || raw === "average") {
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

/** Additional-order retrace. Stored lookback and timeframe are ignored. */
export function parsePositionRetraceSpec(raw: unknown): PositionRetraceSpec | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const source = parseRetraceSource(row.source);
  const from = parsePositionRetraceFrom(row.from);
  const pct = parseRetracePct(row.pct);
  if (!source || !from || pct == null) {
    return null;
  }
  return { source, from, pct };
}

export function windowRetraceSpec(leaf: {
  source: RetraceSource;
  from: RetraceFrom;
  pct: number;
  lookback?: number | null;
  timeframe?: DcaIndicatorTimeframe | null;
}): RetraceSpec | null {
  if (leaf.from !== "high" && leaf.from !== "low") {
    return null;
  }
  if (leaf.lookback == null || leaf.timeframe == null) {
    return null;
  }
  return {
    source: leaf.source,
    from: leaf.from,
    pct: leaf.pct,
    lookback: leaf.lookback,
    timeframe: leaf.timeframe,
  };
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
  timeframe?: unknown;
  /** Additional orders claim one From per price source, with no timeframe. */
  position?: boolean;
}): ConflictClaim | null {
  const source = parseRetraceSource(input.source);
  const from = parsePositionRetraceFrom(input.from);
  if (!source || !from) {
    return null;
  }
  if (input.position || from === "initial" || from === "average") {
    return {
      key: `retrace|${source}|${from}|position`,
      pred: { type: "exclusive" },
    };
  }
  const timeframe = parseDcaIndicatorTimeframe(input.timeframe);
  if (!timeframe) {
    return {
      key: `retrace|${source}|${from}|position`,
      pred: { type: "exclusive" },
    };
  }
  return {
    key: `retrace|${source}|${from}|${timeframe}`,
    pred: { type: "exclusive" },
  };
}

export function retraceFromLabel(from: RetraceFrom | null | undefined): string {
  if (from === "low") {
    return "Low";
  }
  if (from === "initial") {
    return "Initial Entry Price";
  }
  if (from === "average") {
    return "Average Entry Price";
  }
  if (from === "high") {
    return "High";
  }
  return "—";
}

export function formatRetraceLabel(spec: {
  source: RetraceSource;
  from: RetraceFrom;
  pct: number;
  lookback?: number | null;
  timeframe?: string | null;
}): string {
  const source =
    spec.source === "mark" ? "Mark" : spec.source === "index" ? "Index" : "Last";
  const position =
    spec.lookback == null ||
    spec.timeframe == null ||
    spec.from === "initial" ||
    spec.from === "average";
  if (position) {
    const from =
      spec.from === "low"
        ? "the low since entry"
        : spec.from === "initial"
          ? "the initial entry price"
          : spec.from === "average"
            ? "the average entry price"
            : "the high since entry";
    return `${source} retraced ${spec.pct}% from ${from}`;
  }
  const from = spec.from === "low" ? "low" : "high";
  return `${source} retraced ${spec.pct}% from the ${from} of ${spec.lookback}`;
}

function priceTol(value: number): number {
  return Math.max(Math.abs(value) * 1e-9, 1e-8);
}

function atOrBelow(price: number, level: number): boolean {
  return price <= level + priceTol(level);
}

function atOrAbove(price: number, level: number): boolean {
  return price >= level - priceTol(level);
}

function strictlyAbove(value: number, anchor: number): boolean {
  return value > anchor + priceTol(anchor);
}

function strictlyBelow(value: number, anchor: number): boolean {
  return value < anchor - priceTol(anchor);
}

function blankExtreme(initial: number): Record<RetraceSource, number> {
  return { last: initial, mark: initial, index: initial };
}

function blankAnchors(): Record<RetraceSource, number | null> {
  return { last: null, mark: null, index: null };
}

export function emptyPositionRetraceMemory(
  initial: number,
  positionKey: string,
): PositionRetraceMemory {
  return {
    positionKey,
    initial,
    initialFired: false,
    high: blankExtreme(initial),
    low: blankExtreme(initial),
    highAnchor: blankAnchors(),
    lowAnchor: blankAnchors(),
  };
}

function readExtreme(
  raw: unknown,
  fallback: number,
): Record<RetraceSource, number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const next = blankExtreme(fallback);
  for (const source of RETRACE_SOURCES) {
    const value = Number(row[source]);
    if (value > 0) {
      next[source] = value;
    } else if (row[source] != null) {
      return null;
    }
  }
  return next;
}

function readAnchors(raw: unknown): Record<RetraceSource, number | null> {
  const next = blankAnchors();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return next;
  }
  const row = raw as Record<string, unknown>;
  for (const source of RETRACE_SOURCES) {
    if (row[source] == null || row[source] === "") {
      next[source] = null;
      continue;
    }
    const value = Number(row[source]);
    next[source] = value > 0 ? value : null;
  }
  return next;
}

export function positionRetraceFromJson(raw: unknown): PositionRetraceMemory | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const initial = Number(row.initial);
  const positionKey = String(row.positionKey ?? "").trim();
  if (!(initial > 0) || !positionKey) {
    return null;
  }
  const high = readExtreme(row.high, initial);
  const low = readExtreme(row.low, initial);
  if (!high || !low) {
    return null;
  }
  return {
    positionKey,
    initial,
    initialFired: row.initialFired === true,
    high,
    low,
    highAnchor: readAnchors(row.highAnchor),
    lowAnchor: readAnchors(row.lowAnchor),
  };
}

export function positionRetraceToJson(
  memory: PositionRetraceMemory,
): PositionRetraceMemory {
  return {
    positionKey: memory.positionKey,
    initial: memory.initial,
    initialFired: memory.initialFired === true,
    high: { ...memory.high },
    low: { ...memory.low },
    highAnchor: { ...memory.highAnchor },
    lowAnchor: { ...memory.lowAnchor },
  };
}

function foldHigh(current: number, extra: Array<number | null | undefined>): number {
  let high = current > 0 ? current : 0;
  for (const value of extra) {
    if (value != null && value > 0 && value > high) {
      high = value;
    }
  }
  return high > 0 ? high : current;
}

function foldLow(current: number, extra: Array<number | null | undefined>): number {
  let low = current > 0 ? current : Number.POSITIVE_INFINITY;
  for (const value of extra) {
    if (value != null && value > 0 && value < low) {
      low = value;
    }
  }
  return Number.isFinite(low) ? low : current;
}

/**
 * Fold this check's quotes into the running high and low.
 * Pass a wick for last (and for every source in replay, which has one tape).
 * The extreme updates before the retrace test, so a wick and a close on the
 * same bar can arm and fire together.
 */
export function advancePositionRetrace(
  memory: PositionRetraceMemory,
  quotes: Partial<Record<RetraceSource, number | null>>,
  wick?: { high: number | null; low: number | null } | null,
  wickSources: readonly RetraceSource[] = ["last"],
): PositionRetraceMemory {
  const high = { ...memory.high };
  const low = { ...memory.low };
  for (const source of RETRACE_SOURCES) {
    const useWick = wickSources.includes(source);
    high[source] = foldHigh(high[source], [
      quotes[source],
      useWick ? wick?.high : null,
    ]);
    low[source] = foldLow(low[source], [
      quotes[source],
      useWick ? wick?.low : null,
    ]);
  }
  return { ...memory, high, low };
}

/** Keep the saved run when it belongs to this position. Otherwise start at the first fill. */
export function resumePositionRetrace(input: {
  stored: PositionRetraceMemory | null;
  positionKey: string;
  initial: number;
  quotes: Partial<Record<RetraceSource, number | null>>;
  wick?: { high: number | null; low: number | null } | null;
  wickSources?: readonly RetraceSource[];
}): PositionRetraceMemory | null {
  if (!(input.initial > 0) || !input.positionKey) {
    return null;
  }
  const base =
    input.stored && input.stored.positionKey === input.positionKey
      ? input.stored
      : emptyPositionRetraceMemory(input.initial, input.positionKey);
  return advancePositionRetrace(
    base,
    input.quotes,
    input.wick,
    input.wickSources,
  );
}

/**
 * Additional-order retrace against the position, not a candle window.
 * High is a percent down from the high since entry, and it stays false until
 * a later high beats the high in force when the add fired. Low is the mirror.
 * Initial entry fires once. Average is a percent away from the live average.
 */
export function positionRetraceMet(input: {
  spec: PositionRetraceSpec;
  side: FuturesSide;
  price: number | null;
  average: number | null;
  memory: PositionRetraceMemory;
}): boolean {
  const price = input.price;
  if (!(price != null && price > 0)) {
    return false;
  }
  const { spec, memory } = input;
  if (spec.from === "high") {
    const high = memory.high[spec.source];
    const anchor = memory.highAnchor[spec.source];
    if (!(high > 0)) {
      return false;
    }
    if (anchor != null && !strictlyAbove(high, anchor)) {
      return false;
    }
    return atOrBelow(price, high * (1 - spec.pct / 100));
  }
  if (spec.from === "low") {
    const low = memory.low[spec.source];
    const anchor = memory.lowAnchor[spec.source];
    if (!(low > 0)) {
      return false;
    }
    if (anchor != null && !strictlyBelow(low, anchor)) {
      return false;
    }
    return atOrAbove(price, low * (1 + spec.pct / 100));
  }
  const reference = spec.from === "initial" ? memory.initial : input.average;
  if (spec.from === "initial" && memory.initialFired) {
    return false;
  }
  if (!(reference != null && reference > 0)) {
    return false;
  }
  if (input.side === "short") {
    return atOrAbove(price, reference * (1 + spec.pct / 100));
  }
  return atOrBelow(price, reference * (1 - spec.pct / 100));
}

/** High, low, and initial entry are false again as soon as the order arms them. */
export function positionRetraceConsumed(
  leaves: readonly { kind: string; from?: string | null }[],
): boolean {
  return leaves.some(
    (leaf) =>
      leaf.kind === "retrace" &&
      (leaf.from === "high" || leaf.from === "low" || leaf.from === "initial"),
  );
}

/** Arm the retrace leaves in the group that just placed. A blocked group does not arm. */
export function commitPositionRetraceFire(
  memory: PositionRetraceMemory,
  leaves: readonly { kind: string; source?: RetraceSource; from?: RetraceFrom }[],
): PositionRetraceMemory {
  const next: PositionRetraceMemory = {
    ...memory,
    highAnchor: { ...memory.highAnchor },
    lowAnchor: { ...memory.lowAnchor },
  };
  for (const leaf of leaves) {
    if (leaf.kind !== "retrace" || !leaf.from || !leaf.source) {
      continue;
    }
    if (leaf.from === "initial") {
      next.initialFired = true;
    } else if (leaf.from === "high") {
      next.highAnchor[leaf.source] = next.high[leaf.source];
    } else if (leaf.from === "low") {
      next.lowAnchor[leaf.source] = next.low[leaf.source];
    }
  }
  return next;
}
