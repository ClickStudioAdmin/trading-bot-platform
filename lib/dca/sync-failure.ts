export type DcaSyncFailureStamp = {
  playbookId: string;
  playbookUpdatedAtMs: number;
  reason: string;
  clipIndex: number | null;
  qty: number | null;
  limitPrice: number | null;
  error: string;
};

const SAME = 1e-8;

function sameNumber(
  left: number | null,
  right: number | null,
): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return Math.abs(left - right) <= SAME;
}

export function dcaSyncFailureStamp(input: {
  playbookId: string;
  playbookUpdatedAtMs: number;
  reason: string;
  clipIndex?: number | null;
  qty?: number | null;
  limitPrice?: number | null;
  error?: string;
}): DcaSyncFailureStamp {
  return {
    playbookId: input.playbookId,
    playbookUpdatedAtMs: input.playbookUpdatedAtMs,
    reason: input.reason,
    clipIndex:
      input.clipIndex === undefined || input.clipIndex === null
        ? null
        : input.clipIndex,
    qty:
      input.qty === undefined || input.qty === null || !Number.isFinite(input.qty)
        ? null
        : input.qty,
    limitPrice:
      input.limitPrice === undefined ||
      input.limitPrice === null ||
      !Number.isFinite(input.limitPrice)
        ? null
        : input.limitPrice,
    error: String(input.error ?? "").trim(),
  };
}

export function dcaSyncAttemptsMatch(
  left: DcaSyncFailureStamp,
  right: DcaSyncFailureStamp,
): boolean {
  return (
    left.playbookId === right.playbookId &&
    left.playbookUpdatedAtMs === right.playbookUpdatedAtMs &&
    left.reason === right.reason &&
    left.clipIndex === right.clipIndex &&
    sameNumber(left.qty, right.qty) &&
    sameNumber(left.limitPrice, right.limitPrice)
  );
}

export function dcaSyncFailuresMatch(
  left: DcaSyncFailureStamp,
  right: DcaSyncFailureStamp,
): boolean {
  return dcaSyncAttemptsMatch(left, right) && left.error === right.error;
}

export function shouldSkipDcaSyncRetry(
  recent: readonly DcaSyncFailureStamp[],
  next: DcaSyncFailureStamp,
): boolean {
  return recent.some((row) => dcaSyncAttemptsMatch(row, next));
}

export function stampFromSyncFailedData(
  playbookId: string,
  data: Record<string, unknown>,
  error = "",
): DcaSyncFailureStamp | null {
  const reason = String(data.reason ?? "").trim();
  if (!reason) {
    return null;
  }
  const updated = Number(data.playbookUpdatedAtMs);
  const clip = Number(data.clipIndex);
  const qty = Number(data.qty);
  const limitPrice = Number(data.limitPrice);
  return dcaSyncFailureStamp({
    playbookId,
    playbookUpdatedAtMs: Number.isFinite(updated) ? updated : 0,
    reason,
    clipIndex: Number.isInteger(clip) ? clip : null,
    qty: Number.isFinite(qty) && qty > 0 ? qty : null,
    limitPrice: Number.isFinite(limitPrice) && limitPrice > 0 ? limitPrice : null,
    error,
  });
}
