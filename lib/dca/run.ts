import type { TradingAccountMode } from "@/lib/accounts/model";
import { fetchBybitTickers } from "@/lib/exchanges/bybit/client";
import { runFuturesCommand } from "@/lib/futures/command";
import { loadOpenFuturesOnSymbol } from "@/lib/futures/list";
import { tickerTriggerPrices } from "@/lib/futures/tpsl";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import { dcaClipAction, type DcaPlaybook } from "./playbook";
import { patchDcaPlaybook, resetDcaPlaybook } from "./store";

export type DcaVerb = "arm" | "disarm" | "close-playbook";

function clipKey(playbookId: string, clipsFilled: number): string {
  const compact = playbookId.replace(/-/g, "").slice(0, 8);
  return `d${compact}${clipsFilled}`;
}

async function lastPriceFor(symbol: string): Promise<number | null> {
  const tickers = await fetchBybitTickers("linear").catch(() => null);
  if (!tickers) {
    return null;
  }
  const prices = tickerTriggerPrices(tickers.get(symbol) ?? {});
  return prices.last;
}

async function placeClip(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  lastPrice: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await runFuturesCommand({
    actor: {
      userId: input.playbook.userId,
      accountId: input.playbook.accountId,
      mode: input.mode,
    },
    command: {
      kind: "place",
      action: dcaClipAction(input.playbook.side),
      symbol: input.playbook.symbol,
      orderType: "market",
      size: String(input.playbook.clipSize),
      sizeUnit: input.playbook.sizeUnit,
      idempotencyKey: clipKey(input.playbook.id, input.playbook.clipsFilled),
      source: "engine",
      ruleName: input.playbook.name,
    },
  });
  if (!result.ok) {
    return result;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Auth is not configured." };
  }
  return patchDcaPlaybook({
    supabase,
    id: input.playbook.id,
    patch: {
      status: "armed",
      clipsFilled: input.playbook.clipsFilled + 1,
      lastClipPrice: input.lastPrice,
      lastClipAtMs: Date.now(),
    },
  });
}

async function flattenPlaybook(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const opens = await loadOpenFuturesOnSymbol(input.playbook.symbol, {
    accountId: input.playbook.accountId,
    userId: input.playbook.userId,
  });
  const open = opens.find((row) => row.side === input.playbook.side);
  if (!open) {
    return { ok: true };
  }
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
      idempotencyKey: `c${input.playbook.id.replace(/-/g, "").slice(0, 8)}${Date.now()}`,
    },
  });
  return result.ok ? { ok: true } : result;
}

export async function applyDcaVerb(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  verb: DcaVerb;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Auth is not configured." };
  }
  if (input.verb === "disarm") {
    if (input.playbook.status === "idle") {
      return { ok: true, message: "Playbook is idle." };
    }
    const patched = await patchDcaPlaybook({
      supabase,
      id: input.playbook.id,
      patch: { status: "stop_adding" },
    });
    if (!patched.ok) {
      return patched;
    }
    return { ok: true, message: "Stopped adding. The position stays open." };
  }
  if (input.verb === "close-playbook") {
    const closed = await flattenPlaybook(input);
    if (!closed.ok) {
      return closed;
    }
    const reset = await resetDcaPlaybook({
      supabase,
      id: input.playbook.id,
    });
    if (!reset.ok) {
      return reset;
    }
    return { ok: true, message: "Playbook closed." };
  }

  if (input.playbook.status === "armed") {
    return { ok: true, message: "Playbook is already armed." };
  }
  if (input.playbook.status === "stop_adding") {
    const patched = await patchDcaPlaybook({
      supabase,
      id: input.playbook.id,
      patch: { status: "armed" },
    });
    if (!patched.ok) {
      return patched;
    }
    return { ok: true, message: "Playbook resumed adding." };
  }
  const lastPrice = await lastPriceFor(input.playbook.symbol);
  if (lastPrice === null) {
    return { ok: false, error: "Could not read the last price to arm." };
  }
  const placed = await placeClip({
    playbook: input.playbook,
    mode: input.mode,
    lastPrice,
  });
  if (!placed.ok) {
    return placed;
  }
  await writeEventLog({
    scope: "strategy",
    event: "dca.armed",
    message: `Armed ${input.playbook.name}.`,
    userId: input.playbook.userId,
    accountId: input.playbook.accountId,
    strategy: FUTURES_STRATEGY_ID,
    data: { playbookId: input.playbook.id, symbol: input.playbook.symbol },
  });
  return { ok: true, message: "Playbook armed. First clip placed." };
}

export { lastPriceFor, placeClip, flattenPlaybook };
