export type ClosePaperCarryInput = {
  entryBasis: number;
  exitBasis: number;
  notionalUsdt: number;
  feeRate: number;
  openedAtMs: number;
  closedAtMs: number;
};

export function carryPnlUsdt(
  entryBasis: number,
  currentBasis: number,
  notionalUsdt: number,
  feeRate: number,
): number {
  if (!(notionalUsdt > 0)) {
    throw new Error("Notional must be positive");
  }
  if (
    !Number.isFinite(entryBasis) ||
    !Number.isFinite(currentBasis) ||
    !Number.isFinite(feeRate)
  ) {
    throw new Error("Basis must be finite");
  }
  if (feeRate < 0) {
    throw new Error("Fee rate cannot be negative");
  }
  // Entry and mark are both net, so one fee haircut cancels. Subtract twice
  // the scan fee rate so open and close (both legs + slip) stay in P&L.
  return (entryBasis - currentBasis - 2 * feeRate) * notionalUsdt;
}

export function daysHeld(openedAtMs: number, closedAtMs: number): number {
  return (closedAtMs - openedAtMs) / 86_400_000;
}

export function carryPnlPct(pnlUsdt: number, notionalUsdt: number): number {
  if (!(notionalUsdt > 0)) {
    throw new Error("Notional must be positive");
  }
  if (!Number.isFinite(pnlUsdt)) {
    throw new Error("P&L must be finite");
  }
  return pnlUsdt / notionalUsdt;
}

export function realizedApr(
  realizedUsdt: number,
  notionalUsdt: number,
  heldDays: number,
): number | null {
  if (!(notionalUsdt > 0) || !(heldDays > 0)) {
    return null;
  }
  return (realizedUsdt / notionalUsdt) * (365 / heldDays);
}

export function closePaperCarry(input: ClosePaperCarryInput) {
  const realizedUsdt = carryPnlUsdt(
    input.entryBasis,
    input.exitBasis,
    input.notionalUsdt,
    input.feeRate,
  );
  const heldDays = daysHeld(input.openedAtMs, input.closedAtMs);
  return {
    realizedUsdt,
    daysHeld: heldDays,
    realizedApr: realizedApr(realizedUsdt, input.notionalUsdt, heldDays),
  };
}
