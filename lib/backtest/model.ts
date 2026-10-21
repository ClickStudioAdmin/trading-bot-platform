import {
  annualizeReturnPct,
  inclusiveUtcDays,
} from "@/lib/futures/stats";
import {
  formatPct,
  formatSignedUsd,
  signedTone,
} from "@/lib/opportunities/format";
import {
  DCA_INDICATOR_TIMEFRAMES,
  finerDcaIndicatorTimeframe,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import {
  recipesMatchReplayFields,
  type DcaTemplateRecipe,
  type PerpsTemplateRecipe,
} from "@/lib/templates/recipe";
import { parseDeskFuturesSymbol } from "@/lib/venues/hyperliquid/symbol";
import { strategyLeafTimeframe } from "@/lib/strategy/expr";
import type { ExitBookSnapshot } from "@/lib/strategy/exit-actions";
import type { BacktestProgressPhase } from "./progress";

export type BacktestRecipe = PerpsTemplateRecipe | DcaTemplateRecipe;
export type BacktestDeskType = "flex" | "dca";

export const BACKTEST_FEE_PRESETS = {
  vip0_taker: {
    id: "vip0_taker",
    label: "VIP0 taker (6 bps all-in)",
    rate: 0.0006,
  },
} as const;

export const BACKTEST_CANDLE_LIMIT = 2_500_000;
export const BACKTEST_LONG_TAPE_BARS = 20_000;
export const BACKTEST_INLINE_BAR_LIMIT = 3000;
export const BACKTEST_VERCEL_BAR_LIMIT = 3000;
export const BACKTEST_COMPARABLE_CAP = 8;
export const DEFAULT_STARTING_USDT = 10_000;
export const DEFAULT_LEVERAGE = 10;
export const DEFAULT_BACKTEST_WINDOW_DAYS = 365;
export const BACKTEST_WINDOW_PRESETS = [
  { days: 30, label: "1 month" },
  { days: 365, label: "1 year" },
  { days: 1825, label: "5 years" },
  { days: 3650, label: "10 years" },
] as const;
export const MAX_BACKTEST_LEVERAGE = 125;

export type BacktestFeePreset = keyof typeof BACKTEST_FEE_PRESETS;
export type BacktestStatus =
  | "draft"
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "cancelled";
export const BACKTEST_FILL_REASONS = [
  "entry",
  "clip",
  "take_profit",
  "stop",
  "exit_if",
  "trailing",
  "close",
  "liquidation",
] as const;
export type BacktestFillReason = (typeof BACKTEST_FILL_REASONS)[number];

export type ReplayEventKind = "fill" | "skipped";

export type ReplayFact = { role: string; detail: string };

export type ReplayEvent = {
  atMs: number;
  kind: ReplayEventKind;
  reason: BacktestFillReason;
  orderIndex: number | null;
  side: "long" | "short";
  clipIndex?: number;
  text: string;
  facts?: ReplayFact[];
  /** Exit decision tree at this fill. Absent on rows saved before the book existed. */
  exitBook?: ExitBookSnapshot;
};

export type SimulatedOrder = {
  atMs: number;
  action: "buy" | "sell" | "flatten";
  side: "long" | "short";
  qty: number;
  price: number;
  feeUsdt: number;
  realizedUsdt: number | null;
  reason?: BacktestFillReason;
  clipIndex?: number;
  /** Entry of the fill this exit closed. Set on a per-lot order. */
  basisPrice?: number;
};

export function parseBacktestFillReason(
  value: unknown,
): BacktestFillReason | undefined {
  return (BACKTEST_FILL_REASONS as readonly string[]).includes(String(value))
    ? (value as BacktestFillReason)
    : undefined;
}

export function parseBacktestClipIndex(value: unknown): number | undefined {
  const clipIndex = Number(value);
  return Number.isInteger(clipIndex) && clipIndex > 0 ? clipIndex : undefined;
}

export type BacktestStats = {
  trades: number;
  wins: number;
  winRate: number;
  realizedUsdt: number;
  maxDrawdownUsdt: number;
  profitFactor: number | null;
  timeInMarket: number;
  openQty: number;
  openSide: "long" | "short" | null;
  markUsdt: number;
  lastPrice?: number | null;
  startingUsdt: number;
  endingUsdt: number;
  returnPct: number | null;
};

export type BacktestRun = {
  id: string;
  userId: string | null;
  templateId: string | null;
  sourceTemplateId: string | null;
  studyId: string | null;
  deskType: BacktestDeskType;
  venue: string;
  venueEnvironment: string | null;
  symbol: string;
  interval: DcaIndicatorTimeframe;
  fromMs: number;
  toMs: number;
  startingUsdt: number;
  leverage: number;
  feePreset: BacktestFeePreset;
  feeRate: number;
  status: BacktestStatus;
  recipe: BacktestRecipe;
  stats: BacktestStats | null;
  orders: SimulatedOrder[];
  replayEvents: ReplayEvent[] | null;
  error: string | null;
  createdAtMs: number;
  finishedAtMs: number | null;
  parentRunId: string | null;
  comparableSymbols: string[];
  /** Run title. Null on rows saved before the backtest name existed. */
  name: string | null;
  /** Candles loaded for a running replay. Null once the row is idle. */
  progressDone: number | null;
  progressTotal: number | null;
  progressPhase: BacktestProgressPhase | null;
  /** Times work has started on this row, including interrupted passes. */
  claimCount: number;
  /** Queued rows stay unclaimed until this instant. Null when ready. */
  retryAfterMs: number | null;
};

export type EquityPoint = {
  atMs: number;
  equityUsdt: number;
  realizedUsdt: number;
  label: string;
};

export function parseFeePreset(raw: unknown): BacktestFeePreset {
  return raw === "vip0_taker" ? "vip0_taker" : "vip0_taker";
}

export function parseBacktestStatus(raw: unknown): BacktestStatus | null {
  const value = String(raw ?? "").trim();
  if (
    value === "draft" ||
    value === "queued" ||
    value === "running" ||
    value === "done" ||
    value === "failed" ||
    value === "cancelled"
  ) {
    return value;
  }
  return null;
}

export function isoDateUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export const BACKTEST_NAME_MAX = 80;

/** Stored run title. Empty and missing values stay unset so older rows keep the recipe fallback. */
export function readBacktestName(raw: unknown): string | null {
  if (raw == null) {
    return null;
  }
  const name = String(raw).trim().replace(/\s+/g, " ");
  if (!name) {
    return null;
  }
  return name.slice(0, BACKTEST_NAME_MAX);
}

export function parseBacktestName(
  raw: unknown,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 1) {
    return { ok: false, error: "Enter a backtest name." };
  }
  if (name.length > BACKTEST_NAME_MAX) {
    return { ok: false, error: "Name must be 80 characters or fewer." };
  }
  return { ok: true, name };
}

