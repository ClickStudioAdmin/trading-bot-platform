import { formatCount } from "@/lib/opportunities/format";
import type { BacktestStatus } from "./model";

export type BacktestProgressPhase = "candles" | "replay";

export type BacktestProgressStageState = "waiting" | "active" | "done";

export type BacktestProgressStage = {
  id: BacktestProgressPhase;
  label: string;
  detail: string;
  percent: number;
  state: BacktestProgressStageState;
};

export type BacktestProgress = {
  phase: BacktestProgressPhase;
  stages: [BacktestProgressStage, BacktestProgressStage];
  /** Percent of the stage that is still moving. */
  percent: number;
  headline: string;
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

/** Share of one stage. A finished stage is 100 while the run is still going. */
export function backtestProgressPercent(done: number, total: number): number {
  if (!(total > 0) || !(done > 0)) {
    return 0;
  }
  const bounded = Math.min(total, done);
  return Math.min(100, Math.round((bounded / total) * 100));
}

function countDetail(done: number, total: number): string {
  return `${formatCount(done)} of ${formatCount(total)}`;
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
  const percent = done >= total ? 100 : backtestProgressPercent(done, total);
  if (phase === "replay") {
    const candles: BacktestProgressStage = {
      id: "candles",
      label: "Candles loaded",
      detail: "Complete",
      percent: 100,
      state: "done",
    };
    const replay: BacktestProgressStage = {
      id: "replay",
      label: "Replaying",
      detail: countDetail(done, total),
      percent,
      state: percent >= 100 ? "done" : "active",
    };
    return {
      phase,
      stages: [candles, replay],
      percent,
      headline: `Replaying · ${percent}%`,
    };
  }
  const candlesComplete = done >= total;
  const candles: BacktestProgressStage = {
    id: "candles",
    label: candlesComplete ? "Candles loaded" : "Loading Candles",
    detail: countDetail(done, total),
    percent,
    state: candlesComplete ? "done" : "active",
  };
  const replay: BacktestProgressStage = {
    id: "replay",
    label: "Replaying",
    detail: "Waiting",
    percent: 0,
    state: "waiting",
  };
  return {
    phase,
    stages: [candles, replay],
    percent,
    headline: candlesComplete
      ? "Candles loaded"
      : `Loading Candles · ${percent}%`,
  };
}

export function backtestProgressLabel(progress: BacktestProgress): string {
  const current =
    progress.stages.find((stage) => stage.state === "active") ??
    progress.stages[progress.stages.length - 1];
  if (!current || current.state === "waiting") {
    return progress.headline;
  }
  return `${current.label}. ${current.detail} (${current.percent}%).`;
}

export type BacktestProgressWrite = {
  done: number;
  total: number;
  phase: BacktestProgressPhase;
};

/**
 * Collapse progress writes that arrive while one is still saving.
 * The page refreshes every few seconds, so the latest count is the one that matters.
 */
export function createBacktestProgressPump(
  write: (input: BacktestProgressWrite) => Promise<void>,
): {
  report: (input: BacktestProgressWrite) => void;
  flushed: () => Promise<void>;
} {
  let queued: BacktestProgressWrite | null = null;
  let pumping = false;
  let pending = Promise.resolve();

  function report(input: BacktestProgressWrite) {
    const total = Math.max(0, Math.floor(input.total));
    const done = Math.max(0, Math.floor(input.done));
    queued = {
      done: total > 0 ? Math.min(total, done) : done,
      total,
      phase: input.phase,
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
          report(queued);
        }
      }
    });
  }

  return {
    report,
    flushed: () => pending,
  };
}
