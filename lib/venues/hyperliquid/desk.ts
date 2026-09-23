import {
  parseStoredVenueEnvironment,
  parseStoredVenueId,
} from "@/lib/exchanges/venues";
import { createServiceClient } from "@/lib/supabase/admin";

const VENUE_CONTEXT_TTL_MS = 60_000;
const venueContextCache = new Map<
  string,
  { at: number; venue: string; venueEnvironment: string | null }
>();

export async function loadDeskVenueContext(accountId: string): Promise<{
  venue: string;
  venueEnvironment: string | null;
}> {
  const hit = venueContextCache.get(accountId);
  if (hit && Date.now() - hit.at < VENUE_CONTEXT_TTL_MS) {
    return { venue: hit.venue, venueEnvironment: hit.venueEnvironment };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { venue: "bybit", venueEnvironment: null };
  }
  const { data } = await supabase
    .from("trading_accounts")
    .select("venue, venue_environment")
    .eq("id", accountId)
    .maybeSingle();
  const venue = parseStoredVenueId(data?.venue);
  const value = {
    venue,
    venueEnvironment: parseStoredVenueEnvironment(
      venue,
      data?.venue_environment,
    ),
  };
  venueContextCache.set(accountId, { at: Date.now(), ...value });
  return value;
}

export function deskIsHyperliquid(venue: string): boolean {
  return venue === "hyperliquid";
}

export function hyperliquidInfoEnvironment(
  venueEnvironment: string | null | undefined,
): string {
  if (venueEnvironment === "testnet" || venueEnvironment === "demo") {
    return "testnet";
  }
  return "live";
}
