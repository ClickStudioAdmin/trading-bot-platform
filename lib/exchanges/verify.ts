import { verifyBybitCredentials } from "@/lib/exchanges/bybit/verify";

export function venueSupportsVerify(venueId: string): boolean {
  return venueId === "bybit";
}

export async function verifyExchangeCredentials(input: {
  venueId: string;
  environmentId: string;
  credentials: Record<string, string>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!venueSupportsVerify(input.venueId)) {
    return { ok: false, error: "That exchange cannot be verified yet." };
  }
  return verifyBybitCredentials(input.environmentId, input.credentials);
}
