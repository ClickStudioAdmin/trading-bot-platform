import { parseDeskType } from "@/lib/accounts/model";
import { runCashAndCarryDeskTick } from "@/lib/engine/cash-and-carry-tick";
import {
  ENGINE_CLAIM_BATCH,
  ENGINE_LEASE_TTL_SECONDS,
} from "@/lib/engine/lease";
import {
  claimEngineDesks,
  engineWorkerId,
  releaseEngineDesk,
  takeVenueSlot,
} from "@/lib/engine/lease-store";
import { runDcaPlaybookTick } from "@/lib/dca/tick";
import { fetchBybitTickers } from "@/lib/exchanges/bybit/client";
import type { BybitTicker } from "@/lib/exchanges/bybit/client";
import { persistOpportunities } from "@/lib/opportunities/persist";
import { scanCarryOpportunities } from "@/lib/opportunities/scan";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import { runFuturesAutomationTick } from "@/lib/futures/automation-tick";
import { reconcileOpenFuturesBooks } from "@/lib/futures/reconcile";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";

export type EngineCycleStats = {
  users: number;
  opened: number;
  added: number;
  closed: number;
  clipped: number;
  desks: number;
};

export type EngineCycleOptions = {
  silent?: boolean;
  workerId?: string;
  maxMs?: number;
  batchSize?: number;
};

export async function runEngineCycle(
  options?: EngineCycleOptions,
): Promise<EngineCycleStats> {
  if (!createServiceClient()) {
    throw new Error("Auth is not configured.");
  }
  const workerId = options?.workerId ?? engineWorkerId();
  const batchSize = options?.batchSize ?? ENGINE_CLAIM_BATCH;
  const started = Date.now();
  const maxMs = options?.maxMs;

  const raw = await scanCarryOpportunities();
  await persistOpportunities(raw);
  const tickers = await fetchBybitTickers("linear").catch(
    () => new Map<string, BybitTicker>(),
  );

  const stats: EngineCycleStats = {
    users: 0,
    opened: 0,
    added: 0,
    closed: 0,
    clipped: 0,
    desks: 0,
  };
  const users = new Set<string>();

  while (maxMs === undefined || Date.now() - started < maxMs) {
    const claimed = await claimEngineDesks({
      workerId,
      limit: batchSize,
      ttlSeconds: ENGINE_LEASE_TTL_SECONDS,
    });
    if (claimed.length === 0) {
      break;
    }
    for (const accountId of claimed) {
      if (maxMs !== undefined && Date.now() - started >= maxMs) {
        await releaseEngineDesk({ accountId, workerId });
        continue;
      }
      try {
        const desk = await runDeskTick({
          accountId,
          scan: raw,
          tickers,
        });
        stats.opened += desk.opened;
        stats.added += desk.added;
        stats.closed += desk.closed;
        stats.clipped += desk.clipped;
        stats.desks += 1;
        if (desk.userId) {
          users.add(desk.userId);
        }
      } catch (cause) {
        await writeEventLog({
          level: "error",
          scope: "system",
          event: "engine.tick",
          message:
            cause instanceof Error ? cause.message : "Desk tick failed",
          accountId,
          data: { workerId },
        });
      } finally {
        await releaseEngineDesk({ accountId, workerId });
      }
    }
  }

  stats.users = users.size;
  if (!options?.silent) {
    await writeEventLog({
      scope: "system",
      event: "engine.tick",
      message: `Engine tick opened ${stats.opened}, added ${stats.added}, closed ${stats.closed}, clipped ${stats.clipped}`,
      strategy: "cash-and-carry",
      data: {
        users: stats.users,
        desks: stats.desks,
        opened: stats.opened,
        added: stats.added,
        closed: stats.closed,
        clipped: stats.clipped,
        workerId,
      },
    });
  }
  return stats;
}

async function runDeskTick(input: {
  accountId: string;
  scan: ScannedOpportunity[];
  tickers: Map<string, BybitTicker>;
}): Promise<{
  userId: string | null;
  opened: number;
  added: number;
  closed: number;
  clipped: number;
}> {
  const empty = {
    userId: null as string | null,
    opened: 0,
    added: 0,
    closed: 0,
    clipped: 0,
  };
  const supabase = createServiceClient();
  if (!supabase) {
    return empty;
  }
  const { data: account } = await supabase
    .from("trading_accounts")
    .select("id, user_id, mode, desk_type")
    .eq("id", input.accountId)
    .maybeSingle();
  if (!account) {
    return empty;
  }
  const userId = String((account as { user_id: string }).user_id);
  const mode = String((account as { mode: string }).mode);
  const deskType = parseDeskType(
    (account as { desk_type?: unknown }).desk_type,
  );
  await takeVenueSlot(
    await boundConnectionId({
      accountId: input.accountId,
      deskType,
    }),
  );
  try {
    await reconcileOpenFuturesBooks({
      accountId: input.accountId,
      userId,
    });
  } catch (cause) {
    await writeEventLog({
      level: "error",
      scope: "strategy",
      event: "trade.futures_working_failed",
      message:
        cause instanceof Error ? cause.message : "Working order tick failed",
      userId,
      accountId: input.accountId,
      strategy: FUTURES_STRATEGY_ID,
    });
  }
  if (deskType === "cash_and_carry") {
    const stats = await runCashAndCarryDeskTick({
      supabase,
      accountId: input.accountId,
      userId,
      mode,
      scan: input.scan,
    });
    return { userId, ...stats };
  }
  if (deskType === "perps") {
    await runFuturesAutomationTick({
      accountId: input.accountId,
      tickers: input.tickers,
    });
    return { ...empty, userId };
  }
  if (deskType === "dca") {
    await runDcaPlaybookTick({
      accountId: input.accountId,
      tickers: input.tickers,
    });
    return { ...empty, userId };
  }
  return { ...empty, userId };
}

async function boundConnectionId(input: {
  accountId: string;
  deskType: ReturnType<typeof parseDeskType>;
}): Promise<string | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  if (input.deskType === "cash_and_carry") {
    const { data } = await supabase
      .from("paper_engine_settings")
      .select("exchange_connection_id")
      .eq("account_id", input.accountId)
      .maybeSingle();
    const id = String(
      (data as { exchange_connection_id?: unknown } | null)
        ?.exchange_connection_id ?? "",
    ).trim();
    return id || null;
  }
  const { data } = await supabase
    .from("strategy_settings")
    .select("exchange_connection_id")
    .eq("account_id", input.accountId)
    .eq("strategy_id", FUTURES_STRATEGY_ID)
    .maybeSingle();
  const id = String(
    (data as { exchange_connection_id?: unknown } | null)
      ?.exchange_connection_id ?? "",
  ).trim();
  return id || null;
}
