import { pathWithDesk, withQuery } from "@/lib/accounts/model";
import { loadUsdtLinearPerps, type LinearPerp } from "@/lib/exchanges/bybit/perp";
import {
  enabledVenues,
  getVenue,
  parseVenueEnvironment,
  parseVenueId,
  type VenueDefinition,
} from "@/lib/exchanges/venues";
import { loadMarketCaps } from "@/lib/market/caps";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";
import { loadHyperliquidLinearPerps } from "@/lib/venues/hyperliquid/market";
import type { PairFilters } from "@/lib/pairs/filter";
import {
  compareTableNum,
  compareTableText,
  parseTableSortDir,
  parseTableSortKey,
  tableSortHref,
  type TableSortDir,
} from "@/lib/table-chrome";

export const PAIRS_PAGE_SIZE = 50;
export const PAIR_DEFAULT_SORT = "cap";
export const PAIR_DEFAULT_DIR: TableSortDir = "desc";

export const PAIR_SORTS = {
  futures: ["base", "contract", "category", "quote", "cap", "status"] as const,
  carry: ["base", "spot", "future", "delivery", "dte", "cap"] as const,
} as const;

export type FuturesPairSort = (typeof PAIR_SORTS.futures)[number];
export type CarryPairSort = (typeof PAIR_SORTS.carry)[number];

export function sortByMarketCap<T>(
  rows: readonly T[],
  capOf: (row: T) => number | null,
  tieBreak: (left: T, right: T) => number,
): T[] {
  return [...rows].sort((left, right) => {
    const leftCap = capOf(left);
    const rightCap = capOf(right);
    if (leftCap === null && rightCap === null) {
      return tieBreak(left, right);
    }
    if (leftCap === null) {
      return 1;
    }
    if (rightCap === null) {
      return -1;
    }
    if (rightCap !== leftCap) {
      return rightCap - leftCap;
    }
    return tieBreak(left, right);
  });
}

export function rankLinearPerps(
  pairs: readonly LinearPerp[],
  caps: ReadonlyMap<string, number>,
): LinearPerp[] {
  return sortByMarketCap(
    pairs,
    (pair) => caps.get(pair.baseCoin) ?? null,
    (left, right) =>
      left.baseCoin.localeCompare(right.baseCoin) ||
      left.symbol.localeCompare(right.symbol),
  );
}

export async function withMarketCapRank(
  pairs: readonly LinearPerp[],
): Promise<LinearPerp[]> {
  if (pairs.length === 0) {
    return [];
  }
  return rankLinearPerps(pairs, await loadMarketCaps());
}

export function paginatePairRows<T>(
  rows: readonly T[],
  pageRaw: unknown,
): {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  rows: T[];
} {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / PAIRS_PAGE_SIZE));
  const parsed = Number(Array.isArray(pageRaw) ? pageRaw[0] : pageRaw);
  const page =
    Number.isInteger(parsed) && parsed > 0
      ? Math.min(parsed, pageCount)
      : 1;
  const from = total === 0 ? 0 : (page - 1) * PAIRS_PAGE_SIZE;
  const to = Math.min(from + PAIRS_PAGE_SIZE, total);
  return {
    page,
    pageCount,
    total,
    from,
    to,
    rows: rows.slice(from, to),
  };
}

export function parsePairSort<T extends string>(
  params: Record<string, string | string[] | undefined>,
  allowed: readonly T[],
): { sort: T; dir: TableSortDir } {
  const fallback = (
    (allowed as readonly string[]).includes(PAIR_DEFAULT_SORT)
      ? PAIR_DEFAULT_SORT
      : allowed[0]
  ) as T;
  return {
    sort: parseTableSortKey(firstSearch(params.sort), allowed, fallback),
    dir: firstSearch(params.dir)
      ? parseTableSortDir(firstSearch(params.dir))
      : PAIR_DEFAULT_DIR,
  };
}

export function sortPairRows<T>(
  rows: readonly T[],
  key: string,
  dir: TableSortDir,
  getters: Record<string, (row: T) => string | number | null>,
): T[] {
  const get = getters[key];
  if (!get) {
    return [...rows];
  }
  return [...rows].sort((left, right) => {
    const a = get(left);
    const b = get(right);
    if (a === null && b === null) {
      return 0;
    }
    if (a === null) {
      return 1;
    }
    if (b === null) {
      return -1;
    }
    if (typeof a === "string" || typeof b === "string") {
      return compareTableText(String(a), String(b), dir);
    }
    return compareTableNum(Number(a), Number(b), dir);
  });
}

export const ACCOUNT_PAIRS_PATH = "/account/exchanges/pairs";

export function exchangePairsPath(): string {
  return ACCOUNT_PAIRS_PATH;
}

