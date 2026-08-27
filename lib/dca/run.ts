import type { TradingAccountMode } from "@/lib/accounts/model";
import { fetchBybitTickers } from "@/lib/exchanges/bybit/client";
import { runFuturesCommand } from "@/lib/futures/command";
import {
  loadOpenFuturesOnSymbol,
  loadOpenFuturesWorking,
  loadFuturesWorking,
} from "@/lib/futures/list";
import { triggerConditionMet } from "@/lib/futures/automation";
import type { FuturesSide } from "@/lib/futures/model";
import type { FuturesTrailing } from "@/lib/futures/trailing";
import {
  emptyFuturesTpsl,
  tickerTriggerPrices,
  tpslFromRow,
  tpslWithoutLimitExits,
  type FuturesTpsl,
} from "@/lib/futures/tpsl";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  dcaBreakevenPrice,
  dcaClipSizeAt,
  dcaPlannedExits,
  dcaTighterStopPrice,
  dcaTighterTrailingActivation,
  dcaTighterTrailingDistance,
  dcaTrailingActivationPrice,
  dcaTrailingDistance,
} from "./grid";
import {
  dcaClipAction,
  dcaClipRestKey,
  dcaCycleEnded,
  dcaEnabledSides,
  dcaExitLimitRestKey,
  dcaFlattenKey,
  dcaLegFor,
  dcaLegIsRunning,
  dcaOpenExitLimits,
  dcaWebhookSignalApplies,
  IDLE_DCA_LEG,
  isDcaClipKey,
  parseDcaClipIndex,
  planDcaExitLimitKeep,
  planDcaExitLimitSync,
  planDcaSafetySync,
  type DcaExitLimitKind,
  type DcaPlaybook,
  type DcaStatus,
} from "./playbook";
import {
  patchDcaLeg,
  resetDcaLeg,
  resetDcaPlaybook,
} from "./store";

export type DcaVerb = "arm" | "disarm" | "close-playbook";

const gridSyncLocks = new Map<string, Promise<void>>();
const exitSyncLocks = new Map<string, Promise<void>>();

function playbookActor(playbook: DcaPlaybook, mode: TradingAccountMode) {
  return {
    userId: playbook.userId,
    accountId: playbook.accountId,
    mode,
  };
}

function touchPlaybook(playbook: DcaPlaybook): void {
  playbook.updatedAtMs = Date.now();
}

async function logDcaSyncFailed(input: {
  playbook: DcaPlaybook;
  side: FuturesSide;
  error: string;
  reason: string;
}): Promise<void> {
  await writeEventLog({
    level: "warning",
    scope: "trade",
    event: "dca.sync_failed",
    message: input.error,
    userId: input.playbook.userId,
    accountId: input.playbook.accountId,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      playbookId: input.playbook.id,
      side: input.side,
      reason: input.reason,
    },
  });
}

export function parseDcaPlaybookVerb(value: unknown): {
  verb: DcaVerb;
  side: FuturesSide | null;
} | null {
  const raw = String(value ?? "").trim();
  if (raw === "arm-long") {
    return { verb: "arm", side: "long" };
  }
  if (raw === "arm-short") {
    return { verb: "arm", side: "short" };
  }
  if (raw === "arm" || raw === "disarm" || raw === "close-playbook") {
    return { verb: raw, side: null };
  }
  return null;
}

function sidesForVerb(
  playbook: DcaPlaybook,
  side: FuturesSide | null | undefined,
): FuturesSide[] {
  const enabled = dcaEnabledSides(playbook.direction);
  if (!side) {
    return enabled;
  }
  return enabled.filter((item) => item === side);
}

async function lastPriceFor(symbol: string): Promise<number | null> {
  const tickers = await fetchBybitTickers("linear").catch(() => null);
  if (!tickers) {
    return null;
  }
  const prices = tickerTriggerPrices(tickers.get(symbol) ?? {});
  return prices.last;
}