/** Stored title for a comparable child. Uses the backtest name; the contract stays on the run. */
export function comparableBacktestName(name: string): string {
  const base = name.trim() || "Backtest";
  return base.slice(0, 80);
}

export function backtestRunTitle(run: {
  name?: string | null;
  recipe: { name: string };
  symbol: string;
  parentRunId: string | null;
}): string {
  const stored = readBacktestName(run.name);
  if (stored) {
    return stored;
  }
  return comparableBacktestName(run.recipe.name);
}

function backtestSymbolKey(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export type BacktestVariantFieldSnapshot = {
  name: string;
  fromDate: string;
  toDate: string;
  startingBalance: string;
  leverage: string;
  venue: string;
  venueEnvironment: string | null;
  symbol: string;
};

/** True after a Modify field differs from the opened run. The first form publish is the baseline, not an edit. */
export function backtestVariantEdited(input: {
  origin: BacktestVariantFieldSnapshot;
  current: BacktestVariantFieldSnapshot;
  baselineRecipe: BacktestRecipe | null;
  recipe: BacktestRecipe | null;
}): boolean {
  const { origin, current } = input;
  if (
    current.name.trim() !== origin.name.trim() ||
    current.fromDate !== origin.fromDate ||
    current.toDate !== origin.toDate ||
    current.startingBalance !== origin.startingBalance ||
    current.leverage !== origin.leverage ||
    current.venue !== origin.venue ||
    (current.venueEnvironment ?? "") !== (origin.venueEnvironment ?? "") ||
    backtestSymbolKey(current.symbol) !== backtestSymbolKey(origin.symbol)
  ) {
    return true;
  }
  const baseline = input.baselineRecipe;
  const recipe = input.recipe;
  if (!baseline || !recipe) {
    return false;
  }
  return (
    baseline.name !== recipe.name || !recipesMatchReplayFields(baseline, recipe)
  );
}

/** Same bot and market window on another contract. A parameter or window change is a variation. */
export function isBacktestComparableChild(
  primary: BacktestRun,
  child: BacktestRun,
): boolean {
  if (!child.parentRunId || child.parentRunId !== primary.id) {
    return false;
  }
  const pair = backtestSymbolKey(child.symbol);
  if (!pair || pair === backtestSymbolKey(primary.symbol)) {
    return false;
  }
  if (
    child.fromMs !== primary.fromMs ||
    child.toMs !== primary.toMs ||
    child.startingUsdt !== primary.startingUsdt ||
    child.leverage !== primary.leverage ||
    child.venue !== primary.venue ||
    child.interval !== primary.interval ||
    child.feePreset !== primary.feePreset
  ) {
    return false;
  }
  return recipesMatchReplayFields(
    { ...primary.recipe, symbol: "" },
    { ...child.recipe, symbol: "" },
  );
}

/** Drop a detached comparable's contract from the parent's list. A variation leaves that list unchanged. */
export function comparableSymbolsAfterDetach(
  parent: BacktestRun,
  child: BacktestRun,
): string[] {
  const symbols = parent.comparableSymbols ?? [];
  if (!isBacktestComparableChild(parent, child)) {
    return [...symbols];
  }
  const key = backtestSymbolKey(child.symbol);
  return symbols.filter((item) => backtestSymbolKey(item) !== key);
}

export function splitBacktestFamily(
  primary: BacktestRun,
  children: readonly BacktestRun[],
): { comparables: BacktestRun[]; variations: BacktestRun[] } {
  const comparables: BacktestRun[] = [];
  const variations: BacktestRun[] = [];
  for (const child of children) {
    if (child.id === primary.id) {
      continue;
    }
    if (isBacktestComparableChild(primary, child)) {
      comparables.push(child);
    } else {
      variations.push(child);
    }
  }
  return { comparables, variations };
}

export type SavedBacktestChildRole = "comparable" | "variation";

export type SavedBacktestFamily = {
  head: BacktestRun;
  children: Array<{ run: BacktestRun; role: SavedBacktestChildRole }>;
};

function savedBacktestRoot(
  row: BacktestRun,
  byId: ReadonlyMap<string, BacktestRun>,
): BacktestRun {
  let current = row;
  const seen = new Set<string>();
  while (current.parentRunId && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.parentRunId);
    if (!parent) {
      break;
    }
    current = parent;
  }
  return current;
}

function savedBacktestChildRole(
  primary: BacktestRun,
  child: BacktestRun,
): SavedBacktestChildRole {
  const linked =
    child.parentRunId === primary.id
      ? child
      : { ...child, parentRunId: primary.id };
  return isBacktestComparableChild(primary, linked) ? "comparable" : "variation";
}

function compareSavedBacktestChildren(
  left: { run: BacktestRun; role: SavedBacktestChildRole },
  right: { run: BacktestRun; role: SavedBacktestChildRole },
): number {
  if (left.role !== right.role) {
    return left.role === "comparable" ? -1 : 1;
  }
  return (
    left.run.createdAtMs - right.run.createdAtMs ||
    left.run.id.localeCompare(right.run.id)
  );
}

/** Count badge for a parent. Hover text lists comparables, then variations. */
export function savedBacktestChildBadge(
  children: readonly { role: SavedBacktestChildRole }[],
): { total: number; label: string } | null {
  let comparables = 0;
  let variations = 0;
  for (const child of children) {
    if (child.role === "comparable") {
      comparables += 1;
    } else {
      variations += 1;
    }
  }
  const parts: string[] = [];
  if (comparables > 0) {
    parts.push(
      comparables === 1 ? "1 comparable" : `${comparables} comparables`,
    );
  }
  if (variations > 0) {
    parts.push(variations === 1 ? "1 variation" : `${variations} variations`);
  }
  if (parts.length === 0) {
    return null;
  }
  return { total: comparables + variations, label: parts.join(", ") };
}

