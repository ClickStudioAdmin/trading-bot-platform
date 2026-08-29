import { pathWithDesk, withQuery } from "@/lib/accounts/model";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import { loadMarketCaps } from "@/lib/market/caps";
import type { PairFilters } from "@/lib/pairs/filter";

export const PAIRS_PAGE_SIZE = 50;

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

export function pairPageHref(input: {
  path: string;
  deskId?: string | null;
  filters: PairFilters;
  page: number;
}): string {
  const extra: Record<string, string> = {};
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
  if (input.page > 1) {
    extra.page = String(input.page);
  }
  const base = input.deskId
    ? pathWithDesk(input.path, input.deskId)
    : input.path;
  return Object.keys(extra).length > 0 ? withQuery(base, extra) : base;
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
