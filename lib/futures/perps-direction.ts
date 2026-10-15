import { getVenue } from "@/lib/exchanges/venues";
import type { FuturesAction, FuturesSide } from "./model";

export type PerpsDirection = "long" | "short" | "both";

export function venueAllowsPerpsBoth(venueId: string): boolean {
  return getVenue(venueId)?.dcaBoth === true;
}

export function perpsDirectionFromAction(
  action: FuturesAction,
  closeSide: FuturesSide | null,
): PerpsDirection {
  if (action === "sell" || closeSide === "short") {
    return "short";
  }
  return "long";
}

export function parsePerpsDirection(raw: unknown): PerpsDirection | null {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "long" || value === "short" || value === "both") {
    return value;
  }
  return null;
}

export function perpsDirectionLabel(
  direction: PerpsDirection | "close_long" | "close_short",
): string {
  if (direction === "short") return "Short";
  if (direction === "both") return "Both";
  if (direction === "close_long") return "Close long";
  if (direction === "close_short") return "Close short";
  return "Long";
}


