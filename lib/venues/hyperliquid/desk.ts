import {
  parseStoredVenueEnvironment,
  parseStoredVenueId,
} from "@/lib/exchanges/venues";
import { createServiceClient } from "@/lib/supabase/admin";

export async function loadDeskVenueContext(accountId: string): Promise<{
  venue: string;
  venueEnvironment: string | null;
}> {
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
  return {
    venue,
    venueEnvironment: parseStoredVenueEnvironment(
      venue,
      data?.venue_environment,
    ),
  };
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
