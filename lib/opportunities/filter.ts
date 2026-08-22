import type { ScannedOpportunity } from "@/lib/opportunities/scan";

export type OpportunityFilters = {
  minNetApr: number | null;
  minDte: number | null;
  maxDte: number | null;
  minCapacityUsdt: number | null;
};

export type OpportunityFilterInputs = {
  minApr: string;
  minDte: string;
  maxDte: string;
  minCapacity: string;
};

const EMPTY_FILTERS: OpportunityFilters = {
  minNetApr: null,
  minDte: null,
  maxDte: null,
  minCapacityUsdt: null,
};

export function parseOpportunityFilters(
  params: Record<string, string | string[] | undefined>,
): OpportunityFilters {
  const minDte = parseBound(first(params.minDte));
  const maxDte = parseBound(first(params.maxDte));
  const ordered =
    minDte !== null && maxDte !== null && minDte > maxDte
      ? { minDte: maxDte, maxDte: minDte }
      : { minDte, maxDte };

  return {
    minNetApr: parsePercent(first(params.minApr)),
    minDte: ordered.minDte,
    maxDte: ordered.maxDte,
    minCapacityUsdt: parseBound(first(params.minCapacity)),
  };
}

export function applyOpportunityFilters(
  rows: ScannedOpportunity[],
  filters: OpportunityFilters,
): ScannedOpportunity[] {
  return rows.filter((row) => matchesFilters(row, filters));
}

export function filtersAreActive(filters: OpportunityFilters): boolean {
  return (
    filters.minNetApr !== null ||
    filters.minDte !== null ||
    filters.maxDte !== null ||
    filters.minCapacityUsdt !== null
  );
}

export function filterInputValues(
  filters: OpportunityFilters,
): OpportunityFilterInputs {
  return {
    minApr: decimalToPercentInput(filters.minNetApr),
    minDte: boundToInput(filters.minDte),
    maxDte: boundToInput(filters.maxDte),
    minCapacity: boundToInput(filters.minCapacityUsdt),
  };
}

export function emptyOpportunityFilters(): OpportunityFilters {
  return EMPTY_FILTERS;
}

function matchesFilters(
  row: ScannedOpportunity,
  filters: OpportunityFilters,
): boolean {
  if (filters.minNetApr !== null) {
    if (row.netApr === null || row.netApr < filters.minNetApr) {
      return false;
    }
  }
  if (filters.minDte !== null && row.daysToExpiry < filters.minDte) {
    return false;
  }
  if (filters.maxDte !== null && row.daysToExpiry > filters.maxDte) {
    return false;
  }
  if (
    filters.minCapacityUsdt !== null &&
    row.capacityUsdt < filters.minCapacityUsdt
  ) {
    return false;
  }
  return true;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseBound(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function parsePercent(raw: string | undefined): number | null {
  const value = parseBound(raw);
  return value === null ? null : value / 100;
}

function boundToInput(value: number | null): string {
  return value === null ? "" : String(value);
}

function decimalToPercentInput(value: number | null): string {
  if (value === null) {
    return "";
  }
  return String(Number((value * 100).toPrecision(12)));
}
