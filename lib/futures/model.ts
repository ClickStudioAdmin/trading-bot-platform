export type FuturesSide = "long" | "short";
export type FuturesAction = "buy" | "sell" | "flatten";
export type FuturesPositionStatus = "open" | "closed";

export type FuturesPosition = {
  id: string;
  userId: string;
  accountId: string;
  symbol: string;
  side: FuturesSide;
  qty: number;
  entryPrice: number;
  notionalUsdt: number;
  realizedUsdt: number;
  status: FuturesPositionStatus;
  source: "manual";
  openedAtMs: number;
  closedAtMs: number | null;
  venue: string | null;
  environment: string | null;
};

export type FuturesOrder = {
  id: string;
  positionId: string;
  action: FuturesAction;
  qty: number;
  price: number | null;
  notionalUsdt: number | null;
  venueOrderId: string | null;
  filledAtMs: number;
};

export function parseFuturesSymbol(
  raw: unknown,
): { ok: true; symbol: string } | { ok: false; error: string } {
  const symbol = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (symbol.length < 4 || symbol.length > 32) {
    return { ok: false, error: "Enter a USDT perpetual symbol, for example BTCUSDT." };
  }
  if (!symbol.endsWith("USDT")) {
    return { ok: false, error: "Use a USDT linear perpetual, for example BTCUSDT." };
  }
  return { ok: true, symbol };
}

export function parseFuturesQty(
  raw: unknown,
): { ok: true; qty: number } | { ok: false; error: string } {
  const qty = Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!(qty > 0) || !Number.isFinite(qty)) {
    return { ok: false, error: "Enter a positive quantity." };
  }
  return { ok: true, qty };
}

export function parseFuturesAction(
  raw: unknown,
): { ok: true; action: FuturesAction } | { ok: false; error: string } {
  const action = String(raw ?? "").trim().toLowerCase();
  if (action === "buy" || action === "sell" || action === "flatten") {
    return { ok: true, action };
  }
  return { ok: false, error: "Choose Buy, Sell, or Flatten." };
}

export function parseFuturesSide(raw: unknown): FuturesSide | null {
  return raw === "long" || raw === "short" ? raw : null;
}

export function asPositiveNumber(raw: unknown): number | null {
  const value = Number(raw);
  return value > 0 && Number.isFinite(value) ? value : null;
}

export function parseFuturesPositionRow(
  row: Record<string, unknown>,
): FuturesPosition {
  const opened = new Date(String(row.opened_at ?? "")).getTime();
  const closedRaw = row.closed_at;
  const closed = closedRaw
    ? new Date(String(closedRaw)).getTime()
    : Number.NaN;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    accountId: String(row.account_id),
    symbol: String(row.symbol),
    side: parseFuturesSide(row.side) ?? "long",
    qty: Number(row.qty) || 0,
    entryPrice: Number(row.entry_price) || 0,
    notionalUsdt: Number(row.notional_usdt) || 0,
    realizedUsdt: Number(row.realized_usdt) || 0,
    status: row.status === "closed" ? "closed" : "open",
    source: "manual",
    openedAtMs: Number.isFinite(opened) ? opened : 0,
    closedAtMs: Number.isFinite(closed) ? closed : null,
    venue: row.venue ? String(row.venue) : null,
    environment: row.environment ? String(row.environment) : null,
  };
}
