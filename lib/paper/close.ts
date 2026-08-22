import { carryPnlUsdt, daysHeld, realizedApr } from "@/lib/paper/math";

export type PriorCloseClip = {
  notionalUsdt: number;
  fillBasis: number;
  feeRate: number | null;
};

export type CloseClipPlan =
  | { kind: "partial"; remainingUsdt: number }
  | {
      kind: "flat";
      openedNotionalUsdt: number;
      realizedUsdt: number;
      exitBasis: number;
      daysHeld: number;
      realizedApr: number | null;
    };

export function closeClipPlan(input: {
  remainingUsdt: number;
  clipUsdt: number;
  priorCloses: PriorCloseClip[];
  entryBasis: number;
  exitBasis: number;
  feeRate: number;
  openedAtMs: number;
  closedAtMs: number;
}): CloseClipPlan {
  if (!(input.clipUsdt > 0) || input.clipUsdt > input.remainingUsdt) {
    throw new Error("Close clip must be within remaining size.");
  }

  const remainingUsdt = input.remainingUsdt - input.clipUsdt;
  if (remainingUsdt > 0) {
    return { kind: "partial", remainingUsdt };
  }

  const clips = [
    ...input.priorCloses,
    {
      notionalUsdt: input.clipUsdt,
      fillBasis: input.exitBasis,
      feeRate: input.feeRate,
    },
  ];
  const openedNotionalUsdt = clips.reduce(
    (sum, clip) => sum + clip.notionalUsdt,
    0,
  );
  const realizedUsdt = clips.reduce(
    (sum, clip) =>
      sum +
      carryPnlUsdt(
        input.entryBasis,
        clip.fillBasis,
        clip.notionalUsdt,
        clip.feeRate ?? input.feeRate,
      ),
    0,
  );
  const weightedExit =
    clips.reduce((sum, clip) => sum + clip.fillBasis * clip.notionalUsdt, 0) /
    openedNotionalUsdt;
  const heldDays = daysHeld(input.openedAtMs, input.closedAtMs);
  return {
    kind: "flat",
    openedNotionalUsdt,
    realizedUsdt,
    exitBasis: weightedExit,
    daysHeld: heldDays,
    realizedApr: realizedApr(realizedUsdt, openedNotionalUsdt, heldDays),
  };
}
