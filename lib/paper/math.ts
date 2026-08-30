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
    throw new Error("Value must be positive");
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

export function blendEntryBasis(
  currentNotionalUsdt: number,
  currentEntryBasis: number,
  clipUsdt: number,
  clipBasis: number,
): number {
  if (!(currentNotionalUsdt > 0) || !(clipUsdt > 0)) {
    throw new Error("Value must be positive");
  }
  if (!Number.isFinite(currentEntryBasis) || !Number.isFinite(clipBasis)) {
    throw new Error("Basis must be finite");
  }
  return (
    (currentEntryBasis * currentNotionalUsdt + clipBasis * clipUsdt) /
    (currentNotionalUsdt + clipUsdt)
  );
}

export function weightedOpenFillBasis(
  clips: { notionalUsdt: number; fillBasis: number }[],
): number | null {
  let notional = 0;
  let weighted = 0;
  for (const clip of clips) {
    if (!(clip.notionalUsdt > 0) || !Number.isFinite(clip.fillBasis)) {
      continue;
    }
    notional += clip.notionalUsdt;
    weighted += clip.fillBasis * clip.notionalUsdt;
  }
  if (!(notional > 0)) {
    return null;
  }
  return weighted / notional;
}

export function clipPnl(input: {
  entryBasis: number;
  fillBasis: number;
  notionalUsdt: number;
  feeRate: number | null;
}): { usdt: number; pct: number } | null {
  if (input.feeRate === null) {
    return null;
  }
  const usdt = carryPnlUsdt(
    input.entryBasis,
    input.fillBasis,
    input.notionalUsdt,
    input.feeRate,
  );
  return { usdt, pct: carryPnlPct(usdt, input.notionalUsdt) };
}

export function carryPnlPct(pnlUsdt: number, notionalUsdt: number): number {
  if (!(notionalUsdt > 0)) {
    throw new Error("Value must be positive");
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
