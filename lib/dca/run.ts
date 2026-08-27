import type { TradingAccountMode } from "@/lib/accounts/model";
import { fetchBybitTickers } from "@/lib/exchanges/bybit/client";
import { runFuturesCommand } from "@/lib/futures/command";
import {
  loadOpenFuturesOnSymbol,
  loadOpenFuturesWorking,
} from "@/lib/futures/list";
import { triggerConditionMet } from "@/lib/futures/automation";
import type { FuturesSide } from "@/lib/futures/model";
import {
  emptyFuturesTpsl,
  tickerTriggerPrices,
  tpslFromRow,
  tpslWithoutLimitExits,
} from "@/lib/futures/tpsl";
import { sameWorkingNumber } from "@/lib/futures/working";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  dcaBreakevenPrice,
  dcaPlannedExits,
  dcaTrailingActivationPrice,
  dcaTrailingDistance,
} from "./grid";
import {
  dcaClipAction,
  dcaClipKey,
  dcaEnabledSides,
  dcaExitLimitKey,
  dcaLegFor,
  dcaLegIsRunning,
  dcaWebhookSignalApplies,
  isDcaClipKey,
  isDcaExitLimitKey,
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
  for (const row of working) {
    if (row.reduceOnly) {
      continue;
    }
    if (!isDcaClipKey(row.idempotencyKey, input.playbook.id, input.side)) {
      continue;
    }
    await runFuturesCommand({
      actor: {
        userId: input.playbook.userId,
        accountId: input.playbook.accountId,
        mode: input.mode,
      },
      command: {
        kind: "cancel-working",
        workingId: row.id,
      },
    });
  }
}

async function cancelExitLimit(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
  kind: DcaExitLimitKind;
}): Promise<void> {
  const key = dcaExitLimitKey(input.playbook.id, input.side, input.kind);
  const working = await loadOpenFuturesWorking({
    accountId: input.playbook.accountId,
    userId: input.playbook.userId,
  });
  const rows = working.filter((item) =>
    isDcaExitLimitKey(
      item.idempotencyKey,
      input.playbook.id,
      input.side,
      input.kind,
    ),
  );
  for (const row of rows) {
    await runFuturesCommand({
      actor: {
        userId: input.playbook.userId,
        accountId: input.playbook.accountId,
        mode: input.mode,
      },
      command: {
        kind: "cancel-working",
        workingId: row.id,
      },
    });
  }
}

async function restExitLimit(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
  kind: DcaExitLimitKind;
  positionId: string;
  qty: number;
  limitPrice: number;
}): Promise<void> {
  if (!(input.qty > 0) || !(input.limitPrice > 0)) {
    return;
  }
  const key = dcaExitLimitKey(input.playbook.id, input.side, input.kind);
  const working = await loadOpenFuturesWorking({
    accountId: input.playbook.accountId,
    userId: input.playbook.userId,
  });
  const row = working.find((item) =>
    isDcaExitLimitKey(
      item.idempotencyKey,
      input.playbook.id,
      input.side,
      input.kind,
    ),
  );
  if (row) {
    if (
      sameWorkingNumber(row.remainingQty, input.qty) &&
      sameWorkingNumber(row.limitPrice, input.limitPrice)
    ) {
      return;
    }
    await runFuturesCommand({
      actor: {
        userId: input.playbook.userId,
        accountId: input.playbook.accountId,
        mode: input.mode,
      },
      command: {
        kind: "amend-working",
        workingId: row.id,
        qty: String(input.qty),
        limitPrice: String(input.limitPrice),
      },
    });
    return;
  }
  await runFuturesCommand({
    actor: {
      userId: input.playbook.userId,
      accountId: input.playbook.accountId,
      mode: input.mode,
    },
    command: {
      kind: "place",
      action: "flatten",
      symbol: input.playbook.symbol,
      positionId: input.positionId,
      orderType: "limit",
      limitPrice: String(input.limitPrice),
      size: String(input.qty),
      idempotencyKey: `${key}${String(Date.now()).slice(-6)}`,
      source: "engine",
      ruleName: input.playbook.name,
    },
  });
}

