/** Rows touched per statement so a bulk write stays under the database time limit. */
export const ROW_BATCH = 300;

/** One request stops here. A later try continues. */
export const ROW_BATCH_CAP = 80;

export const ROW_BATCH_REMAINING = "ROW_BATCH_REMAINING";

export function chunkList<T>(items: readonly T[], size = ROW_BATCH): T[][] {
  const step = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += step) {
    out.push(items.slice(index, index + step));
  }
  return out;
}

export function statementTimeoutMessage(
  raw: string,
  timedOut: string,
  failed: string,
): string {
  if (raw === ROW_BATCH_REMAINING || /statement timeout/i.test(raw)) {
    return timedOut;
  }
  return failed;
}

/**
 * Selects a bounded id list, applies it, and repeats.
 * One update or delete of a whole history can run longer than the database allows.
 */
export async function applyRowsInBatches(args: {
  batchSize?: number;
  maxBatches?: number;
  selectIds: (
    limit: number,
  ) => Promise<{ ids: Array<string | number>; error: string | null }>;
  applyIds: (
    ids: Array<string | number>,
  ) => Promise<{ error: string | null }>;
}): Promise<string | null> {
  const batchSize = Math.max(1, Math.floor(args.batchSize ?? ROW_BATCH));
  const maxBatches = Math.max(1, Math.floor(args.maxBatches ?? ROW_BATCH_CAP));
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const selected = await args.selectIds(batchSize);
    if (selected.error) {
      return selected.error;
    }
    if (selected.ids.length === 0) {
      return null;
    }
    const applied = await args.applyIds(selected.ids);
    if (applied.error) {
      return applied.error;
    }
    if (selected.ids.length < batchSize) {
      return null;
    }
  }
  return ROW_BATCH_REMAINING;
}
