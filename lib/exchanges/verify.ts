import { verifyBybitCredentials } from "@/lib/exchanges/bybit/verify";
import { verifyHyperliquidCredentials } from "@/lib/exchanges/hyperliquid/verify";

export function venueSupportsVerify(venueId: string): boolean {
  return venueId === "bybit" || venueId === "hyperliquid";
}

export async function verifyExchangeCredentials(input: {
  venueId: string;
  environmentId: string;
  credentials: Record<string, string>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.venueId === "bybit") {
    return verifyBybitCredentials(input.environmentId, input.credentials);
  }
  if (input.venueId === "hyperliquid") {
    return verifyHyperliquidCredentials(input.environmentId, input.credentials);
  }
  return { ok: false, error: "That exchange cannot be verified yet." };
}
