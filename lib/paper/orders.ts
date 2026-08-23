import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import {
  automationInsertColumns,
  formatEntryTriggers,
  formatExitTriggers,
  formatSourceWord,
  parseCloseReason,
  parseEntrySizeType,
  parseTradeSource,
  type CloseReason,
  type PaperCarryAutomation,
  type TradeSource,
} from "@/lib/paper/automation";
import { asNumber, asNullableNumber, type PaperCarryRow } from "@/lib/paper/rows";

export type PaperOrderSide = "open" | "close";

export type PaperOrderTheoretical = {
  netBasis: number | null;
  netApr: number | null;
  daysToExpiry: number | null;
  capacityUsdt: number | null;
  executableBasis: number | null;
  spotAsk: number | null;
  futureBid: number | null;
  feeRate: number | null;
};

export type PaperOrderRow = {
  id: number;
  carryId: number;
  side: PaperOrderSide;
  source: TradeSource;
  triggerReason: CloseReason | null;
  notionalUsdt: number;
  filledAtMs: number;
  fillBasis: number;
  theoretical: PaperOrderTheoretical;
  conditions: PaperCarryAutomation;
};

export type PaperCarryWithOrders = PaperCarryRow & {
  orders: PaperOrderRow[];
};

export function parseOrderSide(value: unknown): PaperOrderSide {
  return value === "close" ? "close" : "open";
}

export function scanSnapshot(
  opportunity: ScannedOpportunity,
): PaperOrderTheoretical {
  return {
    netBasis: opportunity.netBasis,
    netApr: opportunity.netApr,
    daysToExpiry: opportunity.daysToExpiry,
    capacityUsdt: opportunity.capacityUsdt,
    executableBasis: opportunity.executableBasis,
    spotAsk: opportunity.spotAsk,
    futureBid: opportunity.futureBid,
    feeRate: opportunity.feeRate,
  };
}

export function paperOrderInsertRow(input: {
  userId: string;
  carryId: number;
  side: PaperOrderSide;
  source: TradeSource;
  triggerReason: CloseReason | null;
  notionalUsdt: number;
  filledAt: Date;
  opportunity: ScannedOpportunity;
  automation: PaperCarryAutomation;
}) {
  if (!(input.notionalUsdt > 0)) {
    throw new Error("Notional must be positive");
  }
  return {
    user_id: input.userId,
    carry_id: input.carryId,
    side: input.side,
    source: input.source,
    trigger_reason: input.triggerReason,
    notional_usdt: input.notionalUsdt,
    filled_at: input.filledAt.toISOString(),
    fill_basis: input.opportunity.netBasis,
    theo_net_basis: input.opportunity.netBasis,
    theo_net_apr: input.opportunity.netApr,
    theo_days_to_expiry: input.opportunity.daysToExpiry,
    theo_capacity_usdt: input.opportunity.capacityUsdt,
    theo_executable_basis: input.opportunity.executableBasis,
    theo_spot_ask: input.opportunity.spotAsk,
    theo_future_bid: input.opportunity.futureBid,
    theo_fee_rate: input.opportunity.feeRate,
    ...automationInsertColumns(input.automation),
  };
}

export function parsePaperOrderRow(row: Record<string, unknown>): PaperOrderRow {
  const filledAt = new Date(String(row.filled_at));
  return {
    id: asNumber(row.id),
    carryId: asNumber(row.carry_id),
    side: parseOrderSide(row.side),
    source: parseTradeSource(row.source),
    triggerReason: parseCloseReason(row.trigger_reason),
    notionalUsdt: asNumber(row.notional_usdt),
    filledAtMs: filledAt.getTime(),
    fillBasis: asNumber(row.fill_basis),
    theoretical: {
      netBasis: asNullableNumber(row.theo_net_basis),
      netApr: asNullableNumber(row.theo_net_apr),
      daysToExpiry: asNullableNumber(row.theo_days_to_expiry),
      capacityUsdt: asNullableNumber(row.theo_capacity_usdt),
      executableBasis: asNullableNumber(row.theo_executable_basis),
      spotAsk: asNullableNumber(row.theo_spot_ask),
      futureBid: asNullableNumber(row.theo_future_bid),
      feeRate: asNullableNumber(row.theo_fee_rate),
    },
    conditions: {
      entrySizeType: parseEntrySizeType(row.entry_size_type),
      exitSizeType: parseEntrySizeType(row.exit_size_type),
      entryMinNetApr: asNullableNumber(row.entry_min_net_apr),
      entryMinDte: asNullableNumber(row.entry_min_dte),
      entryMaxDte: asNullableNumber(row.entry_max_dte),
      entryMinCapacityUsdt: asNullableNumber(row.entry_min_capacity_usdt),
      entryMinSizeUsdt: asNullableNumber(row.entry_min_size_usdt),
      entryMaxOpenNotionalUsdt: asNullableNumber(
        row.entry_max_open_notional_usdt,
      ),
      closeMaxDte: asNullableNumber(row.close_max_dte),
      closeMinNetApr: asNullableNumber(row.close_min_net_apr),
      takeProfitPct: asNullableNumber(row.take_profit_pct),
      stopLossPct: asNullableNumber(row.stop_loss_pct),
    },
  };
}

