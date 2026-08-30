import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import {
  hrefPathname,
  withDeskFrom,
} from "@/lib/accounts/model";
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
  canOpen: boolean;
  venueOpen: boolean;
  next: string;
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
    return groupThousands(digits);
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
  if (!Number.isFinite(Number(wholeDigits))) {
    return "";
  }
  const grouped = groupThousands(wholeDigits);
  return hasDot ? `${grouped}.${fraction}` : grouped;
}

function groupThousands(digits: string): string {
  const normalized = String(Number(digits));
  if (!Number.isFinite(Number(normalized))) {
    return "";
  }
  const [whole = "0"] = normalized.split(".");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function parseTypedDecimalInput(
  raw: string,
): { incomplete: true } | { incomplete: false; value: number | null } {
  const text = raw.replace(/,/g, "").trim();
  if (text === "") {
    return { incomplete: false, value: null };
  }
  if (text.endsWith(".") || text === "-" || text === "-.") {
    return { incomplete: true };
  }
  const value = Number(text);
  if (!Number.isFinite(value)) {
    return { incomplete: true };
  }
  return { incomplete: false, value };
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

export function clipNotionalToBook(
  notionalUsdt: number,
  capacityUsdt: number,
): number | null {
  const max = maxPaperNotionalUsdt(capacityUsdt);
  if (!(notionalUsdt > 0) || max <= 0) {
    return null;
  }
  if (notionalUsdt <= max) {
    return notionalUsdt;
  }
  // Usable book is shown as a whole dollar. Rounding the label, or a live
  // book sitting $1 under the stored row, should still open at the floor.
  if (notionalUsdt <= Math.max(Math.round(capacityUsdt), max + 1)) {
    return max;
  }
  return null;
}

export function notionalFitsBook(
  notionalUsdt: number,
  capacityUsdt: number,
): boolean {
  return clipNotionalToBook(notionalUsdt, capacityUsdt) !== null;
}

export function sizeOpenNotional(
  requestedUsdt: number,
  liveUsableUsdt: number,
  shownUsableUsdt: number | null,
): number | null {
  const fromLive = clipNotionalToBook(requestedUsdt, liveUsableUsdt);
  if (fromLive !== null) {
    return fromLive;
  }
  if (
    shownUsableUsdt === null ||
    clipNotionalToBook(requestedUsdt, shownUsableUsdt) === null
  ) {
    return null;
  }
  const liveMax = maxPaperNotionalUsdt(liveUsableUsdt);
  return liveMax > 0 ? liveMax : null;
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

export function safePaperReturnPath(raw: string): string {
  const pathname = hrefPathname(raw);
  let base: PaperReturnPath;
  if (pathname === "/strategies/cash-and-carry/positions") {
    base = pathname;
  } else if (
    pathname === "/strategies/cash-and-carry" ||
    pathname === "/strategies/universe" ||
    pathname === "/universe" ||
    pathname === "/cash-and-carry"
  ) {
    base = "/strategies/cash-and-carry";
  } else {
    base = "/strategies/cash-and-carry/opportunities";
  }
  return withDeskFrom(base, raw);
}

export function paperCarryInsertRow(
  userId: string,
  opportunity: ScannedOpportunity,
  notionalUsdt: number,
  extras?: {
    accountId?: string;
    automation?: PaperCarryAutomation;
    source?: TradeSource;
    ruleId?: number | null;
    ruleName?: string | null;
    entryBasis?: number;
  },
) {
  if (!(notionalUsdt > 0)) {
    throw new Error("Value must be positive");
  }
  return {
    user_id: userId,
    account_id: extras?.accountId ?? null,
    base_coin: opportunity.baseCoin,
    spot_symbol: opportunity.spotSymbol,
    future_symbol: opportunity.futureSymbol,
    delivery_time: new Date(opportunity.deliveryTimeMs).toISOString(),
    notional_usdt: notionalUsdt,
    entry_basis: extras?.entryBasis ?? opportunity.netBasis,
    status: "open" as const,
    source: extras?.source ?? "manual",
    rule_id: extras?.ruleId ?? null,
    rule_name: extras?.ruleName ?? null,
    ...(extras?.automation ? automationInsertColumns(extras.automation) : {}),
  };
}