function clipTrailing(
  playbook: DcaPlaybook,
  side: FuturesSide,
  lastPrice: number,
): FuturesTrailing | null {
  if (playbook.trailingPct === null || !(lastPrice > 0)) {
    return null;
  }
  return {
    distance: dcaTrailingDistance(lastPrice, playbook.trailingPct),
    activePrice:
      playbook.trailingTriggerPct === null
        ? null
        : dcaTrailingActivationPrice({
            side,
            basisPrice: lastPrice,
            triggerPct: playbook.trailingTriggerPct,
          }),
    peak: null,
  };
}

async function cancelSafetyOrders(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
}): Promise<void> {
  const working = await loadOpenFuturesWorking({
    accountId: input.playbook.accountId,
    userId: input.playbook.userId,
  });
  const actor = playbookActor(input.playbook, input.mode);
  for (const row of working) {
    if (row.reduceOnly) {
      continue;
    }
    if (!isDcaClipKey(row.idempotencyKey, input.playbook.id, input.side)) {
      continue;
    }
    const result = await runFuturesCommand({
      actor,
      command: {
        kind: "cancel-working",
        workingId: row.id,
      },
    });
    if (!result.ok) {
      await logDcaSyncFailed({
        playbook: input.playbook,
        side: input.side,
        error: result.error,
        reason: "cancel_grid",
      });
    }
  }
}

async function cancelExitLimit(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
  kind: DcaExitLimitKind;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const working = await loadOpenFuturesWorking({
    accountId: input.playbook.accountId,
    userId: input.playbook.userId,
  });
  const rows = dcaOpenExitLimits(
    working,
    input.playbook.id,
    input.side,
    input.kind,
  );
  const actor = playbookActor(input.playbook, input.mode);
  for (const row of rows) {
    const result = await runFuturesCommand({
      actor,
      command: {
        kind: "cancel-working",
        workingId: row.id,
      },
    });
    if (!result.ok) {
      await logDcaSyncFailed({
        playbook: input.playbook,
        side: input.side,
        error: result.error,
        reason: `cancel_${input.kind}`,
      });
      return result;
    }
  }
  return { ok: true };
}

async function restExitLimit(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
  kind: DcaExitLimitKind;
  positionId: string;
  qty: number;
  limitPrice: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(input.qty > 0) || !(input.limitPrice > 0)) {
    return { ok: true };
  }
  const working = await loadOpenFuturesWorking({
    accountId: input.playbook.accountId,
    userId: input.playbook.userId,
  });
  const matching = dcaOpenExitLimits(
    working,
    input.playbook.id,
    input.side,
    input.kind,
  );
  const { keep, cancelIds } = planDcaExitLimitKeep(
    matching,
    input.qty,
    input.limitPrice,
  );
  const actor = playbookActor(input.playbook, input.mode);
  for (const workingId of cancelIds) {
    const cancelled = await runFuturesCommand({
      actor,
      command: { kind: "cancel-working", workingId },
    });
    if (!cancelled.ok) {
      await logDcaSyncFailed({
        playbook: input.playbook,
        side: input.side,
        error: cancelled.error,
        reason: `cancel_extra_${input.kind}`,
      });
      return cancelled;
    }
  }
  const plan = planDcaExitLimitSync({
    qty: input.qty,
    limitPrice: input.limitPrice,
    existing: keep
      ? { remainingQty: keep.remainingQty, limitPrice: keep.limitPrice }
      : null,
  });
  if (plan.kind === "keep") {
    return { ok: true };
  }
  let replace = plan.kind === "replace" || plan.kind === "rest";
  if (plan.kind === "amend" && keep) {
    const amended = await runFuturesCommand({
      actor,
      command: {
        kind: "amend-working",
        workingId: keep.id,
        qty: String(plan.qty),
        limitPrice: String(plan.limitPrice),
      },
    });
    if (amended.ok) {
      return { ok: true };
    }
    await logDcaSyncFailed({
      playbook: input.playbook,
      side: input.side,
      error: amended.error,
      reason: `amend_${input.kind}`,
    });
    replace = true;
  }
  if (replace && keep) {
    const cancelled = await runFuturesCommand({
      actor,
      command: { kind: "cancel-working", workingId: keep.id },
    });
    if (!cancelled.ok) {
      await logDcaSyncFailed({
        playbook: input.playbook,
        side: input.side,
        error: cancelled.error,
        reason: `replace_${input.kind}`,
      });
      return cancelled;
    }
  }
  const placed = await runFuturesCommand({
    actor,
    command: {
      kind: "place",
      action: "flatten",
      symbol: input.playbook.symbol,
      positionId: input.positionId,
      orderType: "limit",
      limitPrice: String(input.limitPrice),
      size: String(input.qty),
      idempotencyKey: dcaExitLimitRestKey(
        input.playbook.id,
        input.side,
        input.kind,
        input.qty,
        input.limitPrice,
      ),
      source: "engine",
      ruleName: input.playbook.name,
    },
  });
  if (!placed.ok) {
    await logDcaSyncFailed({
      playbook: input.playbook,
      side: input.side,
      error: placed.error,
      reason: `rest_${input.kind}`,
    });
    return placed;
  }
  return { ok: true };
}

