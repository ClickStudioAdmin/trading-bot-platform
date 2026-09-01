export type FuturesSide = "long" | "short";
export type FuturesAction = "buy" | "sell" | "flatten";
export type FuturesOrderType = "market" | "limit";
export type FuturesTrigger = "last" | "mark" | "index";
export type FuturesTpslMode = "full" | "partial";
export type FuturesPositionStatus = "open" | "closed";
export type FuturesTradeSource = "manual" | "engine" | "webhook";

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
  leverage: number | null;
  status: FuturesPositionStatus;
  source: FuturesTradeSource;
  ruleId: string | null;
  ruleName: string | null;
  openedAtMs: number;
  closedAtMs: number | null;
  venue: string | null;
  environment: string | null;
  takeProfit: number | null;
  stopLoss: number | null;
  tpTrigger: FuturesTrigger;
  slTrigger: FuturesTrigger;
  tpslMode: FuturesTpslMode;
  tpQty: number | null;
  slQty: number | null;
  tpOrderType: FuturesOrderType;
  slOrderType: FuturesOrderType;
  tpLimitPrice: number | null;
  slLimitPrice: number | null;
  trailingStop: number | null;
  trailingActive: number | null;
  trailingPeak: number | null;
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
  source: FuturesTradeSource;
  ruleName: string | null;
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

export function parseCloseQty(
  raw: unknown,
  positionQty: number,
): { ok: true; qty: number } | { ok: false; error: string } {
  const qtyParsed =
    String(raw ?? "").trim() === ""
      ? { ok: true as const, qty: positionQty }
      : parseFuturesQty(raw);
  if (!qtyParsed.ok) {
    return qtyParsed;
  }
  if (!(positionQty > 0)) {
    return { ok: false, error: "There is no open position to close." };
  }
  return { ok: true, qty: Math.min(qtyParsed.qty, positionQty) };
}

export function parseFuturesSizeUnit(
  raw: unknown,
): { ok: true; unit: "qty" | "usdt" } | { ok: false; error: string } {
  const unit = String(raw ?? "qty").trim().toLowerCase();
  if (unit === "" || unit === "qty" || unit === "base" || unit === "token") {
    return { ok: true, unit: "qty" };
  }
  if (unit === "usdt" || unit === "usdc" || unit === "quote") {
    return { ok: true, unit: "usdt" };
  }
  return { ok: false, error: "Choose token quantity or USDT size." };
}

export function parseFuturesNotional(
  raw: unknown,
): { ok: true; qty: number } | { ok: false; error: string } {
  const parsed = parseFuturesQty(raw);
  if (!parsed.ok) {
    return { ok: false, error: "Enter a positive USDT or USDC amount." };
  }
  return parsed;
}

export function parseFuturesOrderType(
  raw: unknown,
): { ok: true; orderType: FuturesOrderType } | { ok: false; error: string } {
  const orderType = String(raw ?? "market").trim().toLowerCase();
  if (orderType === "" || orderType === "market") {
    return { ok: true, orderType: "market" };
  }
  if (orderType === "limit") {
    return { ok: true, orderType: "limit" };
  }
  return { ok: false, error: "Choose Market or Limit." };
}

export function parseFuturesLimitPrice(
  raw: unknown,
): { ok: true; price: number } | { ok: false; error: string } {
  const price = Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!(price > 0) || !Number.isFinite(price)) {
    return { ok: false, error: "Enter a positive limit price." };
  }
  return { ok: true, price };
}

export function parseFuturesAction(
  raw: unknown,
): { ok: true; action: FuturesAction } | { ok: false; error: string } {
  const action = String(raw ?? "").trim().toLowerCase();
  if (action === "close") {
    return { ok: true, action: "flatten" };
  }
  if (action === "buy" || action === "sell" || action === "flatten") {
    return { ok: true, action };
  }
  return { ok: false, error: "Choose Buy, Sell, or Close." };
}

export function parseFuturesSide(raw: unknown): FuturesSide | null {
  return raw === "long" || raw === "short" ? raw : null;
}

export function parseFuturesTradeSource(raw: unknown): FuturesTradeSource {
  if (raw === "engine") {
    return "engine";
  }
  if (raw === "webhook") {
    return "webhook";
  }
  return "manual";
}

export function parseFuturesTriggerColumn(raw: unknown): FuturesTrigger {
  return raw === "mark" || raw === "index" ? raw : "last";
}

export function asPositiveNumber(raw: unknown): number | null {
  const value = Number(raw);
  return value > 0 && Number.isFinite(value) ? value : null;
}

export function parseFuturesOrderRow(
  row: Record<string, unknown>,
): FuturesOrder {
  const filled = new Date(String(row.filled_at ?? "")).getTime();
  const action = String(row.action ?? "");
  return {
    id: String(row.id),
    positionId: String(row.position_id),
    action:
      action === "buy" || action === "sell" || action === "flatten"
        ? action
        : "buy",
    qty: Number(row.qty) || 0,
    price: Number(row.price) > 0 ? Number(row.price) : null,
    notionalUsdt: Number(row.notional_usdt) > 0 ? Number(row.notional_usdt) : null,
    venueOrderId: row.venue_order_id ? String(row.venue_order_id) : null,
    filledAtMs: Number.isFinite(filled) ? filled : 0,
    source: parseFuturesTradeSource(row.source),
    ruleName: String(row.rule_name ?? "").trim() || null,
  };
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
    leverage: asPositiveNumber(row.leverage),
    status: row.status === "closed" ? "closed" : "open",
    source: parseFuturesTradeSource(row.source),
    ruleId: String(row.rule_id ?? "").trim() || null,
    ruleName: String(row.rule_name ?? "").trim() || null,
    openedAtMs: Number.isFinite(opened) ? opened : 0,
    closedAtMs: Number.isFinite(closed) ? closed : null,
    venue: row.venue ? String(row.venue) : null,
    environment: row.environment ? String(row.environment) : null,
    takeProfit: Number(row.take_profit) > 0 ? Number(row.take_profit) : null,
    stopLoss: Number(row.stop_loss) > 0 ? Number(row.stop_loss) : null,
    tpTrigger: parseFuturesTriggerColumn(row.tp_trigger),
    slTrigger: parseFuturesTriggerColumn(row.sl_trigger),
    tpslMode: row.tpsl_mode === "partial" ? "partial" : "full",
    tpQty: Number(row.tp_qty) > 0 ? Number(row.tp_qty) : null,
    slQty: Number(row.sl_qty) > 0 ? Number(row.sl_qty) : null,
    tpOrderType: row.tp_order_type === "limit" ? "limit" : "market",
    slOrderType: row.sl_order_type === "limit" ? "limit" : "market",
    tpLimitPrice:
      Number(row.tp_limit_price) > 0 ? Number(row.tp_limit_price) : null,
    slLimitPrice:
      Number(row.sl_limit_price) > 0 ? Number(row.sl_limit_price) : null,
    trailingStop: Number(row.trailing_stop) > 0 ? Number(row.trailing_stop) : null,
    trailingActive:
      Number(row.trailing_active) > 0 ? Number(row.trailing_active) : null,
    trailingPeak: Number(row.trailing_peak) > 0 ? Number(row.trailing_peak) : null,
  };
}
