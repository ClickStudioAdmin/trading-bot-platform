import { STEP_UP_REQUEST_FAILED } from "@/lib/auth/step-up";

/**
 * Rows removed per statement. A full page means more may remain, and a
 * shorter page means that table is done. Kept small so one statement stays
 * under the database time limit.
 */
export const DESK_DELETE_BATCH = 300;

/** Stop one request before the server action itself times out. A later try continues. */
export const DESK_DELETE_MAX_BATCHES = 200;

/**
 * Stay well under the Manage Desks `maxDuration` of 60s. One pass has to
 * answer before the host drops the request, or the 2FA dialog stays on
 * Deleting… with Cancel disabled. Closed history continues on the next pass.
 */
export const DESK_DELETE_BUDGET_MS = 15_000;

/** One database call. A lock or a dropped connection must not hold the pass. */
export const DESK_DELETE_RPC_DEADLINE_MS = 10_000;

/**
 * The browser gives up if that pass never answers. Later than the server
 * budget, earlier than the host limit.
 */
export const DESK_DELETE_PASS_DEADLINE_MS = 35_000;

/** How many passes one authenticator code may run. Each pass refreshes its grant. */
export const DESK_DELETE_CONTINUE_ATTEMPTS = 8;

export const DESK_DELETE_TIMED_OUT = "Deleting this desk timed out. Try again.";

export const DESK_DELETE_FAILED = "Could not delete this desk. Try again.";

export const DESK_DELETE_MISSING = "That account was not found.";

export const DESK_DELETE_HAS_COPIES =
  "Remove the copy desks that follow this desk first.";

export function deskDeleteErrorMessage(raw: string): string {
  if (/statement timeout|lock timeout/i.test(raw)) {
    return DESK_DELETE_TIMED_OUT;
  }
  if (raw === DESK_DELETE_TIMED_OUT || raw === DESK_DELETE_FAILED) {
    return raw;
  }
  if (raw === DESK_DELETE_MISSING || raw === DESK_DELETE_HAS_COPIES) {
    return raw;
  }
  return DESK_DELETE_FAILED;
}

/** One `delete_desk_chunk` result. `more` means this pass should call again. */
export function interpretDeskDeleteChunk(
  status: string,
): "more" | "done" | { error: string } {
  if (status === "done") {
    return "done";
  }
  if (status === "more") {
    return "more";
  }
  if (status === "missing") {
    return { error: DESK_DELETE_MISSING };
  }
  if (status === "copies") {
    return { error: DESK_DELETE_HAS_COPIES };
  }
  return { error: deskDeleteErrorMessage(status) };
}

/**
 * Calls the database chunk until the desk is gone or this request is out of time.
 * Each call commits its own batch.
 */
export async function drainDeskDeleteChunks(
  runChunk: () => Promise<string>,
  startedAt = Date.now(),
  budgetMs = DESK_DELETE_BUDGET_MS,
): Promise<string | null> {
  while (!deskDeletePastBudget(startedAt, Date.now(), budgetMs)) {
    const outcome = interpretDeskDeleteChunk(await runChunk());
    if (outcome === "done") {
      return null;
    }
    if (outcome === "more") {
      continue;
    }
    return outcome.error;
  }
  return DESK_DELETE_TIMED_OUT;
}

export function deskDeletePastBudget(
  startedAt: number,
  now = Date.now(),
  budgetMs = DESK_DELETE_BUDGET_MS,
): boolean {
  return now - startedAt >= budgetMs;
}

/**
 * Deletes matching rows a few hundred at a time. One DELETE of a desk's
 * bots and history can run longer than the database allows.
 */
export async function deleteRowsInBatches(args: {
  batchSize: number;
  maxBatches: number;
  startedAt?: number;
  budgetMs?: number;
  selectIds: (
    limit: number,
  ) => Promise<{ ids: Array<string | number>; error: string | null }>;
  deleteIds: (
    ids: Array<string | number>,
  ) => Promise<{ error: string | null }>;
}): Promise<string | null> {
  for (let batch = 0; batch < args.maxBatches; batch += 1) {
    if (
      args.startedAt != null &&
      deskDeletePastBudget(args.startedAt, Date.now(), args.budgetMs)
    ) {
      return DESK_DELETE_TIMED_OUT;
    }
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

/**
 * Resolves with `onTimeout` when `run` does not answer in time. A late
 * failure from `run` is ignored so the dialog can unlock.
 */
export async function withDeskDeleteDeadline<T>(
  run: () => Promise<T>,
  onTimeout: T,
  ms: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const work = run().then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  try {
    const winner = await Promise.race([
      work,
      new Promise<{ ok: "timeout" }>((resolve) => {
        timer = setTimeout(() => resolve({ ok: "timeout" }), ms);
      }),
    ]);
    if (winner.ok === "timeout") {
      return onTimeout;
    }
    if (!winner.ok) {
      throw winner.error;
    }
    return winner.value;
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * A pass that never answers. With a grant, the same code keeps going.
 * Without one, the dialog shows the timeout and accepts another code.
 */
export function deskDeleteAttemptTimeout(grant: string): {
  stepUpError: string;
  deskDeleteGrant?: string;
} {
  if (grant) {
    return {
      stepUpError: DESK_DELETE_TIMED_OUT,
      deskDeleteGrant: grant,
    };
  }
  return { stepUpError: STEP_UP_REQUEST_FAILED };
}

/** One code keeps deleting after a pass stops for time. A redirect still throws. */
export async function continueTimedDeskDelete<T>(
  run: () => Promise<T>,
  isTimeout: (result: T) => boolean,
  attempts = DESK_DELETE_CONTINUE_ATTEMPTS,
): Promise<T> {
  const times = Math.max(1, Math.floor(attempts));
  let last: T | undefined;
  for (let attempt = 0; attempt < times; attempt += 1) {
    last = await run();
    if (!isTimeout(last)) {
      return last;
    }
  }
  return last as T;
}
