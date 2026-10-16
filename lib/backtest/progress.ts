import { formatCount } from "@/lib/opportunities/format";
import type { BacktestStatus } from "./model";

export type BacktestProgressPhase = "candles" | "replay";

export type BacktestProgress = {
  phase: BacktestProgressPhase;
  done: number;
  total: number;
  percent: number;
};

export function parseBacktestProgressPhase(
  raw: unknown,
): BacktestProgressPhase | null {
  return raw === "candles" || raw === "replay" ? raw : null;
}

export function parseBacktestProgressCount(raw: unknown): number | null {
  if (raw == null || raw === "") {
    return null;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.floor(value);
}

/** Share of the window already loaded. Stays under 100 while the run is still going. */
export function backtestProgressPercent(done: number, total: number): number {
  if (!(total > 0) || !(done > 0)) {
    return 0;
  }
  const bounded = Math.min(total, done);
  return Math.min(99, Math.round((bounded / total) * 100));
}

export function backtestRunProgress(input: {
  status: BacktestStatus;
  progressDone: number | null;
  progressTotal: number | null;
  progressPhase: BacktestProgressPhase | null;
}): BacktestProgress | null {
  if (input.status !== "running") {
    return null;
  }
  const total = input.progressTotal ?? 0;
  if (!(total > 0)) {
    return null;
  }
  const done = Math.min(total, Math.max(0, input.progressDone ?? 0));
  const phase: BacktestProgressPhase =
    input.progressPhase === "replay" ? "replay" : "candles";
  return {
    phase,
    done,
    total,
    percent: backtestProgressPercent(done, total),
  };
}

export function backtestProgressLabel(progress: BacktestProgress): string {
  const counts = `${formatCount(progress.done)} of ${formatCount(progress.total)}`;
  const action = progress.phase === "replay" ? "Replaying" : "Loading candles";
  return `${action}. ${counts} (${progress.percent}%).`;
}

export type BacktestProgressWrite = {
  done: number;
  phase: BacktestProgressPhase;
};

/**
 * Collapse progress writes that arrive while one is still saving.
 * The page refreshes every few seconds, so the latest count is the one that matters.
 */
export function createBacktestProgressPump(
  write: (input: BacktestProgressWrite) => Promise<void>,
  total: number,
): {
  report: (done: number, phase: BacktestProgressPhase) => void;
  flushed: () => Promise<void>;
} {
  const cap = total > 0 ? total : Number.POSITIVE_INFINITY;
  let queued: BacktestProgressWrite | null = null;
  let pumping = false;
  let pending = Promise.resolve();

  function report(done: number, phase: BacktestProgressPhase) {
    const bounded = Math.max(0, Math.floor(done));
    queued = {
      done: Math.min(cap, bounded),
      phase,
    };
    if (pumping) {
      return;
    }
    pumping = true;
    pending = pending.then(async () => {
      try {
        while (queued) {
          const next = queued;
          queued = null;
          try {
            await write(next);
          } catch {
            // A missed progress write still leaves the run able to finish.
          }
        }
      } finally {
        pumping = false;
        if (queued) {
          report(queued.done, queued.phase);
        }
      }
    });
  }

  return {
    report,
    flushed: () => pending,
  };
}
