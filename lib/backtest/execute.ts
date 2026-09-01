import type { CandleBar } from "@/lib/market/candles";
import { loadBacktestCandles } from "@/lib/market/desk-klines";
import {
  BACKTEST_CANDLE_LIMIT,
  BACKTEST_VERCEL_BAR_LIMIT,
} from "./model";
import { canBacktestDcaRecipe, replayDcaPlaybook } from "./replay-dca";
import { canBacktestPerpsRecipe, replayPerpsPriceCross } from "./replay";
import {
  claimQueuedBacktestRun,
  loadBacktestRun,
  updateBacktestRun,
} from "./store";

export type BacktestExecuteResult = {
  ok: boolean;
  error?: string;
  runId?: string;
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
  await updateBacktestRun(runId, { status: "running" });
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
      }));
    if (candles.length < 8) {
      await updateBacktestRun(runId, {
        status: "failed",
        error: "Not enough candles in that window.",
        finished: true,
      });
      return { ok: false, error: "Not enough candles in that window.", runId };
    }
    const replayed =
      run.recipe.kind === "dca"
        ? replayDcaPlaybook({
            bars: candles,
            recipe: run.recipe,
            feeRate: run.feeRate,
            startingUsdt: run.startingUsdt,
            leverage: run.leverage,
          })
        : replayPerpsPriceCross({
            bars: candles,
            recipe: run.recipe,
            feeRate: run.feeRate,
            startingUsdt: run.startingUsdt,
            leverage: run.leverage,
          });
    await updateBacktestRun(runId, {
      status: "done",
      stats: replayed.stats,
      orders: replayed.orders,
      error: null,
      finished: true,
    });
    return { ok: true, runId };
  } catch {
    await updateBacktestRun(runId, {
      status: "failed",
      error: "Replay failed.",
      finished: true,
    });
    return { ok: false, error: "Replay failed.", runId };
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