export async function syncDcaPlaybookGrid(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
  entryPrice?: number | null;
  status?: DcaStatus;
}): Promise<void> {
  const lockKey = `${input.playbook.id}:${input.side}`;
  const previous = gridSyncLocks.get(lockKey) ?? Promise.resolve();
  const next = previous.then(
    () => syncDcaPlaybookGridUnlocked(input),
    () => syncDcaPlaybookGridUnlocked(input),
  );
  gridSyncLocks.set(lockKey, next);
  try {
    await next;
  } finally {
    if (gridSyncLocks.get(lockKey) === next) {
      gridSyncLocks.delete(lockKey);
    }
  }
}

async function syncDcaPlaybookGridUnlocked(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
  entryPrice?: number | null;
  status?: DcaStatus;
}): Promise<void> {
  const enabled = dcaEnabledSides(input.playbook.direction).includes(
    input.side,
  );
  const leg = dcaLegFor(input.playbook, input.side);
  const working = await loadFuturesWorking(
    {
      accountId: input.playbook.accountId,
      userId: input.playbook.userId,
    },
    ["open", "filled"],
  );
  const plan = planDcaSafetySync({
    playbookId: input.playbook.id,
    side: input.side,
    status: !enabled ? "idle" : (input.status ?? leg.status),
    dcaMode: input.playbook.dcaMode,
    maxClips: input.playbook.maxClips,
    dipPct: input.playbook.dipPct,
    deviationMultiplier: input.playbook.deviationMultiplier,
    clipSize: input.playbook.clipSize,
    sizeMultiplier: input.playbook.sizeMultiplier,
    sizeUnit: input.playbook.sizeUnit,
    entryPrice:
      input.entryPrice ?? leg.firstFillPrice ?? leg.lastClipPrice,
    working: working.map((row) => ({
      id: row.id,
      idempotencyKey: row.idempotencyKey,
      remainingQty: row.remainingQty,
      limitPrice: row.limitPrice,
      reduceOnly: row.reduceOnly,
      status: row.status,
    })),
  });
  const actor = playbookActor(input.playbook, input.mode);
  for (const workingId of plan.cancelIds) {
    const cancelled = await runFuturesCommand({
      actor,
      command: { kind: "cancel-working", workingId },
    });
    if (!cancelled.ok) {
      await logDcaSyncFailed({
        playbook: input.playbook,
        side: input.side,
        error: cancelled.error,
        reason: "cancel_grid",
      });
    }
  }
  for (const item of plan.amend) {
    const amended = await runFuturesCommand({
      actor,
      command: {
        kind: "amend-working",
        workingId: item.workingId,
        qty: String(item.qty),
        limitPrice: String(item.limitPrice),
      },
    });
    if (!amended.ok) {
      await logDcaSyncFailed({
        playbook: input.playbook,
        side: input.side,
        error: amended.error,
        reason: "amend_grid",
      });
    }
  }
  const openAfter = await loadOpenFuturesWorking({
    accountId: input.playbook.accountId,
    userId: input.playbook.userId,
  });
  const openIndices = new Set<number>();
  for (const row of openAfter) {
    if (!isDcaClipKey(row.idempotencyKey, input.playbook.id, input.side)) {
      continue;
    }
    const index = parseDcaClipIndex(row.idempotencyKey);
    if (index !== null) {
      openIndices.add(index);
    }
  }
  for (const item of plan.rest) {
    if (openIndices.has(item.clipIndex)) {
      continue;
    }
    const rested = await runFuturesCommand({
      actor,
      command: {
        kind: "place",
        action: dcaClipAction(input.side),
        symbol: input.playbook.symbol,
        orderType: "limit",
        limitPrice: String(item.limitPrice),
        size: String(item.qty),
        sizeUnit: input.playbook.sizeUnit,
        idempotencyKey: dcaClipRestKey(
          input.playbook.id,
          input.side,
          item.clipIndex,
          input.playbook.updatedAtMs,
        ),
        source: "engine",
        ruleName: input.playbook.name,
      },
    });
    if (!rested.ok) {
      await logDcaSyncFailed({
        playbook: input.playbook,
        side: input.side,
        error: rested.error,
        reason: "rest_grid",
      });
      continue;
    }
    openIndices.add(item.clipIndex);
  }
}

