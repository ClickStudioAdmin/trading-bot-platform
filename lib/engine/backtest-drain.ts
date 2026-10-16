import { processOneQueuedBacktest } from "@/lib/backtest/execute";
import { backtestDrainMaxBars } from "@/lib/backtest/model";
import { writeEventLog } from "@/lib/logs/write";

const BACKTEST_DRAIN_IDLE_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** One queued run at a time, any length. Idle sleep keeps a quiet machine cheap. */
export async function drainBacktestQueue(workerId: string): Promise<void> {
  for (;;) {
    try {
      const result = await processOneQueuedBacktest({
        maxBars: backtestDrainMaxBars("worker"),
      });
      if (!result) {
        await sleep(BACKTEST_DRAIN_IDLE_MS);
        continue;
      }
      const outcome = result.requeued
        ? "requeued"
        : result.ok
          ? "finished"
          : "failed";
      console.log(
        `backtest drain ${outcome} run=${result.runId ?? ""} ${result.error ?? ""}`.trim(),
      );
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Backtest drain failed";
      console.error("backtest drain failed", cause);
      await writeEventLog({
        level: "error",
        scope: "system",
        event: "engine.tick",
        message,
        data: { workerId },
      }).catch(() => {});
      await sleep(BACKTEST_DRAIN_IDLE_MS);
    }
  }
}
