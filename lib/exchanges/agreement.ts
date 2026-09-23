export const BYBIT_AGREEMENT_NOTE = "Needs a Bybit agreement";

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