async function placeClip(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
  lastPrice: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const leg = dcaLegFor(input.playbook, input.side);
  const size = dcaClipSizeAt(
    leg.clipsFilled,
    input.playbook.clipSize,
    input.playbook.sizeMultiplier,
  );
  const firstClip = leg.clipsFilled === 0;
  const generation =
    firstClip
      ? input.playbook.updatedAtMs
      : (leg.lastClipAtMs ?? input.playbook.updatedAtMs);
  const result = await runFuturesCommand({
    actor: playbookActor(input.playbook, input.mode),
    command: {
      kind: "place",
      action: dcaClipAction(input.side),
      symbol: input.playbook.symbol,
      orderType: "market",
      size: String(size),
      sizeUnit: input.playbook.sizeUnit,
      idempotencyKey: dcaClipRestKey(
        input.playbook.id,
        input.side,
        leg.clipsFilled,
        generation,
      ),
      source: "engine",
      ruleName: input.playbook.name,
      trailing: firstClip
        ? clipTrailing(input.playbook, input.side, input.lastPrice)
        : null,
    },
  });
  if (!result.ok) {
    return result;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Auth is not configured." };
  }
  const patched = await patchDcaLeg({
    supabase,
    id: input.playbook.id,
    side: input.side,
    patch: {
      status: "armed",
      clipsFilled: leg.clipsFilled + 1,
      lastClipPrice: input.lastPrice,
      lastClipAtMs: Date.now(),
      firstFillPrice: firstClip ? input.lastPrice : leg.firstFillPrice,
    },
  });
  if (!patched.ok) {
    return patched;
  }
  await syncDcaPlaybookGrid({
    playbook: input.playbook,
    mode: input.mode,
    side: input.side,
    status: "armed",
    entryPrice: firstClip
      ? input.lastPrice
      : (leg.firstFillPrice ?? input.lastPrice),
  });
  await syncDcaPlaybookExits({
    playbook: input.playbook,
    mode: input.mode,
    side: input.side,
    lastPrice: input.lastPrice,
  });
  return { ok: true };
}

function sameExitPrice(left: number | null, right: number | null): boolean {
  if (left === null && right === null) {
    return true;
  }
  if (left === null || right === null) {
    return false;
  }
  return Math.abs(left - right) < 1e-8;
}

