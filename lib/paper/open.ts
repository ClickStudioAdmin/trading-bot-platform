import type { ScannedOpportunity } from "@/lib/opportunities/scan";

export const DEFAULT_PAPER_NOTIONAL_USDT = 10_000;

export type OpportunityPaperProps = {
  signedIn: boolean;
  openKeys: Set<string>;
  next: "/strategies/universe" | "/strategies/universe/opportunities";
};

export function pairKey(spotSymbol: string, futureSymbol: string): string {
  return `${spotSymbol}|${futureSymbol}`;
}

export function formatNotionalInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") {
    return "";
  }
  return Number(digits).toLocaleString("en-US");
}

export function parseNotionalUsdt(raw: string): number | null {
  const value = Number(raw.replace(/,/g, "").trim());
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

export function firstSearchValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function safePaperReturnPath(
  raw: string,
): "/strategies/universe" | "/strategies/universe/opportunities" {
  if (
    raw === "/strategies/universe" ||
    raw === "/universe" ||
    raw === "/cash-and-carry"
  ) {
    return "/strategies/universe";
  }
  return "/strategies/universe/opportunities";
}

export function paperCarryInsertRow(
  userId: string,
  opportunity: ScannedOpportunity,
  notionalUsdt: number,
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
  };
}