export async function syncDcaPlaybookGrid(input: {
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
  const working = await loadOpenFuturesWorking({
    accountId: input.playbook.accountId,
    userId: input.playbook.userId,
  });
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
    })),
  });
  const actor = {
    userId: input.playbook.userId,
    accountId: input.playbook.accountId,
    mode: input.mode,
  };
  for (const workingId of plan.cancelIds) {
    await runFuturesCommand({
      actor,
      command: { kind: "cancel-working", workingId },
    });
  }
  for (const item of plan.amend) {
    await runFuturesCommand({
      actor,
      command: {
        kind: "amend-working",
        workingId: item.workingId,
        qty: String(item.qty),
        limitPrice: String(item.limitPrice),
      },
    });
  }
  for (const item of plan.rest) {
    await runFuturesCommand({
      actor,
      command: {
        kind: "place",
        action: dcaClipAction(input.side),
        symbol: input.playbook.symbol,
        orderType: "limit",
        limitPrice: String(item.limitPrice),
        size: String(item.qty),
        sizeUnit: input.playbook.sizeUnit,
        idempotencyKey: `${dcaClipKey(input.playbook.id, input.side, item.clipIndex)}x${Date.now()}`,
        source: "engine",
        ruleName: input.playbook.name,
      },
    });
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
  const result = await runFuturesCommand({
    actor: {
      userId: input.playbook.userId,
      accountId: input.playbook.accountId,
      mode: input.mode,
    },
    command: {
      kind: "place",
      action: dcaClipAction(input.side),
      symbol: input.playbook.symbol,
      orderType: "market",
      size: String(size),
      sizeUnit: input.playbook.sizeUnit,
      idempotencyKey: dcaClipKey(input.playbook.id, input.side, leg.clipsFilled),
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
  const stopLoss = leg.breakevenDone
    ? dcaBreakevenPrice({
        side: input.side,
        basisPrice: open.entryPrice,
        offsetPct: input.playbook.breakevenOffsetPct ?? 0,
      })
    : planned.stopLoss;
  const current = tpslFromRow(open) ?? emptyFuturesTpsl();
  const tpType =
    planned.takeProfit === null ? "market" : input.playbook.takeProfitOrderType;
  const slType = "market";
  const nextTpsl = {
    ...current,
    takeProfit: planned.takeProfit,
    stopLoss,
    tpOrderType: tpType,
    slOrderType: slType,
    tpLimitPrice:
      planned.takeProfit !== null && tpType === "limit"
        ? planned.takeProfit
        : null,
    slLimitPrice:
      stopLoss !== null && slType === "limit" ? stopLoss : null,
  };
  if (
    !sameExitPrice(current.takeProfit, planned.takeProfit) ||
    !sameExitPrice(current.stopLoss, stopLoss) ||
    (planned.takeProfit !== null && current.tpOrderType !== tpType) ||
    (stopLoss !== null && current.slOrderType !== slType)
  ) {
    await runFuturesCommand({
      actor: {
        userId: input.playbook.userId,
        accountId: input.playbook.accountId,
        mode: input.mode,
      },
      command: {
        kind: "set-tpsl",
        positionId: open.id,
        symbol: input.playbook.symbol,
        form: new FormData(),
        tpsl: nextTpsl,
        venueTpsl: tpslWithoutLimitExits(nextTpsl),
      },
    });
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
  const compact = dcaClipKey(input.playbook.id, input.side, 0);
  const result = await runFuturesCommand({
    actor: {
      userId: input.playbook.userId,
      accountId: input.playbook.accountId,
      mode: input.mode,
    },
    command: {
      kind: "place",
      action: "flatten",
      symbol: input.playbook.symbol,
      positionId: open.id,
      orderType: "market",
      source: "engine",
      ruleName: input.playbook.name,
      idempotencyKey: `c${compact.slice(1)}${String(Date.now()).slice(-6)}`,
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
  const stop = dcaBreakevenPrice({
    side: input.side,
    basisPrice: open.entryPrice,
    offsetPct: input.playbook.breakevenOffsetPct ?? 0,
  });
  const current = tpslFromRow(open) ?? emptyFuturesTpsl();
  const result = await runFuturesCommand({
    actor: {
      userId: input.playbook.userId,
      accountId: input.playbook.accountId,
      mode: input.mode,
    },
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

  for (const side of sides) {
    const leg = dcaLegFor(playbook, side);
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