export async function syncDcaPlaybookExits(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
  lastPrice: number | null;
}): Promise<void> {
  const lockKey = `${input.playbook.id}:${input.side}:exit`;
  const previous = exitSyncLocks.get(lockKey) ?? Promise.resolve();
  const next = previous.then(
    () => syncDcaPlaybookExitsUnlocked(input),
    () => syncDcaPlaybookExitsUnlocked(input),
  );
  exitSyncLocks.set(lockKey, next);
  try {
    await next;
  } finally {
    if (exitSyncLocks.get(lockKey) === next) {
      exitSyncLocks.delete(lockKey);
    }
  }
}

async function syncDcaPlaybookExitsUnlocked(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
  lastPrice: number | null;
}): Promise<void> {
  const opens = await loadOpenFuturesOnSymbol(input.playbook.symbol, {
    accountId: input.playbook.accountId,
    userId: input.playbook.userId,
  });
  const open = opens.find((row) => row.side === input.side);
  if (!open) {
    return;
  }
  const leg = dcaLegFor(input.playbook, input.side);
  const planned = dcaPlannedExits({
    side: input.side,
    entryPrice: open.entryPrice,
    firstFillPrice: leg.firstFillPrice,
    mark: input.lastPrice,
    takeProfitPct: input.playbook.takeProfitPct,
    stopLossPct: input.playbook.stopLossPct,
    takeProfitBasis: input.playbook.takeProfitBasis,
    stopLossBasis: input.playbook.stopLossBasis,
    trailingPct: input.playbook.trailingPct,
  });
  const current = tpslFromRow(open) ?? emptyFuturesTpsl();
  const rawStop = leg.breakevenDone
    ? dcaBreakevenPrice({
        side: input.side,
        basisPrice: open.entryPrice,
        offsetPct: input.playbook.breakevenOffsetPct ?? 0,
      })
    : planned.stopLoss;
  const stopLoss = dcaTighterStopPrice({
    side: input.side,
    current: current.stopLoss,
    candidate: rawStop,
  });
  const tpType =
    planned.takeProfit === null ? "market" : input.playbook.takeProfitOrderType;
  const nextTpsl: FuturesTpsl = {
    ...current,
    takeProfit: planned.takeProfit,
    stopLoss,
    tpOrderType: tpType,
    slOrderType: "market",
    tpLimitPrice:
      planned.takeProfit !== null && tpType === "limit"
        ? planned.takeProfit
        : null,
    slLimitPrice: null,
  };
  const actor = playbookActor(input.playbook, input.mode);
  if (
    !sameExitPrice(current.takeProfit, planned.takeProfit) ||
    !sameExitPrice(current.stopLoss, stopLoss) ||
    (planned.takeProfit !== null && current.tpOrderType !== tpType) ||
    (stopLoss !== null && current.slOrderType !== "market")
  ) {
    const set = await runFuturesCommand({
      actor,
      command: {
        kind: "set-tpsl",
        positionId: open.id,
        symbol: input.playbook.symbol,
        form: new FormData(),
        tpsl: nextTpsl,
        venueTpsl: tpslWithoutLimitExits(nextTpsl),
      },
    });
    if (!set.ok) {
      await logDcaSyncFailed({
        playbook: input.playbook,
        side: input.side,
        error: set.error,
        reason: "set_tpsl",
      });
    }
  }
  if (tpType === "limit" && planned.takeProfit !== null) {
    await restExitLimit({
      playbook: input.playbook,
      mode: input.mode,
      side: input.side,
      kind: "tp",
      positionId: open.id,
      qty: open.qty,
      limitPrice: planned.takeProfit,
    });
  } else {
    await cancelExitLimit({
      playbook: input.playbook,
      mode: input.mode,
      side: input.side,
      kind: "tp",
    });
  }
  await cancelExitLimit({
    playbook: input.playbook,
    mode: input.mode,
    side: input.side,
    kind: "sl",
  });
  await syncDcaTrailing({
    playbook: input.playbook,
    mode: input.mode,
    side: input.side,
    positionId: open.id,
    lastPrice: input.lastPrice,
    currentDistance: open.trailingStop,
    currentActive: open.trailingActive,
    currentPeak: open.trailingPeak,
  });
}