export function synthesizeOrders(carry: PaperCarryRow): PaperOrderRow[] {
  const orders: PaperOrderRow[] = [
    {
      id: -(carry.id * 10 + 1),
      carryId: carry.id,
      side: "open",
      source: carry.source,
      triggerReason: null,
      notionalUsdt: carry.notionalUsdt,
      filledAtMs: carry.openedAtMs,
      fillBasis: carry.entryBasis,
      theoretical: {
        netBasis: carry.entryBasis,
        netApr: null,
        daysToExpiry: null,
        capacityUsdt: null,
        executableBasis: null,
        spotAsk: null,
        futureBid: null,
        feeRate: null,
      },
      conditions: carry.automation,
    },
  ];

  if (
    carry.status === "closed" &&
    carry.exitBasis !== null &&
    carry.closedAtMs !== null
  ) {
    orders.push({
      id: -(carry.id * 10 + 2),
      carryId: carry.id,
      side: "close",
      source: carry.closeSource ?? "manual",
      triggerReason: carry.closeReason,
      notionalUsdt: carry.notionalUsdt,
      filledAtMs: carry.closedAtMs,
      fillBasis: carry.exitBasis,
      theoretical: {
        netBasis: carry.exitBasis,
        netApr: null,
        daysToExpiry: null,
        capacityUsdt: null,
        executableBasis: null,
        spotAsk: null,
        futureBid: null,
        feeRate: null,
      },
      conditions: carry.automation,
    });
  }

  return orders;
}

export function groupOrdersByCarry(
  orders: PaperOrderRow[],
): Map<number, PaperOrderRow[]> {
  const grouped = new Map<number, PaperOrderRow[]>();
  for (const order of orders) {
    const list = grouped.get(order.carryId) ?? [];
    list.push(order);
    grouped.set(order.carryId, list);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.filledAtMs - b.filledAtMs || a.id - b.id);
  }
  return grouped;
}

export function ordersForCarry(
  carry: PaperCarryRow,
  stored: PaperOrderRow[],
): PaperOrderRow[] {
  return stored.length > 0 ? stored : synthesizeOrders(carry);
}

export function attachOrders<T extends PaperCarryRow>(
  rows: T[],
  stored: PaperOrderRow[],
): (T & { orders: PaperOrderRow[] })[] {
  const grouped = groupOrdersByCarry(stored);
  return rows.map((row) => ({
    ...row,
    orders: ordersForCarry(row, grouped.get(row.id) ?? []),
  }));
}

export function formatOrderSide(side: PaperOrderSide): string {
  return side === "close" ? "Close" : "Open";
}

export function formatOrderWhy(order: PaperOrderRow): string {
  if (order.side === "open") {
    return order.source === "engine"
      ? "Opened automatically. All entry conditions were true."
      : "Opened manually.";
  }
  return formatCloseOrderWhy(order);
}

export function formatCloseTrigger(order: PaperOrderRow): "Manual" | "System" {
  return order.source === "engine" ? "System" : "Manual";
}

export function formatCloseExitMethod(order: PaperOrderRow): "Manual" | "System" {
  if (order.source === "engine") {
    return "System";
  }
  if (
    order.conditions.exitSizeType === "dynamic" ||
    order.conditions.exitSizeType === "fixed"
  ) {
    return "System";
  }
  return "Manual";
}

export function formatCloseHowMuch(order: PaperOrderRow): string | null {
  if (
    order.triggerReason === "unwind" ||
    order.conditions.exitSizeType === "dynamic"
  ) {
    return "Scale out";
  }
  if (
    order.conditions.exitSizeType === "fixed" ||
    order.triggerReason === null
  ) {
    return "Flatten";
  }
  return null;
}

export function formatCloseOrderWhy(order: PaperOrderRow): string {
  const parts = [
    `Trigger ${formatCloseTrigger(order)}`,
    `Exit ${formatCloseExitMethod(order)}`,
  ];
  const howMuch = formatCloseHowMuch(order);
  if (howMuch) {
    parts.push(howMuch);
  }
  if (order.source === "engine") {
    if (order.triggerReason === "dte") {
      parts.push("DTE");
    } else if (order.triggerReason === "mark_apr") {
      parts.push("Mark APR");
    } else if (order.triggerReason === "take_profit") {
      parts.push("Take profit");
    } else if (order.triggerReason === "stop_loss") {
      parts.push("Stop loss");
    }
  }
  return parts.join(" · ");
}

export function formatOrderConditions(order: PaperOrderRow): string[] {
  return order.side === "open"
    ? formatEntryTriggers(order.conditions)
    : formatExitTriggers(order.conditions);
}

export function formatOrderHeadline(order: PaperOrderRow): string {
  if (order.side === "close") {
    return "Close";
  }
  return `${formatOrderSide(order.side)} · ${formatSourceWord(order.source)}`;
}

export function fillSlip(order: PaperOrderRow): number | null {
  if (order.theoretical.netBasis === null) {
    return null;
  }
  return order.fillBasis - order.theoretical.netBasis;
}
