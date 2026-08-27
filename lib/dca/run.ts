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
} from "@/lib/futures/tpsl";
import type { FuturesTrailing } from "@/lib/futures/trailing";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  dcaBreakevenPrice,
  dcaClipSizeAt,
  dcaSafetyPrices,
  dcaTrailingActivationPrice,
  dcaTrailingDistance,
} from "./grid";
import {
  dcaClipAction,
  dcaClipKey,
  dcaEnabledSides,
  dcaLegFor,
  dcaLegIsRunning,
  type DcaPlaybook,
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
    if (
      row.symbol !== input.playbook.symbol ||
      row.action !== dcaClipAction(input.side) ||
      row.ruleName !== input.playbook.name ||
      row.source !== "engine" ||
      row.reduceOnly
    ) {
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

async function restSafetyOrders(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
  entryPrice: number;
}): Promise<void> {
  if (input.playbook.dcaMode !== "order" || input.playbook.maxClips === null) {
    return;
  }
  if (input.playbook.maxClips < 2 || input.playbook.dipPct === null) {
    return;
  }
  const prices = dcaSafetyPrices({
    side: input.side,
    entryPrice: input.entryPrice,
    maxClips: input.playbook.maxClips,
    dipPct: input.playbook.dipPct,
    deviationMultiplier: input.playbook.deviationMultiplier,
  });
  for (let i = 0; i < prices.length; i += 1) {
    const clipIndex = i + 1;
    const size = dcaClipSizeAt(
      clipIndex,
      input.playbook.clipSize,
      input.playbook.sizeMultiplier,
    );
    if (!(size > 0) || !(prices[i] > 0)) {
      continue;
    }
    await runFuturesCommand({
      actor: {
        userId: input.playbook.userId,
        accountId: input.playbook.accountId,
        mode: input.mode,
      },
      command: {
        kind: "place",
        action: dcaClipAction(input.side),
        symbol: input.playbook.symbol,
        orderType: "limit",
        limitPrice: String(prices[i]),
        size: String(size),
        sizeUnit: input.playbook.sizeUnit,
        idempotencyKey: dcaClipKey(input.playbook.id, input.side, clipIndex),
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
  if (firstClip) {
    await restSafetyOrders({
      playbook: input.playbook,
      mode: input.mode,
      side: input.side,
      entryPrice: input.lastPrice,
    });
  }
  return { ok: true };
}

async function flattenSide(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await cancelSafetyOrders(input);
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
  const playbook = input.playbook;

  for (const side of sides) {
    const leg = dcaLegFor(playbook, side);
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

export {
  lastPriceFor,
  placeClip,
  flattenSide as flattenPlaybook,
  moveStopToBreakeven,
  cancelSafetyOrders,
};