export function parsePairsVenue(raw: unknown): VenueDefinition {
  const parsed = parseVenueId(raw);
  if (parsed.ok && parsed.venue.enabled) {
    return parsed.venue;
  }
  return getVenue("bybit") ?? enabledVenues()[0];
}

export function parsePairsEnvironment(
  venue: VenueDefinition,
  raw: unknown,
): string {
  const parsed = parseVenueEnvironment(venue, raw);
  if (parsed.ok) {
    return parsed.environment.id;
  }
  return (
    venue.environments.find((item) => item.id === "live")?.id ??
    venue.environments[0]?.id ??
    "live"
  );
}

export function exchangePairCountKey(
  venue: string,
  environment?: string | null,
): string {
  return `${venue}:${environment && environment !== "live" ? environment : "live"}`;
}

export async function loadExchangePairCounts(
  rows: readonly { venue: string; environment: string | null }[],
): Promise<Record<string, number | null>> {
  const unique = new Map<string, { venue: string; environment: string | null }>();
  for (const row of rows) {
    const key = exchangePairCountKey(row.venue, row.environment);
    if (!unique.has(key)) {
      unique.set(key, row);
    }
  }
  const entries = await Promise.all(
    [...unique.entries()].map(async ([key, row]) => {
      try {
        const pairs =
          row.venue === "hyperliquid"
            ? await loadHyperliquidLinearPerps(
                hyperliquidInfoEnvironment(row.environment),
              )
            : await loadUsdtLinearPerps();
        return [key, pairs.length] as const;
      } catch {
        return [key, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

export function exchangePairsHref(
  venueId: string,
  options?: {
    environment?: string | null;
    kind?: "carry" | "perps";
    extra?: Record<string, string | undefined>;
  },
): string {
  const extra: Record<string, string> = { venue: venueId };
  if (options?.environment && options.environment !== "live") {
    extra.env = options.environment;
  }
  if (options?.kind === "carry") {
    extra.kind = "carry";
  }
  if (options?.extra) {
    for (const [key, value] of Object.entries(options.extra)) {
      if (value) {
        extra[key] = value;
      }
    }
  }
  return withQuery(exchangePairsPath(), extra);
}

function keepParams(
  keep: Record<string, string | undefined> | undefined,
): Record<string, string> {
  const extra: Record<string, string> = {};
  if (!keep) {
    return extra;
  }
  for (const [key, value] of Object.entries(keep)) {
    if (value) {
      extra[key] = value;
    }
  }
  return extra;
}

export function pairPageHref(input: {
  path: string;
  deskId?: string | null;
  keep?: Record<string, string | undefined>;
  filters: PairFilters;
  page: number;
  sort?: string;
  dir?: TableSortDir;
}): string {
  const extra: Record<string, string> = keepParams(input.keep);
  if (input.filters.q) {
    extra.q = input.filters.q;
  }
  if (input.filters.base) {
    extra.base = input.filters.base;
  }
  if (input.filters.minDte !== null) {
    extra.minDte = String(input.filters.minDte);
  }
  if (input.filters.maxDte !== null) {
    extra.maxDte = String(input.filters.maxDte);
  }
  const sort = input.sort ?? PAIR_DEFAULT_SORT;
  const dir = input.dir ?? PAIR_DEFAULT_DIR;
  if (sort !== PAIR_DEFAULT_SORT) {
    extra.sort = sort;
  }
  if (dir !== PAIR_DEFAULT_DIR) {
    extra.dir = dir;
  }
  if (input.page > 1) {
    extra.page = String(input.page);
  }
  const base = input.deskId
    ? pathWithDesk(input.path, input.deskId)
    : input.path;
  return Object.keys(extra).length > 0 ? withQuery(base, extra) : base;
}

export function pairSortHref(input: {
  path: string;
  deskId?: string | null;
  keep?: Record<string, string | undefined>;
  filters: PairFilters;
  key: string;
  currentKey: string;
  currentDir: TableSortDir;
}): string {
  return tableSortHref({
    pathname: input.path,
    params: {
      desk: input.deskId ?? undefined,
      ...keepParams(input.keep),
      q: input.filters.q || undefined,
      base: input.filters.base || undefined,
      minDte:
        input.filters.minDte !== null ? String(input.filters.minDte) : undefined,
      maxDte:
        input.filters.maxDte !== null ? String(input.filters.maxDte) : undefined,
    },
    key: input.key,
    currentKey: input.currentKey,
    currentDir: input.currentDir,
    defaultKey: PAIR_DEFAULT_SORT,
    defaultDir: PAIR_DEFAULT_DIR,
  });
}

function firstSearch(value: unknown): string {
  return String(Array.isArray(value) ? value[0] : (value ?? "")).trim();
}

export function pairPageLabel(input: {
  page: number;
  total: number;
  from: number;
  to: number;
}): string {
  if (input.total === 0) {
    return "No pairs.";
  }
  return `Showing ${input.from + 1}–${input.to} of ${input.total}`;
}
