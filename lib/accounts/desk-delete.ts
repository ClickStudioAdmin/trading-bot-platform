/** Rows removed per statement so a desk with many bots stays under the database time limit. */
export const DESK_DELETE_BATCH = 300;

/** Stop one request before the server action itself times out. A later try continues. */
export const DESK_DELETE_MAX_BATCHES = 80;

export const DESK_DELETE_TIMED_OUT = "Deleting this desk timed out. Try again.";

export const DESK_DELETE_FAILED = "Could not delete this desk. Try again.";

export function deskDeleteErrorMessage(raw: string): string {
  if (/statement timeout/i.test(raw)) {
    return DESK_DELETE_TIMED_OUT;
  }
  return DESK_DELETE_FAILED;
}

/**
 * Deletes matching rows a few hundred at a time. One DELETE of a desk's
 * bots and history can run longer than the database allows.
 */
export async function deleteRowsInBatches(args: {
  batchSize: number;
  maxBatches: number;
  selectIds: (
    limit: number,
  ) => Promise<{ ids: Array<string | number>; error: string | null }>;
  deleteIds: (
    ids: Array<string | number>,
  ) => Promise<{ error: string | null }>;
}): Promise<string | null> {
  for (let batch = 0; batch < args.maxBatches; batch += 1) {
    const selected = await args.selectIds(args.batchSize);
    if (selected.error) {
      return deskDeleteErrorMessage(selected.error);
    }
    if (selected.ids.length === 0) {
      return null;
    }
    const removed = await args.deleteIds(selected.ids);
    if (removed.error) {
      return deskDeleteErrorMessage(removed.error);
    }
    if (selected.ids.length < args.batchSize) {
      return null;
    }
  }
  return DESK_DELETE_TIMED_OUT;
}
