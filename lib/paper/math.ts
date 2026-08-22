export type ClosePaperCarryInput = {
  entryBasis: number;
  exitBasis: number;
  notionalUsdt: number;
  openedAtMs: number;
  closedAtMs: number;
};

export function carryPnlUsdt(
  entryBasis: number,
  currentBasis: number,
  notionalUsdt: number,
): number {
  if (!(notionalUsdt > 0)) {
    throw new Error("Notional must be positive");
  }
  if (!Number.isFinite(entryBasis) || !Number.isFinite(currentBasis)) {
    throw new Error("Basis must be finite");
  }
  return (entryBasis - currentBasis) * notionalUsdt;
}

export function daysHeld(openedAtMs: number, closedAtMs: number): number {
  return (closedAtMs - openedAtMs) / 86_400_000;
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
  );
  const heldDays = daysHeld(input.openedAtMs, input.closedAtMs);
  return {
    realizedUsdt,
    daysHeld: heldDays,
    realizedApr: realizedApr(realizedUsdt, input.notionalUsdt, heldDays),
  };
}
