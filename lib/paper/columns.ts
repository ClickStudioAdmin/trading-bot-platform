import {
  parseColumnFlags,
  parseStoredColumnFlags,
} from "@/lib/table-columns";

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
  return parseColumnFlags(
    raw,
    PAPER_OPEN_OPTIONAL_COLUMNS,
    PAPER_OPEN_COLUMN_DEFAULTS,
  );
}

export function parseStoredPaperOpenColumns(
  raw: string | null,
): PaperOpenColumnVisibility {
  return parseStoredColumnFlags(
    raw,
    PAPER_OPEN_OPTIONAL_COLUMNS,
    PAPER_OPEN_COLUMN_DEFAULTS,
  );
}

export function paperOpenColumnCount(
  visible: PaperOpenColumnVisibility,
): number {
  return (
    PAPER_OPEN_LOCKED_COLUMN_COUNT +
    PAPER_OPEN_OPTIONAL_COLUMNS.filter((id) => visible[id]).length
  );
}

export const PAPER_CLOSED_OPTIONAL_COLUMNS = [
  "source",
  "closed",
  "days",
  "entry",
  "exit",
  "realized",
  "pnl",
] as const;

export type PaperClosedOptionalColumn =
  (typeof PAPER_CLOSED_OPTIONAL_COLUMNS)[number];

export type PaperClosedColumnVisibility = Record<
  PaperClosedOptionalColumn,
  boolean
>;

export const PAPER_CLOSED_COLUMNS_KEY = "tbp-columns:paper-closed";

export const PAPER_CLOSED_LOCKED_COLUMN_COUNT = 2;

export const PAPER_CLOSED_COLUMN_LABELS: Record<
  PaperClosedOptionalColumn,
  string
> = {
  source: "Source",
  closed: "Closed",
  days: "Days held",
  entry: "Entry",
  exit: "Exit",
  realized: "Realized",
  pnl: "P&L %",
};

export const PAPER_CLOSED_COLUMN_DEFAULTS: PaperClosedColumnVisibility = {
  source: true,
  closed: true,
  days: true,
  entry: true,
  exit: true,
  realized: true,
  pnl: true,
};

export function parsePaperClosedColumns(
  raw: unknown,
): PaperClosedColumnVisibility {
  return parseColumnFlags(
    raw,
    PAPER_CLOSED_OPTIONAL_COLUMNS,
    PAPER_CLOSED_COLUMN_DEFAULTS,
  );
}

export function parseStoredPaperClosedColumns(
  raw: string | null,
): PaperClosedColumnVisibility {
  return parseStoredColumnFlags(
    raw,
    PAPER_CLOSED_OPTIONAL_COLUMNS,
    PAPER_CLOSED_COLUMN_DEFAULTS,
  );
}

export function paperClosedColumnCount(
  visible: PaperClosedColumnVisibility,
): number {
  return (
    PAPER_CLOSED_LOCKED_COLUMN_COUNT +
    PAPER_CLOSED_OPTIONAL_COLUMNS.filter((id) => visible[id]).length
  );
}
