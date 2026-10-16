import type { CandleBar } from "@/lib/market/candles";
import { loadBacktestCandles } from "@/lib/market/desk-klines";
import {
  BACKTEST_CANDLE_LIMIT,
  BACKTEST_INLINE_BAR_LIMIT,
  BACKTEST_VERCEL_BAR_LIMIT,
  estimateBacktestBars,
} from "./model";
import { backtestFailureMessage } from "./failure";
import { canBacktestDcaRecipe, replayDcaPlaybook } from "./replay-dca";
import { canBacktestPerpsRecipe, replayPerpsPriceCross } from "./replay";
import { createBacktestProgressPump } from "./progress";
import {
  BACKTEST_INTERRUPTED_ERROR,
  BACKTEST_TOO_LARGE_ERROR,
  backtestClaimBudgetExceeded,
  backtestClaimCanRequeue,
  backtestErrorIsTransient,
  backtestResultExceedsStoreLimit,
  backtestRunTapeCoverageError,
} from "./guard";
import {
  claimQueuedBacktestRun,
  loadBacktestRun,
  noteBacktestAttempt,
  requeueBacktestRun,
  touchBacktestClaim,
  touchBacktestProgress,
  updateBacktestRun,
} from "./store";

const BACKTEST_CLAIM_HEARTBEAT_MS = 60_000;

function startClaimHeartbeat(runId: string): () => void {
  const timer = setInterval(() => {
    void touchBacktestClaim(runId).catch(() => {});
  }, BACKTEST_CLAIM_HEARTBEAT_MS);
  return () => clearInterval(timer);
}

export type BacktestExecuteResult = {
  ok: boolean;
  error?: string;
  runId?: string;
  requeued?: boolean;
};

export async function executeBacktestRun(
  runId: string,
  cachedCandles?: CandleBar[],
): Promise<BacktestExecuteResult> {
  const run = await loadBacktestRun(runId);
  if (!run) {
    return { ok: false, error: "That run was not found." };
  }
  if (run.status === "draft") {
    return { ok: false, error: "Queue this draft before it can run." };
  }
  let attempt: number;
  try {
    attempt = await noteBacktestAttempt(runId);
  } catch (cause) {
    const error = backtestFailureMessage(cause);
    console.error(`backtest claim count ${runId}`, cause);
    await updateBacktestRun(runId, {
      status: "failed",
      error,
      finished: true,
    });
    return { ok: false, error, runId };
  }
  if (backtestClaimBudgetExceeded(attempt)) {
    await updateBacktestRun(runId, {
      status: "failed",
      error: BACKTEST_INTERRUPTED_ERROR,
      finished: true,
    });
    return { ok: false, error: BACKTEST_INTERRUPTED_ERROR, runId };
  }
  await updateBacktestRun(runId, { status: "running", error: null });
  const bars = estimateBacktestBars(run.fromMs, run.toMs, run.interval);
  if (bars > BACKTEST_INLINE_BAR_LIMIT) {
    console.log(
      `backtest long run ${runId} bars=${bars} ${run.symbol} ${run.interval}`,
    );
  }
  const progress = createBacktestProgressPump(
    (input) => touchBacktestProgress(runId, { ...input, total: bars }),
    bars,
  );
  await touchBacktestProgress(runId, { done: 0, total: bars, phase: "candles" });
  const stopHeartbeat = startClaimHeartbeat(runId);
  try {
    const allowed =
      run.recipe.kind === "dca"
        ? canBacktestDcaRecipe(run.recipe)
        : canBacktestPerpsRecipe(run.recipe);
    if (!allowed.ok) {
      await updateBacktestRun(runId, {
        status: "failed",
        error: allowed.error,
        finished: true,
      });
      return { ok: false, error: allowed.error, runId };
    }
    const candles =
      cachedCandles ??
      (await loadBacktestCandles({
        venue: run.venue,
        venueEnvironment: run.venueEnvironment,
        symbol: run.symbol,
        interval: run.interval,
        fromMs: run.fromMs,
        toMs: run.toMs,
        limit: BACKTEST_CANDLE_LIMIT,
        onProgress: (loaded) => {
          progress.report(loaded, "candles");
        },
      }));
    if (candles.length < 8) {
      await updateBacktestRun(runId, {
        status: "failed",
        error: "Not enough candles in that window.",
        finished: true,
      });
      return { ok: false, error: "Not enough candles in that window.", runId };
    }
    const coverageError = backtestRunTapeCoverageError({
      bars: candles,
      fromMs: run.fromMs,
      toMs: run.toMs,
      interval: run.interval,
      nowMs: Date.now(),
    });
    if (coverageError) {
      await updateBacktestRun(runId, {
        status: "failed",
        error: coverageError,
        finished: true,
      });
      return { ok: false, error: coverageError, runId };
    }
    progress.report(candles.length, "replay");
    const replayed =
      run.recipe.kind === "dca"
        ? await replayDcaPlaybook({
            bars: candles,
            recipe: run.recipe,
            feeRate: run.feeRate,
            startingUsdt: run.startingUsdt,
            leverage: run.leverage,
            venue: run.venue,
          })
        : await replayPerpsPriceCross({
            bars: candles,
            recipe: run.recipe,
            feeRate: run.feeRate,
            startingUsdt: run.startingUsdt,
            leverage: run.leverage,
          });
    if (backtestResultExceedsStoreLimit(replayed.orders, replayed.events)) {
      await updateBacktestRun(runId, {
        status: "failed",
        error: BACKTEST_TOO_LARGE_ERROR,
        finished: true,
      });
      return { ok: false, error: BACKTEST_TOO_LARGE_ERROR, runId };
    }
    await updateBacktestRun(runId, {
      status: "done",
      stats: replayed.stats,
      orders: replayed.orders,
      replayEvents: replayed.events,
      error: null,
      finished: true,
    });
    return { ok: true, runId };
  } catch (cause) {
    console.error(`backtest replay failed ${runId}`, cause);
    const error = backtestFailureMessage(cause);
    if (backtestErrorIsTransient(cause) && backtestClaimCanRequeue(attempt)) {
      const requeued = await requeueBacktestRun(runId, error).catch(() => false);
      if (requeued) {
        return { ok: true, error, runId, requeued: true };
      }
    }
    await updateBacktestRun(runId, {
      status: "failed",
      error,
      finished: true,
    });
    return { ok: false, error, runId };
  } finally {
    stopHeartbeat();
  }
}

export async function processOneQueuedBacktest(input?: {
  maxBars?: number;
}): Promise<BacktestExecuteResult | null> {
  const flyWorker = process.env.TBP_ENGINE_WORKER === "1";
  const maxBars =
    input?.maxBars ?? (flyWorker ? 0 : BACKTEST_VERCEL_BAR_LIMIT);
  const claimed = await claimQueuedBacktestRun({ maxBars });
  if (!claimed) {
    return null;
  }
  return executeBacktestRun(claimed.id);
}