/** Parents first. Comparables and variations sit under the loaded root, oldest first. A child whose parent is not in the set stays its own row. */
export function savedBacktestFamilies(
  runs: readonly BacktestRun[],
): SavedBacktestFamily[] {
  const byId = new Map(runs.map((row) => [row.id, row]));
  const grouped = new Map<string, BacktestRun[]>();
  const heads: BacktestRun[] = [];
  const seenHeads = new Set<string>();
  for (const row of runs) {
    const root = savedBacktestRoot(row, byId);
    if (root.id === row.id) {
      if (!seenHeads.has(row.id)) {
        seenHeads.add(row.id);
        heads.push(row);
      }
      continue;
    }
    const list = grouped.get(root.id) ?? [];
    list.push(row);
    grouped.set(root.id, list);
  }
  return heads.map((head) => ({
    head,
    children: (grouped.get(head.id) ?? [])
      .map((run) => ({ run, role: savedBacktestChildRole(head, run) }))
      .sort(compareSavedBacktestChildren),
  }));
}

/** Keep a parent when it matches, or when a child does. Children that miss the filter stay off the list. */
export function filterSavedBacktestFamilies(
  families: readonly SavedBacktestFamily[],
  matches: (run: BacktestRun) => boolean,
): SavedBacktestFamily[] {
  const visible: SavedBacktestFamily[] = [];
  for (const family of families) {
    const children = family.children.filter((child) => matches(child.run));
    if (!matches(family.head) && children.length === 0) {
      continue;
    }
    visible.push({ head: family.head, children });
  }
  return visible;
}

export type SavedBacktestListRow = {
  run: BacktestRun;
  role: SavedBacktestChildRole | null;
};

/** One pager row per parent and each visible child. Collapsed parents omit their children. */
export function savedBacktestListRows(
  families: readonly SavedBacktestFamily[],
  collapsedParentIds?: ReadonlySet<string>,
): SavedBacktestListRow[] {
  const collapsed = collapsedParentIds ?? new Set<string>();
  const rows: SavedBacktestListRow[] = [];
  for (const family of families) {
    rows.push({ run: family.head, role: null });
    if (family.children.length === 0 || collapsed.has(family.head.id)) {
      continue;
    }
    for (const child of family.children) {
      rows.push({ run: child.run, role: child.role });
    }
  }
  return rows;
}

export function backtestRerunHref(runId: string): string {
  return backtestNewHref({ rerun: runId }, "replay");
}

/** Replay page. `play` starts playback once candles are ready. */
export function backtestReplayHref(runId: string, play = false): string {
  const path = `/account/backtests/${runId}/replay`;
  return play ? `${path}?play=1` : path;
}

export function replayRequestsPlayback(search: string): boolean {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(query).get("play") === "1";
}

/** Same search string with the one-shot playback flag removed. */
export function replaySearchWithoutPlayback(search: string): string {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  params.delete("play");
  const next = params.toString();
  return next ? `?${next}` : "";
}

const REPLAY_PLAYBACK_CONSUMED_KEY = "tbp-replay-playback";

/** Run id when this replay URL asked to start playback. */
export function replayPlaybackRunId(pathname: string, search: string): string | null {
  if (!replayRequestsPlayback(search)) {
    return null;
  }
  const match = pathname.match(/\/account\/backtests\/([^/]+)\/replay\/?$/);
  const runId = match?.[1] ? decodeURIComponent(match[1]) : "";
  return runId || null;
}

export function replayPlaybackConsumed(
  storage: Pick<Storage, "getItem">,
  runId: string,
): boolean {
  return storage.getItem(REPLAY_PLAYBACK_CONSUMED_KEY) === runId;
}

export function markReplayPlaybackConsumed(
  storage: Pick<Storage, "setItem">,
  runId: string,
): void {
  storage.setItem(REPLAY_PLAYBACK_CONSUMED_KEY, runId);
}

type ReplayPlayCursor = { key: string; head: number; playing: boolean };
type ReplayPlayFlag = { key: string; started: boolean };

/** One render of replay transport. Armed playback starts once candles exist. */
export function replayAutoplayStep(input: {
  armed: boolean;
  candlesReady: boolean;
  candleKey: string;
  startHead: number;
  cursor: ReplayPlayCursor;
  playback: ReplayPlayFlag;
}): {
  cursor: ReplayPlayCursor | null;
  playback: ReplayPlayFlag | null;
  disarm: boolean;
  head: number;
  playing: boolean;
  started: boolean;
} {
  const autoplay = input.armed && input.candlesReady;
  if (autoplay) {
    const playingNow =
      input.cursor.key === input.candleKey &&
      input.cursor.head === 0 &&
      input.cursor.playing &&
      input.playback.key === input.candleKey &&
      input.playback.started;
    return {
      cursor: playingNow
        ? null
        : { key: input.candleKey, head: 0, playing: true },
      playback: playingNow ? null : { key: input.candleKey, started: true },
      disarm: playingNow,
      head: 0,
      playing: true,
      started: true,
    };
  }
  const cursorMatches = input.cursor.key === input.candleKey;
  const playbackMatches = input.playback.key === input.candleKey;
  return {
    cursor: cursorMatches
      ? null
      : { key: input.candleKey, head: input.startHead, playing: false },
    playback: playbackMatches ? null : { key: input.candleKey, started: false },
    disarm: false,
    head: cursorMatches ? input.cursor.head : input.startHead,
    playing: cursorMatches ? input.cursor.playing : false,
    started: playbackMatches ? input.playback.started : false,
  };
}

export const BACKTEST_SAVED_PAGE_SIZE = 20;

export function parseBacktestListPage(raw: unknown): number {
  const page = Math.trunc(Number(String(raw ?? "").trim()));
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function backtestSavedListHref(page = 1): string {
  if (page <= 1) {
    return "/account/backtests";
  }
  return `/account/backtests?page=${page}`;
}

function backtestSearchParam(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value ?? "").trim();
}

/** Create-page URL. Empty query values are omitted. */
export function backtestNewHref(
  query: Record<string, string | null | undefined> = {},
  hash?: string,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const text = String(value ?? "").trim();
    if (text) {
      params.set(key, text);
    }
  }
  const search = params.toString();
  const path = search
    ? `/account/backtests/new?${search}`
    : "/account/backtests/new";
  const fragment = String(hash ?? "").replace(/^#/, "").trim();
  return fragment ? `${path}#${fragment}` : path;
}

