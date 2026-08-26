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

export const FUTURES_OPEN_LOCKED_COLUMN_COUNT = 4;

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
  const next = { ...FUTURES_OPEN_COLUMN_DEFAULTS };
  if (!raw || typeof raw !== "object") {
    return next;
  }
  const record = raw as Record<string, unknown>;
  for (const id of FUTURES_OPEN_OPTIONAL_COLUMNS) {
    if (typeof record[id] === "boolean") {
      next[id] = record[id];
    }
  }
  return next;
}

export function parseStoredFuturesOpenColumns(
  raw: string | null,
): FuturesOpenColumnVisibility {
  if (!raw) {
    return FUTURES_OPEN_COLUMN_DEFAULTS;
  }
  try {
    return parseFuturesOpenColumns(JSON.parse(raw));
  } catch {
    return FUTURES_OPEN_COLUMN_DEFAULTS;
  }
}

export function futuresOpenColumnCount(
  visible: FuturesOpenColumnVisibility,
): number {
  return (
    FUTURES_OPEN_LOCKED_COLUMN_COUNT +
    FUTURES_OPEN_OPTIONAL_COLUMNS.filter((id) => visible[id]).length
  );
}