async function syncDcaTrailing(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
  positionId: string;
  lastPrice: number | null;
  currentDistance: number | null;
  currentActive: number | null;
  currentPeak: number | null;
}): Promise<void> {
  const lastPrice = input.lastPrice;
  if (input.playbook.trailingPct === null || lastPrice === null || !(lastPrice > 0)) {
    if (input.currentDistance !== null) {
      const cleared = await runFuturesCommand({
        actor: playbookActor(input.playbook, input.mode),
        command: {
          kind: "set-trailing",
          positionId: input.positionId,
          symbol: input.playbook.symbol,
          form: new FormData(),
          trailing: null,
        },
      });
      if (!cleared.ok) {
        await logDcaSyncFailed({
          playbook: input.playbook,
          side: input.side,
          error: cleared.error,
          reason: "clear_trailing",
        });
      }
    }
    return;
  }
  const candidate = clipTrailing(input.playbook, input.side, lastPrice);
  if (!candidate) {
    return;
  }
  const distance = dcaTighterTrailingDistance(
    input.currentDistance,
    candidate.distance,
  );
  if (distance === null) {
    return;
  }
  const activePrice = dcaTighterTrailingActivation({
    side: input.side,
    current: input.currentActive,
    candidate: candidate.activePrice,
  });
  const next: FuturesTrailing = {
    distance,
    activePrice,
    peak: input.currentPeak,
  };
  if (
    sameExitPrice(input.currentDistance, next.distance) &&
    sameExitPrice(input.currentActive, next.activePrice)
  ) {
    return;
  }
  const set = await runFuturesCommand({
    actor: playbookActor(input.playbook, input.mode),
    command: {
      kind: "set-trailing",
      positionId: input.positionId,
      symbol: input.playbook.symbol,
      form: new FormData(),
      trailing: next,
    },
  });
  if (!set.ok) {
    await logDcaSyncFailed({
      playbook: input.playbook,
      side: input.side,
      error: set.error,
      reason: "set_trailing",
    });
  }
}

async function flattenSide(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await cancelSafetyOrders(input);
  await cancelExitLimit({ ...input, kind: "tp" });
  await cancelExitLimit({ ...input, kind: "sl" });
  const opens = await loadOpenFuturesOnSymbol(input.playbook.symbol, {
    accountId: input.playbook.accountId,
    userId: input.playbook.userId,
  });
  const open = opens.find((row) => row.side === input.side);
  if (!open) {
    return { ok: true };
  }
  const result = await runFuturesCommand({
    actor: playbookActor(input.playbook, input.mode),
    command: {
      kind: "place",
      action: "flatten",
      symbol: input.playbook.symbol,
      positionId: open.id,
      orderType: "market",
      source: "engine",
      ruleName: input.playbook.name,
      idempotencyKey: dcaFlattenKey(input.playbook.id, input.side, open.id),
    },
  });
  return result.ok ? { ok: true } : result;
}

async function moveStopToBreakeven(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const opens = await loadOpenFuturesOnSymbol(input.playbook.symbol, {
    accountId: input.playbook.accountId,
    userId: input.playbook.userId,
  });
  const open = opens.find((row) => row.side === input.side);
  if (!open) {
    return { ok: true };
  }
  const current = tpslFromRow(open) ?? emptyFuturesTpsl();
  const stop = dcaTighterStopPrice({
    side: input.side,
    current: current.stopLoss,
    candidate: dcaBreakevenPrice({
      side: input.side,
      basisPrice: open.entryPrice,
      offsetPct: input.playbook.breakevenOffsetPct ?? 0,
    }),
  });
  const result = await runFuturesCommand({
    actor: playbookActor(input.playbook, input.mode),
    command: {
      kind: "set-tpsl",
      positionId: open.id,
      symbol: input.playbook.symbol,
      form: new FormData(),
      tpsl: {
        ...current,
        stopLoss: stop,
        slOrderType: "market",
        slLimitPrice: null,
      },
    },
  });
  if (!result.ok) {
    return result;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Auth is not configured." };
  }
  return patchDcaLeg({
    supabase,
    id: input.playbook.id,
    side: input.side,
    patch: { breakevenDone: true },
  });
}

