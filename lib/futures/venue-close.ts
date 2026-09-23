import type { FuturesSide } from "./model";

export type ClosingExecution = {
  fillPrice: number;
  closedQty: number;
  execTimeMs: number;
  side: "Buy" | "Sell";
  stopOrderType: string;
  orderLinkId: string;
  positionIdx?: number | null;
};

export type VenueCloseKind =
  | "take_profit"
  | "stop_loss"
  | "trailing"
  | "exit_if"
  | "venue";

const PRICE_NEAR = 0.002;

function priceNear(fill: number, level: number | null): boolean {
  if (level == null || !(level > 0) || !(fill > 0)) {
    return false;
  }
  return Math.abs(fill - level) / level <= PRICE_NEAR;
}

function normalizeStop(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s_-]/g, "");
}

export function executionStopLabel(
  stopOrderType: string,
  createType = "",
): string {
  const stop = stopOrderType.trim();
  if (stop && normalizeStop(stop) !== "unknown") {
    return stop;
  }
  const created = normalizeStop(createType);
  if (created.includes("takeprofit")) {
    return "TakeProfit";
  }
  if (created.includes("stoploss")) {
    return "StopLoss";
  }
  if (created.includes("trailing")) {
    return "TrailingStop";
  }
  return stop;
}

export function executionClosedQty(input: {
  closedSize: number;
  execQty: number;
  stopOrderType: string;
  createType?: string;
}): number {
  if (input.closedSize > 0) {
    return input.closedSize;
  }
  if (input.execQty > 0) {
    return input.execQty;
  }
  return 0;
}

export function closingPositionIdxMatches(
  side: FuturesSide,
  positionIdx: number | null | undefined,
): boolean {
  if (positionIdx == null || !Number.isFinite(positionIdx) || positionIdx === 0) {
    return true;
  }
  return side === "long" ? positionIdx === 1 : positionIdx === 2;
}

export function pickClosingFill(input: {
  executions: readonly ClosingExecution[];
  side: FuturesSide;
  openedAtMs: number;
  qty: number;
}): { fillPrice: number; stopOrderType: string; orderLinkId: string } | null {
  const want = input.side === "long" ? "Sell" : "Buy";
  const rows = input.executions
    .filter(
      (row) =>
        row.side === want &&
        closingPositionIdxMatches(input.side, row.positionIdx) &&
        row.closedQty > 0 &&
        row.fillPrice > 0 &&
        row.execTimeMs + 5_000 >= input.openedAtMs,
    )
    .sort((left, right) => right.execTimeMs - left.execTimeMs);
  if (rows.length === 0 || !(input.qty > 0)) {
    return null;
  }
  let qty = 0;
  let notional = 0;
  const used: ClosingExecution[] = [];
  for (const row of rows) {
    if (qty + 1e-12 >= input.qty) {
      break;
    }
    used.push(row);
    qty += row.closedQty;
    notional += row.fillPrice * row.closedQty;
  }
  const latest = used[0];
  if (!latest || !(qty > 0)) {
    return null;
  }
  const stops = new Set(
    used
      .map((row) => normalizeStop(row.stopOrderType))
      .filter((stop) => stop !== "" && stop !== "unknown"),
  );
  return {
    fillPrice: notional / qty,
    stopOrderType: stops.size === 1 ? [...stops][0] : latest.stopOrderType,
    orderLinkId: latest.orderLinkId,
  };
}

export function attributeClosingFill(input: {
  fillPrice: number;
  stopOrderType: string;
  orderLinkId: string;
  takeProfit: number | null;
  stopLoss: number | null;
  hasExitIf: boolean;
}): VenueCloseKind {
  const stop = normalizeStop(input.stopOrderType);
  if (stop === "takeprofit" || stop === "partialtakeprofit") {
    return "take_profit";
  }
  if (stop === "stoploss" || stop === "partialstoploss") {
    return "stop_loss";
  }
  if (stop === "trailingstop" || stop === "trailingprofit") {
    return "trailing";
  }
  const link = input.orderLinkId.trim().toLowerCase();
  if (/^d[a-f0-9]{8}[ls]tp/.test(link)) {
    return "take_profit";
  }
  if (/^d[a-f0-9]{8}[ls]sl/.test(link)) {
    return "stop_loss";
  }
  if (priceNear(input.fillPrice, input.takeProfit)) {
    return "take_profit";
  }
  if (priceNear(input.fillPrice, input.stopLoss)) {
    return "stop_loss";
  }
  if (input.hasExitIf) {
    return "exit_if";
  }
  return "venue";
}

export type KnownCloseKind = "take_profit" | "stop_loss" | "exit_if" | "trailing";

export function parseKnownCloseKind(value: unknown): KnownCloseKind | null {
  if (
    value === "take_profit" ||
    value === "stop_loss" ||
    value === "exit_if" ||
    value === "trailing"
  ) {
    return value;
  }
  return null;
}

export function futuresCloseMessage(input: {
  kind: KnownCloseKind | VenueCloseKind | null;
  symbol: string;
  side: string;
  closed: boolean;
}): string {
  const verb = input.closed ? "closed" : "reduced";
  if (input.kind === "take_profit") {
    return `Take profit ${verb} ${input.symbol} ${input.side}`;
  }
  if (input.kind === "stop_loss") {
    return `Stop loss ${verb} ${input.symbol} ${input.side}`;
  }
  if (input.kind === "exit_if") {
    return `Hard exit ${verb} ${input.symbol} ${input.side}`;
  }
  if (input.kind === "trailing") {
    return `Trailing stop ${verb} ${input.symbol} ${input.side}`;
  }
  if (input.kind === "venue") {
    return `Venue ${verb} ${input.symbol} ${input.side}`;
  }
  return input.closed
    ? `Closed ${input.symbol} ${input.side}`
    : `Reduced ${input.symbol} ${input.side}`;
}
