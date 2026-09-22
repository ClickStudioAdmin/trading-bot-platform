import {
  parseColumnFlags,
  parseStoredColumnFlags,
} from "@/lib/table-columns";

export const FUTURES_OPEN_OPTIONAL_COLUMNS = [
  "qty",
  "value",
  "entry",
  "mark",
  "unrealized",
  "pnl",
  "leverage",
  "liq",
  "tpsl",
  "trailing",
] as const;

export type FuturesOpenOptionalColumn =
  (typeof FUTURES_OPEN_OPTIONAL_COLUMNS)[number];

export type FuturesOpenColumnVisibility = Record<
  FuturesOpenOptionalColumn,
  boolean
>;

export const FUTURES_OPEN_COLUMNS_KEY = "tbp-columns:futures-open";

export const FUTURES_OPEN_LOCKED_COLUMN_COUNT = 5;

export const FUTURES_DCA_OPEN_COLUMN_COUNT = 1;

export const FUTURES_OPEN_COLUMN_LABELS: Record<
  FuturesOpenOptionalColumn,
  string
> = {
  qty: "Qty",
  value: "Value",
  entry: "Entry",
  mark: "Mark",
  unrealized: "Unrealized",
  pnl: "P&L %",
  leverage: "Leverage",
  liq: "Liq",
  tpsl: "TP/SL",
  trailing: "Trailing",
};

export const FUTURES_OPEN_COLUMN_DEFAULTS: FuturesOpenColumnVisibility = {
  qty: true,
  value: true,
  entry: true,
  mark: true,
  unrealized: true,
  pnl: true,
  leverage: true,
  liq: true,
  tpsl: true,
  trailing: true,
};

export function parseFuturesOpenColumns(
  raw: unknown,
): FuturesOpenColumnVisibility {
  return parseColumnFlags(
    raw,
    FUTURES_OPEN_OPTIONAL_COLUMNS,
    FUTURES_OPEN_COLUMN_DEFAULTS,
  );
}

export function parseStoredFuturesOpenColumns(
  raw: string | null,
): FuturesOpenColumnVisibility {
  return parseStoredColumnFlags(
    raw,
    FUTURES_OPEN_OPTIONAL_COLUMNS,
    FUTURES_OPEN_COLUMN_DEFAULTS,
  );
}

export function futuresOpenColumnCount(
  visible: FuturesOpenColumnVisibility,
  extra = 0,
): number {
  return (
    FUTURES_OPEN_LOCKED_COLUMN_COUNT +
    FUTURES_OPEN_OPTIONAL_COLUMNS.filter((id) => visible[id]).length +
    extra
  );
}

export const FUTURES_CLOSED_OPTIONAL_COLUMNS = [
  "source",
  "closed",
  "days",
  "entry",
  "exit",
  "realized",
  "pnl",
  "roe",
] as const;

export type FuturesClosedOptionalColumn =
  (typeof FUTURES_CLOSED_OPTIONAL_COLUMNS)[number];

export type FuturesClosedColumnVisibility = Record<
  FuturesClosedOptionalColumn,
  boolean
>;

export const FUTURES_CLOSED_COLUMNS_KEY = "tbp-columns:futures-closed";

export const FUTURES_CLOSED_LOCKED_COLUMN_COUNT = 2;

export const FUTURES_CLOSED_COLUMN_LABELS: Record<
  FuturesClosedOptionalColumn,
  string
> = {
  source: "Source",
  closed: "Closed",
  days: "Days held",
  entry: "Entry",
  exit: "Exit",
  realized: "Realized",
  pnl: "P&L %",
  roe: "ROE",
};

export const FUTURES_CLOSED_COLUMN_DEFAULTS: FuturesClosedColumnVisibility = {
  source: true,
  closed: true,
  days: true,
  entry: true,
  exit: true,
  realized: true,
  pnl: true,
  roe: true,
};

export function parseFuturesClosedColumns(
  raw: unknown,
): FuturesClosedColumnVisibility {
  return parseColumnFlags(
    raw,
    FUTURES_CLOSED_OPTIONAL_COLUMNS,
    FUTURES_CLOSED_COLUMN_DEFAULTS,
  );
}

export function parseStoredFuturesClosedColumns(
  raw: string | null,
): FuturesClosedColumnVisibility {
  return parseStoredColumnFlags(
    raw,
    FUTURES_CLOSED_OPTIONAL_COLUMNS,
    FUTURES_CLOSED_COLUMN_DEFAULTS,
  );
}

export function futuresClosedColumnCount(
  visible: FuturesClosedColumnVisibility,
): number {
  return (
    FUTURES_CLOSED_LOCKED_COLUMN_COUNT +
    FUTURES_CLOSED_OPTIONAL_COLUMNS.filter((id) => visible[id]).length
  );
}
