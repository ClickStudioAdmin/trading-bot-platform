import { normalizeAddress } from "@/lib/exchanges/hyperliquid/agent";

export function parseBybitVenueAccountId(info: {
  userID?: unknown;
  userId?: unknown;
  uid?: unknown;
}): string | null {
  const raw = info.userID ?? info.userId ?? info.uid;
  const text = String(raw ?? "").trim();
  if (!/^\d{4,32}$/.test(text)) {
    return null;
  }
  return text;
}

export function parseHyperliquidVenueAccountId(
  accountAddress: unknown,
): string | null {
  return normalizeAddress(accountAddress);
}

export function exclusiveVenueAccountError(input: {
  venueId: string;
  existing?: { id: string } | null;
}): string | null {
  if (!input.existing) {
    return null;
  }
  if (input.venueId === "bybit") {
    return "That Bybit account is already connected on this login. Use a key from a different subaccount.";
  }
  if (input.venueId === "hyperliquid") {
    return "That Hyperliquid account is already connected on this login. Use a different wallet.";
  }
  return "That exchange account is already connected on this login. Use a key from a different account.";
}

export function uniqueConnectionWriteError(
  error: { code?: string; message?: string; details?: string },
  kind: "insert" | "replace",
): string | null {
  if (error.code !== "23505") {
    return null;
  }
  const blob = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  if (blob.includes("venue_account")) {
    return "That exchange account is already connected on this login. Use a key from a different account.";
  }
  if (kind === "replace") {
    return "That key is already saved on another connection. Remove the other one first, or paste this same key again.";
  }
  return "That key is already saved. Pick it on a desk, or add a different key.";
}
