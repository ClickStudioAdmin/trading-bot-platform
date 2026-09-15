import { pathWithDesk, type TradingAccount } from "@/lib/accounts/model";
import { getVenue } from "@/lib/exchanges/venues";

export const CRITICAL_LOG_EVENTS = [
  "dca.sync_failed",
  "trade.futures_failed",
  "exchange.verify_failed",
] as const;

export function criticalFamily(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return cleaned || "desk";
}

export function repeatingOrderShouldNotify(recentCount: number): boolean {
  return recentCount >= 2;
}

export function criticalDeskHref(desk: TradingAccount): string {
  const base =
    desk.deskType === "cash_and_carry"
      ? "/strategies/cash-and-carry/activity"
      : "/strategies/futures/activity";
  return pathWithDesk(base, desk.id);
}

export function venueLabel(venueId: string): string {
  return getVenue(venueId)?.label ?? venueId;
}