function priceStartMet(
  playbook: DcaPlaybook,
  lastPrice: number | null,
): boolean {
  if (playbook.startKind !== "price" || !playbook.armTrigger) {
    return false;
  }
  if (lastPrice === null) {
    return false;
  }
  return triggerConditionMet(
    lastPrice,
    playbook.armTrigger.compare,
    playbook.armTrigger.price,
  );
}

export async function applyDcaVerb(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  verb: DcaVerb;
  side?: FuturesSide | null;
  source?: "manual" | "webhook";
  forcePlace?: boolean;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Auth is not configured." };
  }
  const sides = sidesForVerb(input.playbook, input.side);
  if (sides.length === 0) {
    return { ok: false, error: "That side is not on this playbook." };
  }

  if (input.verb === "disarm") {
    let changed = false;
    for (const side of sides) {
      const leg = dcaLegFor(input.playbook, side);
      if (leg.status === "idle") {
        continue;
      }
      await cancelSafetyOrders({
        playbook: input.playbook,
        mode: input.mode,
        side,
      });
      const patched = await patchDcaLeg({
        supabase,
        id: input.playbook.id,
        side,
        patch: { status: "stop_adding" },
      });
      if (!patched.ok) {
        return patched;
      }
      changed = true;
    }
    if (!changed) {
      return { ok: true, message: "Playbook is idle." };
    }
    return { ok: true, message: "Stopped adding. The position stays open." };
  }

  if (input.verb === "close-playbook") {
    for (const side of sides) {
      const closed = await flattenSide({
        playbook: input.playbook,
        mode: input.mode,
        side,
      });
      if (!closed.ok) {
        return closed;
      }
      const reset = await resetDcaLeg({
        supabase,
        id: input.playbook.id,
        side,
      });
      if (!reset.ok) {
        return reset;
      }
      touchPlaybook(input.playbook);
    }
    const remaining = dcaEnabledSides(input.playbook.direction).filter(
      (side) =>
        !sides.includes(side) &&
        dcaLegIsRunning(dcaLegFor(input.playbook, side).status),
    );
    if (remaining.length === 0) {
      const reset = await resetDcaPlaybook({
        supabase,
        id: input.playbook.id,
      });
      if (!reset.ok) {
        return reset;
      }
      touchPlaybook(input.playbook);
    }
    return { ok: true, message: "Playbook closed." };
  }

  const lastPrice = await lastPriceFor(input.playbook.symbol);
  const fromSignal = input.source === "webhook";
  const placeNow =
    Boolean(input.forcePlace) ||
    input.playbook.startKind === "immediate" ||
    (input.playbook.startKind === "webhook" && fromSignal) ||
    priceStartMet(input.playbook, lastPrice);
  let placed = 0;
  let resumed = 0;
  let waiting = 0;
  let already = 0;
  let skippedIdle = 0;
  const playbook = input.playbook;
  const opens = await loadOpenFuturesOnSymbol(playbook.symbol, {
    accountId: playbook.accountId,
    userId: playbook.userId,
  });

  for (const side of sides) {
    let leg = dcaLegFor(playbook, side);
    if (
      !dcaWebhookSignalApplies({
        startKind: playbook.startKind,
        fromSignal,
        status: leg.status,
      })
    ) {
      skippedIdle += 1;
      continue;
    }
    const open = opens.find((row) => row.side === side);
    if (
      dcaCycleEnded({
        status: leg.status,
        clipsFilled: leg.clipsFilled,
        positionQty: open?.qty ?? null,
      })
    ) {
      const reset = await resetDcaLeg({
        supabase,
        id: playbook.id,
        side,
      });
      if (!reset.ok) {
        return reset;
      }
      touchPlaybook(playbook);
      leg = { ...IDLE_DCA_LEG };
      if (side === "long") {
        playbook.long = leg;
      } else {
        playbook.short = leg;
      }
    }
    if (leg.status === "armed" && leg.clipsFilled > 0) {
      already += 1;
      continue;
    }
    if (leg.status === "stop_adding") {
      const patched = await patchDcaLeg({
        supabase,
        id: playbook.id,
        side,
        patch: { status: "armed" },
      });
      if (!patched.ok) {
        return patched;
      }
      resumed += 1;
      continue;
    }
    if (!placeNow) {
      const patched = await patchDcaLeg({
        supabase,
        id: playbook.id,
        side,
        patch: { status: "armed" },
      });
      if (!patched.ok) {
        return patched;
      }
      waiting += 1;
      continue;
    }
    if (lastPrice === null) {
      return { ok: false, error: "Could not read the last price to arm." };
    }
    const clip = await placeClip({
      playbook,
      mode: input.mode,
      side,
      lastPrice,
    });
    if (!clip.ok) {
      if (placed + waiting + resumed === 0) {
        return clip;
      }
      break;
    }
    placed += 1;
    const nextLeg = {
      ...leg,
      status: "armed" as const,
      clipsFilled: leg.clipsFilled + 1,
      lastClipPrice: lastPrice,
      lastClipAtMs: Date.now(),
      firstFillPrice: lastPrice,
    };
    if (side === "long") {
      playbook.long = nextLeg;
    } else {
      playbook.short = nextLeg;
    }
  }

  if (skippedIdle === sides.length) {
    return { ok: false, error: "Arm the playbook first." };
  }
  if (placed === 0 && waiting === 0 && resumed === 0 && already > 0) {
    return { ok: true, message: "Playbook is already armed." };
  }
  await writeEventLog({
    scope: "strategy",
    event: "dca.armed",
    message: `Armed ${playbook.name}.`,
    userId: playbook.userId,
    accountId: playbook.accountId,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      playbookId: playbook.id,
      symbol: playbook.symbol,
      sides,
      placed,
    },
  });
  if (placed > 0) {
    return { ok: true, message: "Playbook armed. First order placed." };
  }
  if (resumed > 0) {
    return { ok: true, message: "Playbook resumed adding." };
  }
  return { ok: true, message: "Playbook armed. Waiting for the start trigger." };
}

export async function syncDcaPlaybookWorking(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  lastPrice?: number | null;
}): Promise<void> {
  const lastPrice =
    input.lastPrice === undefined
      ? await lastPriceFor(input.playbook.symbol)
      : input.lastPrice;
  for (const side of ["long", "short"] as const) {
    await syncDcaPlaybookGrid({
      playbook: input.playbook,
      mode: input.mode,
      side,
    });
    const enabled = dcaEnabledSides(input.playbook.direction).includes(side);
    const running = dcaLegIsRunning(dcaLegFor(input.playbook, side).status);
    if (enabled && running) {
      await syncDcaPlaybookExits({
        playbook: input.playbook,
        mode: input.mode,
        side,
        lastPrice,
      });
    } else {
      await cancelExitLimit({
        playbook: input.playbook,
        mode: input.mode,
        side,
        kind: "tp",
      });
      await cancelExitLimit({
        playbook: input.playbook,
        mode: input.mode,
        side,
        kind: "sl",
      });
    }
  }
}

export {
  lastPriceFor,
  placeClip,
  flattenSide as flattenPlaybook,
  moveStopToBreakeven,
  cancelSafetyOrders,
};
