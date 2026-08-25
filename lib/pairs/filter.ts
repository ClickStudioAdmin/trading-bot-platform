export type PairFilters = {
  q: string;
  base: string;
  minDte: number | null;
  maxDte: number | null;
};

export type PairFilterInputs = {
  q: string;
  base: string;
  minDte: string;
  maxDte: string;
};

const EMPTY: PairFilters = {
  q: "",
  base: "",
  minDte: null,
  maxDte: null,
};

export function parsePairFilters(
  params: Record<string, string | string[] | undefined>,
): PairFilters {
  const minDte = parseBound(first(params.minDte));
  const maxDte = parseBound(first(params.maxDte));
  const ordered =
    minDte !== null && maxDte !== null && minDte > maxDte
      ? { minDte: maxDte, maxDte: minDte }
      : { minDte, maxDte };
  return {
    q: first(params.q)?.trim() ?? "",
    base: (first(params.base) ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, ""),
    minDte: ordered.minDte,
    maxDte: ordered.maxDte,
  };
}

export function pairFiltersAreActive(filters: PairFilters): boolean {
  return (
    filters.q !== "" ||
    filters.base !== "" ||
    filters.minDte !== null ||
    filters.maxDte !== null
  );
}

export function pairFilterInputValues(filters: PairFilters): PairFilterInputs {
  return {
    q: filters.q,
    base: filters.base,
    minDte: filters.minDte === null ? "" : String(filters.minDte),
    maxDte: filters.maxDte === null ? "" : String(filters.maxDte),
  };
}

export function applyPairFilters<T>(
  rows: T[],
  filters: PairFilters,
  fields: (row: T) => { text: string; base: string; dte?: number },
): T[] {
  return rows.filter((row) => {
    const { text, base, dte } = fields(row);
    if (filters.q && !text.toUpperCase().includes(filters.q.toUpperCase())) {
      return false;
    }
    if (filters.base && base.toUpperCase() !== filters.base) {
      return false;
    }
    if (filters.minDte !== null && dte !== undefined && dte < filters.minDte) {
      return false;
    }
    if (filters.maxDte !== null && dte !== undefined && dte > filters.maxDte) {
      return false;
    }
    return true;
  });
}

export function uniquePairBases(bases: string[]): string[] {
  const pinned = ["BTC", "ETH", "SOL", "DOGE", "XRP", "MNT"];
  return [...new Set(bases.filter(Boolean))].sort((left, right) => {
    const leftPin = pinned.indexOf(left);
    const rightPin = pinned.indexOf(right);
    const leftRank = leftPin === -1 ? pinned.length : leftPin;
    const rightRank = rightPin === -1 ? pinned.length : rightPin;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.localeCompare(right);
  });
}

export function emptyPairFilters(): PairFilters {
  return EMPTY;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseBound(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") {
    return null;
  }
  const value = Number(raw.replace(/,/g, "").trim());
  return Number.isFinite(value) ? value : null;
}