/**
 * Old list URLs that still mean the create page or the saved tab.
 * Returns null when the request should stay on the run list.
 */
export function backtestListEntryHref(
  params: Record<string, string | string[] | undefined> | null | undefined,
): string | null {
  const template = backtestSearchParam(params?.template);
  const draft = backtestSearchParam(params?.draft);
  const rerun = backtestSearchParam(params?.rerun);
  const venue = backtestSearchParam(params?.venue);
  const env = backtestSearchParam(params?.env);
  const bot = backtestSearchParam(params?.bot);
  const tab = backtestSearchParam(params?.tab);
  if (template || draft || rerun || bot || tab === "new") {
    return backtestNewHref(
      { template, draft, rerun, venue, env, bot },
      rerun ? "replay" : undefined,
    );
  }
  if (tab === "saved") {
    return backtestSavedListHref(parseBacktestListPage(params?.page));
  }
  return null;
}

export function paginateBacktestList<T>(
  rows: readonly T[],
  page: number,
  pageSize = BACKTEST_SAVED_PAGE_SIZE,
): {
  rows: T[];
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
} {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);
  return {
    rows: slice,
    page: safePage,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
  };
}

export function canDeleteBacktestRun(
  run: Pick<BacktestRun, "userId">,
  userId: string,
  isAdmin: boolean,
): boolean {
  if (isAdmin) {
    return true;
  }
  return run.userId === userId;
}

export const BACKTEST_BULK_DELETE_MAX = 100;

export function parseBacktestRunIds(raw: unknown): string[] {
  const values = Array.isArray(raw)
    ? raw
    : raw instanceof FormData
      ? raw.getAll("runId")
      : [raw];
  const ids: string[] = [];
  for (const value of values) {
    const id = String(value ?? "").trim();
    if (!id || ids.includes(id)) {
      continue;
    }
    ids.push(id);
    if (ids.length >= BACKTEST_BULK_DELETE_MAX) {
      break;
    }
  }
  return ids;
}

export function backtestQueueSeedFromRun(run: BacktestRun): {
  recipe: BacktestRecipe;
  name: string;
  sourceTemplateId: string;
  fromDate: string;
  toDate: string;
  startingUsdt: number;
  leverage: number;
  interval: DcaIndicatorTimeframe;
  symbol: string;
  venue: string;
  venueEnvironment: string | null;
  comparables: string[];
} {
  return {
    recipe: run.recipe,
    name: backtestRunTitle(run),
    sourceTemplateId: run.sourceTemplateId ?? "",
    fromDate: isoDateUtc(run.fromMs),
    toDate: isoDateUtc(run.toMs),
    startingUsdt: run.startingUsdt,
    leverage: normalizeBacktestLeverage(run.leverage),
    interval: run.interval,
    symbol: run.symbol,
    venue: run.venue,
    venueEnvironment: run.venueEnvironment,
    comparables: [...(run.comparableSymbols ?? [])],
  };
}

export function backtestWindowEndingToday(days: number): {
  from: string;
  to: string;
} {
  const toMs = Date.now();
  const spanDays = Math.max(1, Math.floor(days));
  // The end date is included. Subtracting the full count would count that
  // day twice and turn a 365-day year into 366.
  const fromMs = toMs - (spanDays - 1) * 24 * 60 * 60 * 1000;
  return { from: isoDateUtc(fromMs), to: isoDateUtc(toMs) };
}

export function defaultBacktestDates(): { from: string; to: string } {
  return backtestWindowEndingToday(DEFAULT_BACKTEST_WINDOW_DAYS);
}

export function matchingBacktestWindowDays(
  from: string,
  to: string,
): number | null {
  for (const row of BACKTEST_WINDOW_PRESETS) {
    const window = backtestWindowEndingToday(row.days);
    if (window.from === from && window.to === to) {
      return row.days;
    }
  }
  return null;
}

export function parseStartingBalance(
  raw: unknown,
): { ok: true; startingUsdt: number } | { ok: false; error: string } {
  const value = Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!(value > 0) || !Number.isFinite(value)) {
    return { ok: false, error: "Enter an initial account balance greater than 0." };
  }
  if (value > 10_000_000) {
    return { ok: false, error: "Initial balance must be 10,000,000 or less." };
  }
  return { ok: true, startingUsdt: value };
}

export function normalizeBacktestLeverage(raw: unknown): number {
  const value = Number(raw);
  if (value > 0 && Number.isFinite(value)) {
    return value;
  }
  return 1;
}

export function parseBacktestLeverage(
  raw: unknown,
): { ok: true; leverage: number } | { ok: false; error: string } {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (!text) {
    return { ok: true, leverage: 1 };
  }
  const value = Number(text);
  if (!(value > 0) || !Number.isFinite(value)) {
    return { ok: false, error: "Enter leverage greater than 0." };
  }
  if (value > MAX_BACKTEST_LEVERAGE) {
    return {
      ok: false,
      error: `Leverage must be ${MAX_BACKTEST_LEVERAGE} or less.`,
    };
  }
  return { ok: true, leverage: value };
}

export function backtestMarginUsdt(
  notionalUsdt: number,
  leverage: number,
): number {
  return notionalUsdt / normalizeBacktestLeverage(leverage);
}

