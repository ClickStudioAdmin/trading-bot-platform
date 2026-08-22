import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import {
  automationInsertColumns,
  type PaperCarryAutomation,
  type TradeSource,
} from "@/lib/paper/automation";

export const DEFAULT_PAPER_NOTIONAL_USDT = 10_000;

export type PaperReturnPath =
  | "/strategies/cash-and-carry"
  | "/strategies/cash-and-carry/opportunities"
  | "/strategies/cash-and-carry/positions";

export type OpportunityPaperProps = {
  signedIn: boolean;
  next: PaperReturnPath;
};

export function pairKey(spotSymbol: string, futureSymbol: string): string {
  return `${spotSymbol}|${futureSymbol}`;
}

export function formatNotionalInput(raw: string): string {
  return formatGroupedNumberInput(raw, false);
}

export function formatGroupedNumberInput(
  raw: string,
  allowDecimal = false,
): string {
  if (!allowDecimal) {
    const digits = raw.replace(/\D/g, "");
    if (digits === "") {
      return "";
    }
    return Number(digits).toLocaleString("en-US");
  }

  const stripped = raw.replace(/[^\d.]/g, "");
  if (stripped === "") {
    return "";
  }
  if (stripped === ".") {
    return "0.";
  }
  const hasDot = stripped.includes(".");
  const [wholeRaw = "", ...rest] = stripped.split(".");
  const fraction = rest.join("");
  const wholeDigits = wholeRaw === "" ? "0" : wholeRaw;
  const grouped = Number(wholeDigits).toLocaleString("en-US");
  if (!Number.isFinite(Number(wholeDigits))) {
    return "";
  }
  return hasDot ? `${grouped}.${fraction}` : grouped;
}

export function parseNotionalUsdt(raw: string): number | null {
  const value = Number(raw.replace(/,/g, "").trim());
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

export function maxPaperNotionalUsdt(capacityUsdt: number): number {
  if (!(capacityUsdt > 0) || !Number.isFinite(capacityUsdt)) {
    return 0;
  }
  return Math.floor(capacityUsdt);
}

export function notionalFitsBook(
  notionalUsdt: number,
  capacityUsdt: number,
): boolean {
  const max = maxPaperNotionalUsdt(capacityUsdt);
  return notionalUsdt > 0 && max > 0 && notionalUsdt <= max;
}

export function clampNotionalInput(raw: string, maxUsdt: number): string {
  const formatted = formatNotionalInput(raw);
  const parsed = parseNotionalUsdt(formatted);
  if (parsed === null) {
    return formatted;
  }
  const max = maxPaperNotionalUsdt(maxUsdt);
  if (max <= 0) {
    return "";
  }
  if (parsed > max) {
    return formatNotionalInput(String(max));
  }
  return formatted;
}

export function firstSearchValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function safePaperReturnPath(raw: string): PaperReturnPath {
  if (raw === "/strategies/cash-and-carry/positions") {
    return raw;
  }
  if (
    raw === "/strategies/cash-and-carry" ||
    raw === "/strategies/universe" ||
    raw === "/universe" ||
    raw === "/cash-and-carry"
  ) {
    return "/strategies/cash-and-carry";
  }
  return "/strategies/cash-and-carry/opportunities";
}

export function paperCarryInsertRow(
  userId: string,
  opportunity: ScannedOpportunity,
  notionalUsdt: number,
  extras?: {
    automation?: PaperCarryAutomation;
    source?: TradeSource;
    ruleId?: number | null;
  },
) {
  if (!(notionalUsdt > 0)) {
    throw new Error("Notional must be positive");
  }
  return {
    user_id: userId,
    base_coin: opportunity.baseCoin,
    spot_symbol: opportunity.spotSymbol,
    future_symbol: opportunity.futureSymbol,
    delivery_time: new Date(opportunity.deliveryTimeMs).toISOString(),
    notional_usdt: notionalUsdt,
    entry_basis: opportunity.netBasis,
    status: "open" as const,
    source: extras?.source ?? "manual",
    rule_id: extras?.ruleId ?? null,
    ...(extras?.automation ? automationInsertColumns(extras.automation) : {}),
  };
}
