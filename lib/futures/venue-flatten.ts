export function shouldFlattenLedgerToVenue(input: {
  ledgerQty: number;
  venueQty: number;
  openedAtMs: number;
  nowMs: number;
  minAgeMs: number;
  hasWorkingReduceOnly: boolean;
}): boolean {
  if (input.nowMs - input.openedAtMs < input.minAgeMs) {
    return false;
  }
  if (input.venueQty + 1e-12 >= input.ledgerQty) {
    return false;
  }
  if (input.venueQty <= 1e-12 && input.hasWorkingReduceOnly) {
    return false;
  }
  return true;
}

export function workingReduceOnlyCovers(input: {
  symbol: string;
  side: "long" | "short";
  working: ReadonlyArray<{
    symbol: string;
    side: "long" | "short";
    reduceOnly: boolean;
    status?: string;
  }>;
}): boolean {
  return input.working.some(
    (row) =>
      row.reduceOnly &&
      (row.status ?? "open") === "open" &&
      row.symbol === input.symbol &&
      row.side === input.side,
  );
}
