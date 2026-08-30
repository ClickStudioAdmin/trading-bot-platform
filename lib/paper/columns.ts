export const PAPER_OPEN_OPTIONAL_COLUMNS = [
  "dte",
  "value",
  "entry",
  "mark",
  "apr",
  "unrealized",
  "pnl",
] as const;

export type PaperOpenOptionalColumn =
  (typeof PAPER_OPEN_OPTIONAL_COLUMNS)[number];

export type PaperOpenColumnVisibility = Record<
  PaperOpenOptionalColumn,
  boolean
>;

export const PAPER_OPEN_COLUMNS_KEY = "tbp-columns:paper-open";

export const PAPER_OPEN_LOCKED_COLUMN_COUNT = 4;

export const PAPER_OPEN_COLUMN_LABELS: Record<
  PaperOpenOptionalColumn,
  string
> = {
  dte: "DTE",
  value: "Order Value",
  entry: "Entry basis",
  mark: "Mark basis",
  apr: "Net APR",
  unrealized: "Unrealized",
  pnl: "P&L %",
};

export const PAPER_OPEN_COLUMN_DEFAULTS: PaperOpenColumnVisibility = {
  dte: true,
  value: true,
  entry: true,
  mark: true,
  apr: true,
  unrealized: true,
  pnl: true,
};

export function parsePaperOpenColumns(
  raw: unknown,
): PaperOpenColumnVisibility {
  const next = { ...PAPER_OPEN_COLUMN_DEFAULTS };
  if (!raw || typeof raw !== "object") {
    return next;
  }
  const record = raw as Record<string, unknown>;
  for (const id of PAPER_OPEN_OPTIONAL_COLUMNS) {
    if (typeof record[id] === "boolean") {
      next[id] = record[id];
    }
  }
  return next;
}

export function parseStoredPaperOpenColumns(
  raw: string | null,
): PaperOpenColumnVisibility {
  if (!raw) {
    return PAPER_OPEN_COLUMN_DEFAULTS;
  }
  try {
    return parsePaperOpenColumns(JSON.parse(raw));
  } catch {
    return PAPER_OPEN_COLUMN_DEFAULTS;
  }
}

export function paperOpenColumnCount(
  visible: PaperOpenColumnVisibility,
): number {
  return (
    PAPER_OPEN_LOCKED_COLUMN_COUNT +
    PAPER_OPEN_OPTIONAL_COLUMNS.filter((id) => visible[id]).length
  );
}
