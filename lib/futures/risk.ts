import type { FuturesSide } from "./model";

export type FuturesRiskCaps = {
  maxQtyPerSymbol: number | null;
  maxNotionalPerSymbol: number | null;
  maxOpenRows: number | null;
};

export type FuturesRiskOpen = {
  symbol: string;
  side: FuturesSide;
  qty: number;
  notionalUsdt: number;
};

export type FuturesRiskWorking = {
  symbol: string;
  side: FuturesSide;
  remainingQty: number;
  limitPrice: number;
  reduceOnly: boolean;
};

function rowKey(symbol: string, side: FuturesSide): string {
  return `${symbol}:${side}`;
}

export function parseOptionalPositive(
  raw: unknown,
  label: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (text === "") {
    return { ok: true, value: null };
  }
  const value = Number(text);
  if (!(value > 0) || !Number.isFinite(value)) {
    return { ok: false, error: `${label} must be a positive number, or empty.` };
  }
  return { ok: true, value };
}

export function parseOptionalPositiveInt(
  raw: unknown,
  label: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const parsed = parseOptionalPositive(raw, label);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.value !== null && !Number.isInteger(parsed.value)) {
    return { ok: false, error: `${label} must be a whole number, or empty.` };
  }
  return parsed;
}

export function checkFuturesRiskCaps(input: {
  caps: FuturesRiskCaps;
  symbol: string;
  side: FuturesSide;
  orderQty: number;
  orderNotional: number;
  opens: FuturesRiskOpen[];
  working: FuturesRiskWorking[];
}): { ok: true } | { ok: false; error: string } {
  const entries = input.working.filter((row) => !row.reduceOnly);
  const keys = new Set<string>();
  for (const row of input.opens) {
    keys.add(rowKey(row.symbol, row.side));
  }
  for (const row of entries) {
    keys.add(rowKey(row.symbol, row.side));
  }
  const thisKey = rowKey(input.symbol, input.side);
  if (
    input.caps.maxOpenRows !== null &&
    !keys.has(thisKey) &&
    keys.size >= input.caps.maxOpenRows
  ) {
    return {
      ok: false,
      error: `Max open rows is ${input.caps.maxOpenRows}. Close or cancel before opening another.`,
    };
  }

  const sameSideQty =
    input.opens
      .filter((row) => row.symbol === input.symbol && row.side === input.side)
      .reduce((sum, row) => sum + row.qty, 0) +
    entries
      .filter((row) => row.symbol === input.symbol && row.side === input.side)
      .reduce((sum, row) => sum + row.remainingQty, 0);
  const nextQty = sameSideQty + input.orderQty;
  if (
    input.caps.maxQtyPerSymbol !== null &&
    nextQty > input.caps.maxQtyPerSymbol + 1e-12
  ) {
    return {
      ok: false,
      error: `Max qty for this contract is ${input.caps.maxQtyPerSymbol}. This order would take it to ${nextQty}.`,
    };
  }

  const sameSideNotional =
    input.opens
      .filter((row) => row.symbol === input.symbol && row.side === input.side)
      .reduce((sum, row) => sum + row.notionalUsdt, 0) +
    entries
      .filter((row) => row.symbol === input.symbol && row.side === input.side)
      .reduce((sum, row) => sum + row.remainingQty * row.limitPrice, 0);
  const nextNotional = sameSideNotional + input.orderNotional;
  if (
    input.caps.maxNotionalPerSymbol !== null &&
    nextNotional > input.caps.maxNotionalPerSymbol + 1e-8
  ) {
    return {
      ok: false,
      error: `Max notional for this contract is ${input.caps.maxNotionalPerSymbol} USDT. This order would take it to ${Math.round(nextNotional)} USDT.`,
    };
  }

  return { ok: true };
}
