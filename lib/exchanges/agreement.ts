export const BYBIT_AGREEMENT_NOTE = "Needs a Bybit agreement";

export type BybitAgreementKind = "tradfi" | "oil";

export type BybitAgreementGate = {
  symbols: readonly string[];
  cleared: readonly BybitAgreementKind[];
  live: boolean;
};

export const CLOSED_AGREEMENT_GATE: BybitAgreementGate = {
  symbols: [],
  cleared: [],
  live: false,
};

export function bybitAgreementKind(input: {
  symbolType?: string | null;
  baseCoin?: string | null;
}): BybitAgreementKind | null {
  const type = String(input.symbolType ?? "").trim().toLowerCase();
  const base = String(input.baseCoin ?? "").trim().toUpperCase();
  if (type === "stock") {
    return "tradfi";
  }
  if (type === "commodity") {
    return base === "CL" ? "oil" : "tradfi";
  }
  return null;
}

export function bybitAgreementKindTitle(kind: BybitAgreementKind): string {
  return kind === "oil" ? "Crude oil contracts" : "Stock and metal contracts";
}

export function perpNeedsBybitAgreement(
  gate: BybitAgreementGate | undefined,
  pair: {
    symbol: string;
    symbolType?: string | null;
    baseCoin?: string | null;
  },
): boolean {
  if (!gate) {
    return false;
  }
  const kind = bybitAgreementKind(pair);
  if (gate.live && kind && !gate.cleared.includes(kind)) {
    return true;
  }
  if (gate.live && kind && gate.cleared.includes(kind)) {
    return false;
  }
  return symbolNeedsBybitAgreement(gate.symbols, pair.symbol);
}

export function firstOpenPerp<
  T extends {
    symbol: string;
    symbolType?: string | null;
    baseCoin?: string | null;
  },
>(
  options: readonly T[],
  gate: BybitAgreementGate | undefined,
  preferred: string,
): string {
  const current = options.find((row) => row.symbol === preferred);
  if (current && !perpNeedsBybitAgreement(gate, current)) {
    return current.symbol;
  }
  const open = options.find((row) => !perpNeedsBybitAgreement(gate, row));
  return open?.symbol ?? preferred;
}

export function isBybitAgreementReject(message: string): boolean {
  return (
    /sign the required agreement before trading/i.test(message) ||
    /agree to the .+ trading terms before trading/i.test(message)
  );
}

export function isBybitAgreementQuiet(error: string): boolean {
  return error.trim() === BYBIT_AGREEMENT_NOTE;
}

export function symbolNeedsBybitAgreement(
  symbols: readonly string[] | undefined,
  symbol: string,
): boolean {
  if (!symbols || symbols.length === 0) {
    return false;
  }
  const needle = symbol.trim().toUpperCase();
  return symbols.some((row) => row.toUpperCase() === needle);
}
