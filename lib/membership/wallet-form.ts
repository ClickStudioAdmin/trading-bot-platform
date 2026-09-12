import { isEvmAddress } from "./hd";
import { parseTokenKind, type TokenKind } from "./wallet";

export const BILLING_FIELD_CLASS =
  "mt-1 w-full rounded-control border border-line bg-surface-raised px-3 py-2 text-sm text-ink focus:border-line-strong focus:outline-none";

export function parseChainName(value: unknown): string | null {
  const name = String(value ?? "").trim();
  return name.length >= 2 && name.length <= 80 ? name : null;
}

export function parseRpcUrl(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (raw.length < 8 || raw.length > 300) {
    return null;
  }
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

export function parseExplorerUrl(value: unknown): string | null | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  return parseRpcUrl(raw) ?? undefined;
}

export function parseConfirmations(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 128) {
    return null;
  }
  return n;
}

export function parseOptionalAddress(value: unknown): string | null | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }
  return isEvmAddress(raw) ? raw.toLowerCase() : undefined;
}

export function parseRequiredAddress(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return isEvmAddress(raw) ? raw.toLowerCase() : null;
}

export function parseTokenSymbol(value: unknown): string | null {
  const symbol = String(value ?? "").trim().toUpperCase();
  return symbol.length >= 1 && symbol.length <= 16 ? symbol : null;
}

export function parseTokenDecimals(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 36) {
    return null;
  }
  return n;
}

export function parseRequiredTokenKind(value: unknown): TokenKind | null {
  return parseTokenKind(value);
}

export function parseUuid(value: unknown): string | null {
  const id = String(value ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  return id;
}