function utcDayStart(raw: unknown): number | null {
  const text = String(raw ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  if (!Number.isFinite(ms)) {
    return null;
  }
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

export function intervalMs(interval: DcaIndicatorTimeframe): number {
  if (interval === "5") {
    return 5 * 60 * 1000;
  }
  if (interval === "15") {
    return 15 * 60 * 1000;
  }
  if (interval === "30") {
    return 30 * 60 * 1000;
  }
  if (interval === "60") {
    return 60 * 60 * 1000;
  }
  if (interval === "120") {
    return 120 * 60 * 1000;
  }
  if (interval === "240") {
    return 240 * 60 * 1000;
  }
  if (interval === "360") {
    return 360 * 60 * 1000;
  }
  if (interval === "720") {
    return 720 * 60 * 1000;
  }
  return 24 * 60 * 60 * 1000;
}

export function estimateBacktestBars(
  fromMs: number,
  toMs: number,
  interval: DcaIndicatorTimeframe,
): number {
  if (!(toMs > fromMs)) {
    return 0;
  }
  return Math.ceil((toMs - fromMs) / intervalMs(interval));
}

export function backtestTapeInterval(
  recipe: BacktestRecipe | null,
  fromMs: number,
  toMs: number,
): DcaIndicatorTimeframe {
  if (recipe?.kind === "flex") {
    const indicatorStart =
      recipe.entrySource === "indicator" || recipe.entrySource === "trend";
    const shortStart =
      recipe.direction === "both" &&
      (recipe.shortEntry?.entrySource === "indicator" ||
        recipe.shortEntry?.entrySource === "trend");
    const rows = [
      indicatorStart ? recipe.indicator?.timeframe : null,
      ...(recipe.entryStack?.leaves.map((leaf) => strategyLeafTimeframe(leaf)) ??
        []),
      indicatorStart ? recipe.confirm?.timeframe : null,
      shortStart ? recipe.shortEntry?.indicator?.timeframe : null,
      ...(recipe.direction === "both"
        ? (recipe.shortEntry?.entryStack?.leaves.map((leaf) =>
            strategyLeafTimeframe(leaf),
          ) ?? [])
        : []),
      indicatorStart ? recipe.exitIf?.timeframe : null,
    ].filter((row): row is DcaIndicatorTimeframe => Boolean(row));
    if (rows.length === 1) {
      return rows[0];
    }
    if (rows.length > 1) {
      return rows.reduce((finest, next) =>
        finerDcaIndicatorTimeframe(finest, next),
      );
    }
  }
  if (recipe?.kind === "dca") {
    const indicatorStart =
      recipe.startKind === "indicator" || recipe.startKind === "trend";
    const shortKind = recipe.shortStartKind ?? recipe.startKind;
    const shortSeries = shortKind === "indicator" || shortKind === "trend";
    const primary = indicatorStart ? recipe.indicatorTimeframe : null;
    const short = shortSeries ? recipe.shortIndicatorTimeframe : null;
    const stacked = [
      primary,
      short,
      ...(recipe.entryStack?.leaves.map((leaf) => strategyLeafTimeframe(leaf)) ??
        []),
      ...(recipe.shortEntryStack?.leaves.map((leaf) =>
        strategyLeafTimeframe(leaf),
      ) ?? []),
    ].filter((row): row is DcaIndicatorTimeframe => Boolean(row));
    if (stacked.length > 0) {
      return stacked.reduce((finest, next) =>
        finerDcaIndicatorTimeframe(finest, next),
      );
    }
  }
  for (const interval of DCA_INDICATOR_TIMEFRAMES) {
    if (estimateBacktestBars(fromMs, toMs, interval) <= BACKTEST_CANDLE_LIMIT) {
      return interval;
    }
  }
  return "D";
}

export const BACKTEST_CHART_INTERVALS: readonly DcaIndicatorTimeframe[] = [
  "15",
  "60",
  "240",
  "D",
];
export const BACKTEST_CHART_BAR_LIMIT = 1500;

export function chartIntervalForWindow(
  fromMs: number,
  toMs: number,
  preferred: DcaIndicatorTimeframe,
): DcaIndicatorTimeframe {
  const start = Math.max(0, DCA_INDICATOR_TIMEFRAMES.indexOf(preferred));
  for (let i = start; i < DCA_INDICATOR_TIMEFRAMES.length; i += 1) {
    const interval = DCA_INDICATOR_TIMEFRAMES[i];
    if (estimateBacktestBars(fromMs, toMs, interval) <= BACKTEST_CHART_BAR_LIMIT) {
      return interval;
    }
  }
  return "D";
}

export function backtestChartIntervalChoices(
  preferred: DcaIndicatorTimeframe,
): DcaIndicatorTimeframe[] {
  const extra = new Set<DcaIndicatorTimeframe>([
    ...BACKTEST_CHART_INTERVALS,
    preferred,
  ]);
  return DCA_INDICATOR_TIMEFRAMES.filter((row) => extra.has(row));
}

export function backtestChartIntervalFits(
  fromMs: number,
  toMs: number,
  interval: DcaIndicatorTimeframe,
): boolean {
  return estimateBacktestBars(fromMs, toMs, interval) <= BACKTEST_CHART_BAR_LIMIT;
}

/** Report chart and replay. The series is the market window, including the bars after the last fill. */
export function backtestChartFetchBounds(
  run: Pick<BacktestRun, "fromMs" | "toMs">,
): { fromMs: number; toMs: number } {
  return { fromMs: run.fromMs, toMs: run.toMs };
}

/** Play in the middle resumes. Before the chart starts, or on the last candle, it begins at the first candle. */
export function replayPlayRestarts(input: {
  started: boolean;
  head: number;
  candleCount: number;
}): boolean {
  return (
    !input.started ||
    input.candleCount <= 0 ||
    input.head >= input.candleCount - 1
  );
}

export function backtestShouldRunInline(
  bars: number,
  pairCount: number,
): boolean {
  return bars <= BACKTEST_INLINE_BAR_LIMIT && pairCount <= 4;
}

export function backtestPageCanRun(input: {
  fromMs: number;
  toMs: number;
  interval: DcaIndicatorTimeframe;
  comparableSymbols?: readonly string[] | null;
}): boolean {
  return backtestShouldRunInline(
    estimateBacktestBars(input.fromMs, input.toMs, input.interval),
    1 + (input.comparableSymbols?.length ?? 0),
  );
}

/** Desk cycle claims a short run when time remains. The backtest machine passes 0 and takes any length. */
export function backtestDrainMaxBars(where: "cycle" | "worker"): number {
  return where === "cycle" ? BACKTEST_VERCEL_BAR_LIMIT : 0;
}

const BACKTEST_REPLAY_YIELD_EVERY = 2_000;
const BACKTEST_REPLAY_YIELD_MS = 50;
let lastReplayYieldMs = 0;

/** Hand the event loop back often enough for the claim heartbeat and desk ticks. */
export async function yieldBacktestReplay(barIndex: number): Promise<void> {
  const now = Date.now();
  if (lastReplayYieldMs === 0) {
    lastReplayYieldMs = now;
  }
  const boundary = barIndex > 0 && barIndex % BACKTEST_REPLAY_YIELD_EVERY === 0;
  const elapsed = now - lastReplayYieldMs >= BACKTEST_REPLAY_YIELD_MS;
  if (!boundary && !elapsed) {
    return;
  }
  lastReplayYieldMs = now;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function normalizeBacktestContract(raw: string, venue?: string): string | null {
  if (venue) {
    const parsed = parseDeskFuturesSymbol(venue, raw);
    return parsed.ok ? parsed.symbol : null;
  }
  const symbol = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (symbol.length < 2 || symbol.length > 32) {
    return null;
  }
  return symbol;
}

export function parseComparableSymbols(
  raw: unknown,
  primary: string,
  venue?: string,
): string[] {
  const parts = Array.isArray(raw)
    ? raw.map((row) => String(row ?? ""))
    : String(raw ?? "").split(/[\s,]+/);
  const primarySymbol =
    normalizeBacktestContract(primary, venue) ??
    primary.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const part of parts) {
    const symbol = normalizeBacktestContract(part, venue);
    if (!symbol || symbol === primarySymbol || seen.has(symbol)) {
      continue;
    }
    seen.add(symbol);
    rows.push(symbol);
    if (rows.length >= BACKTEST_COMPARABLE_CAP) {
      break;
    }
  }
  return rows;
}

export function parseBacktestDates(
  fromRaw: unknown,
  toRaw: unknown,
): { ok: true; fromMs: number; toMs: number } | { ok: false; error: string } {
  const fromMs = utcDayStart(fromRaw);
  const toStart = utcDayStart(toRaw);
  if (fromMs == null || toStart == null) {
    return { ok: false, error: "Enter a start date and an end date." };
  }
  const toMs = toStart + 24 * 60 * 60 * 1000 - 1;
  if (!(toMs > fromMs)) {
    return { ok: false, error: "End date must be after the start date." };
  }
  return { ok: true, fromMs, toMs };
}

export function parseBacktestDateRange(
  fromRaw: unknown,
  toRaw: unknown,
  interval: DcaIndicatorTimeframe,
): { ok: true; fromMs: number; toMs: number } | { ok: false; error: string } {
  const range = parseBacktestDates(fromRaw, toRaw);
  if (!range.ok) {
    return range;
  }
  const bars = estimateBacktestBars(range.fromMs, range.toMs, interval);
  if (bars > BACKTEST_CANDLE_LIMIT) {
    return {
      ok: false,
      error:
        "That window is too long for this timeframe. Use a shorter range or a higher timeframe.",
    };
  }
  return range;
}

export function emptyBacktestStats(startingUsdt = 0): BacktestStats {
  return {
    trades: 0,
    wins: 0,
    winRate: 0,
    realizedUsdt: 0,
    maxDrawdownUsdt: 0,
    profitFactor: null,
    timeInMarket: 0,
    openQty: 0,
    openSide: null,
    markUsdt: 0,
    lastPrice: null,
    startingUsdt,
    endingUsdt: startingUsdt,
    returnPct: null,
  };
}

export type BacktestOutcome = "profit" | "loss" | "liquidated";

export function backtestRunWasLiquidated(
  orders: Array<Pick<SimulatedOrder, "reason">>,
): boolean {
  return orders.some((row) => row.reason === "liquidation");
}

const LIST_LIQUIDATION_MARK: SimulatedOrder = {
  atMs: 0,
  action: "flatten",
  side: "long",
  qty: 0,
  price: 0,
  feeUsdt: 0,
  realizedUsdt: null,
  reason: "liquidation",
};

/** Saved-list row. Keeps the liquidation mark and drops the fill tape. */
export function backtestListSnapshot(run: BacktestRun): BacktestRun {
  return {
    ...run,
    orders: backtestRunWasLiquidated(run.orders) ? [LIST_LIQUIDATION_MARK] : [],
    replayEvents: null,
  };
}

export function backtestRunOutcome(input: {
  orders: Array<Pick<SimulatedOrder, "reason">>;
  realizedUsdt: number;
}): BacktestOutcome {
  if (backtestRunWasLiquidated(input.orders)) {
    return "liquidated";
  }
  return input.realizedUsdt > 0 ? "profit" : "loss";
}

export function backtestOutcomeLabel(outcome: BacktestOutcome): string {
  if (outcome === "liquidated") {
    return "Account Liquidated";
  }
  return outcome === "profit" ? "Profit" : "Loss";
}

export function backtestLiquidationPrice(input: {
  side: "long" | "short";
  entry: number;
  qty: number;
  cashUsdt: number;
  feeRate?: number;
}): number | null {
  if (!(input.qty > 0) || !(input.entry > 0)) {
    return null;
  }
  const rate =
    input.feeRate != null && input.feeRate > 0 && Number.isFinite(input.feeRate)
      ? input.feeRate
      : 0;
  if (input.side === "long") {
    const denom = input.qty * (1 - rate);
    if (!(denom > 0)) {
      return null;
    }
    const price = (input.entry * input.qty - input.cashUsdt) / denom;
    return price > 0 && Number.isFinite(price) ? price : null;
  }
  const denom = input.qty * (1 + rate);
  if (!(denom > 0)) {
    return null;
  }
  const price = (input.cashUsdt + input.entry * input.qty) / denom;
  return price > 0 && Number.isFinite(price) ? price : null;
}

export function firstAdverseFill(
  side: "long" | "short",
  adverse: number,
  candidates: Array<{ price: number; reason: BacktestFillReason } | null>,
): { price: number; reason: BacktestFillReason } | null {
  const hit = candidates.filter(
    (row): row is { price: number; reason: BacktestFillReason } =>
      row != null &&
      row.price > 0 &&
      (side === "long" ? adverse <= row.price : adverse >= row.price),
  );
  if (hit.length === 0) {
    return null;
  }
  return hit.reduce((best, row) => {
    if (side === "long") {
      return row.price > best.price ? row : best;
    }
    return row.price < best.price ? row : best;
  });
}

export function finishBacktestStats(input: {
  trades: number;
  wins: number;
  realizedUsdt: number;
  maxDrawdownUsdt: number;
  profitFactor: number | null;
  timeInMarket: number;
  openQty: number;
  openSide: "long" | "short" | null;
  markUsdt: number;
  lastPrice?: number | null;
  startingUsdt: number;
}): BacktestStats {
  const endingUsdt = input.startingUsdt + input.realizedUsdt + input.markUsdt;
  return {
    trades: input.trades,
    wins: input.wins,
    winRate: input.trades > 0 ? input.wins / input.trades : 0,
    realizedUsdt: input.realizedUsdt,
    maxDrawdownUsdt: input.maxDrawdownUsdt,
    profitFactor: input.profitFactor,
    timeInMarket: input.timeInMarket,
    openQty: input.openQty,
    openSide: input.openSide,
    markUsdt: input.markUsdt,
    lastPrice:
      input.lastPrice != null && input.lastPrice > 0 ? input.lastPrice : null,
    startingUsdt: input.startingUsdt,
    endingUsdt,
    returnPct:
      input.startingUsdt > 0
        ? (endingUsdt - input.startingUsdt) / input.startingUsdt
        : null,
  };
}

export function formatBacktestReturnPct(
  returnPct: number | null | undefined,
): string {
  return formatPct(returnPct == null ? null : returnPct);
}

export function accountPnlUsdt(stats: Pick<
  BacktestStats,
  "startingUsdt" | "endingUsdt"
>): number {
  return stats.endingUsdt - stats.startingUsdt;
}

export function realizedEndingUsdt(
  stats: Pick<BacktestStats, "startingUsdt" | "realizedUsdt">,
): number {
  return stats.startingUsdt + stats.realizedUsdt;
}

export function realizedReturnPct(
  stats: Pick<BacktestStats, "startingUsdt" | "realizedUsdt">,
): number | null {
  if (!(stats.startingUsdt > 0) || !Number.isFinite(stats.realizedUsdt)) {
    return null;
  }
  return stats.realizedUsdt / stats.startingUsdt;
}

export const BACKTEST_MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export function realizedAprPct(
  realizedUsdt: number,
  peakNotionalUsdt: number,
  fromMs: number,
  toMs: number,
): number | null {
  const period = returnOnCapitalUsedPct(realizedUsdt, peakNotionalUsdt);
  const years = (toMs - fromMs) / BACKTEST_MS_PER_YEAR;
  if (period == null || !(years > 0) || period <= -1) {
    return null;
  }
  return (1 + period) ** (1 / years) - 1;
}

export function peakLockedNotionalUsdt(orders: SimulatedOrder[]): number {
  const legs: Record<"long" | "short", { qty: number; entry: number }> = {
    long: { qty: 0, entry: 0 },
    short: { qty: 0, entry: 0 },
  };
  let peak = 0;
  for (const order of orders) {
    const leg = legs[order.side];
    if (order.action === "flatten") {
      legs[order.side] = { qty: 0, entry: 0 };
    } else {
      const nextQty = leg.qty + order.qty;
      const entry =
        nextQty > 0
          ? (leg.entry * leg.qty + order.price * order.qty) / nextQty
          : order.price;
      legs[order.side] = { qty: nextQty, entry };
    }
    const locked =
      legs.long.qty * legs.long.entry + legs.short.qty * legs.short.entry;
    if (locked > peak) {
      peak = locked;
    }
  }
  return peak;
}

export function completedBacktestNotionalUsdt(
  orders: SimulatedOrder[],
): number {
  const legs: Record<"long" | "short", { qty: number; entry: number }> = {
    long: { qty: 0, entry: 0 },
    short: { qty: 0, entry: 0 },
  };
  let sum = 0;
  for (const order of orders) {
    const leg = legs[order.side];
    if (order.action === "flatten") {
      sum += leg.qty * leg.entry;
      legs[order.side] = { qty: 0, entry: 0 };
    } else {
      const nextQty = leg.qty + order.qty;
      const entry =
        nextQty > 0
          ? (leg.entry * leg.qty + order.price * order.qty) / nextQty
          : order.price;
      legs[order.side] = { qty: nextQty, entry };
    }
  }
  return sum;
}

export function backtestOnNotionalPct(
  realizedUsdt: number,
  orders: SimulatedOrder[],
): number | null {
  return returnOnCapitalUsedPct(
    realizedUsdt,
    completedBacktestNotionalUsdt(orders),
  );
}

export function backtestRoePct(
  realizedUsdt: number,
  orders: SimulatedOrder[],
  leverage: number,
): number | null {
  return returnOnCapitalUsedPct(
    realizedUsdt,
    backtestMarginUsdt(completedBacktestNotionalUsdt(orders), leverage),
  );
}

export function backtestWindowDays(fromMs: number, toMs: number): number | null {
  return inclusiveUtcDays(fromMs, toMs);
}

export function backtestAprPct(
  realizedUsdt: number,
  startingUsdt: number,
  fromMs: number,
  toMs: number,
): number | null {
  return annualizeReturnPct(
    realizedReturnPct({ startingUsdt, realizedUsdt }),
    backtestWindowDays(fromMs, toMs),
  );
}

export function backtestDrawdownPct(stats: Pick<
  BacktestStats,
  "startingUsdt" | "maxDrawdownUsdt"
>): number | null {
  if (!(stats.startingUsdt > 0) || !Number.isFinite(stats.maxDrawdownUsdt)) {
    return null;
  }
  return stats.maxDrawdownUsdt / stats.startingUsdt;
}

/** Header Max Drawdown: stored marked-equity dip, not a fill-only rebuild. */
export function backtestDrawdownCard(
  stats: Pick<BacktestStats, "trades" | "startingUsdt" | "maxDrawdownUsdt">,
  extra?: { liquidated?: boolean },
): { value: string; toneClass: string; note?: string } {
  if (!(stats.trades > 0)) {
    return { value: "—", toneClass: "text-ink" };
  }
  const dip = Number.isFinite(stats.maxDrawdownUsdt)
    ? stats.maxDrawdownUsdt
    : 0;
  const visible = Math.round(dip) > 0;
  if (extra?.liquidated && visible) {
    return {
      value: formatPct(1),
      toneClass: signedTone(-dip),
      note: formatSignedUsd(-dip),
    };
  }
  const pct = backtestDrawdownPct({
    startingUsdt: stats.startingUsdt,
    maxDrawdownUsdt: visible ? dip : 0,
  });
  return {
    value: pct == null ? "—" : formatPct(pct),
    toneClass: signedTone(visible ? -dip : 0),
    note: visible ? formatSignedUsd(-dip) : undefined,
  };
}

export function splitCompletedBacktestOrders(orders: SimulatedOrder[]): {
  completed: SimulatedOrder[];
  open: SimulatedOrder[];
} {
  const completed: SimulatedOrder[] = [];
  const pending: Record<"long" | "short", SimulatedOrder[]> = {
    long: [],
    short: [],
  };
  for (const order of orders) {
    if (order.action === "flatten") {
      completed.push(...pending[order.side], order);
      pending[order.side] = [];
    } else {
      pending[order.side].push(order);
    }
  }
  return {
    completed,
    open: [...pending.long, ...pending.short],
  };
}

export function openBacktestPositionLabel(orders: SimulatedOrder[]): string | null {
  if (orders.length === 0) {
    return null;
  }
  const sides = ["long", "short"] as const;
  const parts = sides.flatMap((side) => {
    const rows = orders.filter((row) => row.side === side);
    if (rows.length === 0) {
      return [];
    }
    const qty = rows.reduce((sum, row) => sum + row.qty, 0);
    return [`${side} ${qty.toFixed(4)}`];
  });
  return parts.length > 0 ? parts.join(" · ") : null;
}

export type BacktestLinkHighlight = {
  runId: string;
  symbol: string;
  interval: DcaIndicatorTimeframe;
  fromMs: number;
  toMs: number;
  trades: number;
  winRate: number;
  realizedUsdt: number;
  returnPct: number | null;
  roePct: number | null;
  aprPct: number | null;
};

/** Same read rule as a backtest report: the owner, an admin, or a published run. */
export function memberCanReadBacktestRun(
  run: { userId: string | null },
  userId: string,
  isAdmin: boolean,
): boolean {
  if (isAdmin) {
    return true;
  }
  return run.userId === userId || run.userId === null;
}

export type TemplateBacktestLink = {
  runId: string;
  name: string;
  fromMs: number;
  toMs: number;
  highlight: BacktestLinkHighlight | null;
  /** Library row this run’s `template_id` points at. Inherited copies keep the platform id. */
  templateId?: string;
};

export type AttachedBacktestRow = {
  id: string;
  userId: string | null;
  status: BacktestStatus;
  name: string | null;
  symbol: string;
  recipeName: string;
  parentRunId: string | null;
  fromMs: number;
  toMs: number;
  createdAtMs: number;
  interval?: DcaIndicatorTimeframe | null;
  leverage?: number;
  stats?: BacktestStats | null;
  orders?: SimulatedOrder[];
};

/** Finished runs attached to one template, newest first, that this member can open. */
export function templateBacktestLinks(
  rows: AttachedBacktestRow[],
  viewerId: string,
  isAdmin: boolean,
): TemplateBacktestLink[] {
  return rows
    .filter(
      (row) =>
        row.status === "done" &&
        memberCanReadBacktestRun(
          { userId: row.userId },
          viewerId,
          isAdmin,
        ),
    )
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .map((row) => ({
      runId: row.id,
      name: backtestRunTitle({
        name: row.name,
        recipe: { name: row.recipeName },
        symbol: row.symbol,
        parentRunId: row.parentRunId,
      }),
      fromMs: row.fromMs,
      toMs: row.toMs,
      highlight: row.interval
        ? backtestLinkHighlight({
            id: row.id,
            symbol: row.symbol,
            interval: row.interval,
            fromMs: row.fromMs,
            toMs: row.toMs,
            stats: row.stats ?? null,
            orders: row.orders ?? [],
            leverage: normalizeBacktestLeverage(row.leverage),
          })
        : null,
    }));
}

/** Finished runs this member can open, grouped by the template they are attached to. */
export function templateBacktestLinksByTemplate(
  rows: Array<AttachedBacktestRow & { templateId: string }>,
  viewerId: string,
  isAdmin: boolean,
): Record<string, TemplateBacktestLink[]> {
  const grouped = new Map<string, AttachedBacktestRow[]>();
  for (const row of rows) {
    const templateId = row.templateId.trim();
    if (!templateId) {
      continue;
    }
    const list = grouped.get(templateId) ?? [];
    list.push(row);
    grouped.set(templateId, list);
  }
  const links: Record<string, TemplateBacktestLink[]> = {};
  for (const [templateId, list] of grouped) {
    const visible = templateBacktestLinks(list, viewerId, isAdmin);
    if (visible.length > 0) {
      links[templateId] = visible.map((link) => ({ ...link, templateId }));
    }
  }
  return links;
}

/** Who may clear `template_id` from Edit template. The run must be attached to that row. */
export function detachBacktestFromTemplateDecision(input: {
  runTemplateId: string | null;
  template: { id: string; visibility: string; userId: string | null };
  userId: string;
  isAdmin: boolean;
}): { ok: true } | { ok: false; error: string } {
  const templateId = input.template.id.trim();
  if (!templateId || input.runTemplateId !== templateId) {
    return {
      ok: false,
      error: "That backtest is not attached to this template.",
    };
  }
  const catalog =
    input.template.visibility === "platform" ||
    (input.template.visibility === "backtested" && !input.template.userId);
  const canManage = catalog
    ? input.isAdmin
    : input.template.userId === input.userId || input.isAdmin;
  if (!canManage) {
    return { ok: false, error: "That template was not found." };
  }
  return { ok: true };
}

export function backtestLinkHighlight(
  run: Pick<
    BacktestRun,
    | "id"
    | "symbol"
    | "interval"
    | "fromMs"
    | "toMs"
    | "stats"
    | "orders"
    | "leverage"
  >,
): BacktestLinkHighlight {
  const realized = run.stats?.realizedUsdt ?? 0;
  const startingUsdt = run.stats?.startingUsdt ?? 0;
  const leverage = normalizeBacktestLeverage(run.leverage);
  return {
    runId: run.id,
    symbol: run.symbol,
    interval: run.interval,
    fromMs: run.fromMs,
    toMs: run.toMs,
    trades: run.stats?.trades ?? 0,
    winRate: run.stats?.winRate ?? 0,
    realizedUsdt: realized,
    returnPct: realizedReturnPct({ startingUsdt, realizedUsdt: realized }),
    roePct: backtestRoePct(realized, run.orders, leverage),
    aprPct: backtestAprPct(
      realized,
      startingUsdt,
      run.fromMs,
      run.toMs,
    ),
  };
}

export function returnOnCapitalUsedPct(
  pnlUsdt: number,
  peakNotionalUsdt: number,
): number | null {
  if (!(peakNotionalUsdt > 0) || !Number.isFinite(pnlUsdt)) {
    return null;
  }
  return pnlUsdt / peakNotionalUsdt;
}
