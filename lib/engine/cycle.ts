import { deskIsCopy, parseDeskQuery, parseDeskType } from "@/lib/accounts/model";
import { runCashAndCarryDeskTick } from "@/lib/engine/cash-and-carry-tick";
import {
  ENGINE_CLAIM_BATCH,
  ENGINE_DESK_CONCURRENCY,
  ENGINE_HOT_CLAIM_BATCH,
  ENGINE_LEASE_TTL_SECONDS,
  ENGINE_SCAN_TTL_SECONDS,
} from "@/lib/engine/lease";
import {
  listEngineDeskKinds,
  listHotEngineAccountIds,
} from "@/lib/engine/hot-desks";
import {
  claimEngineDesks,
  engineWorkerId,
  releaseEngineDesk,
  takeVenueSlot,
  tryClaimEngineScan,
} from "@/lib/engine/lease-store";
import { mapPool } from "@/lib/engine/pool";
import { runDcaPlaybookTick } from "@/lib/dca/tick";
import { fetchBybitTickers } from "@/lib/exchanges/bybit/client";
import type { BybitTicker } from "@/lib/exchanges/bybit/client";
import { loadDeskTickerMap } from "@/lib/market/desk-tickers";
import {
  parseStoredVenueEnvironment,
  parseStoredVenueId,
} from "@/lib/exchanges/venues";
import {
  loadStoredOpportunities,
  persistOpportunities,
} from "@/lib/opportunities/persist";
import { scanCarryOpportunities } from "@/lib/opportunities/scan";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import { runFuturesAutomationTick } from "@/lib/futures/automation-tick";
import { reconcileOpenFuturesBooks } from "@/lib/futures/reconcile";
import { writeEventLog } from "@/lib/logs/write";
import { processOneQueuedBacktest } from "@/lib/backtest/execute";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";

export type EngineCycleStats = {
  users: number;
  opened: number;
  added: number;
  closed: number;
  clipped: number;
  desks: number;
  scanned: boolean;
  tickers: boolean;
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

  const [kinds, hotIds] = await Promise.all([
    listEngineDeskKinds(),
    listHotEngineAccountIds(),
  ]);
  const shared = await loadSharedMarket({
    workerId,
    cashAndCarry: kinds.cashAndCarry,
    linear: kinds.linear,
  });

  const stats: EngineCycleStats = {
    users: 0,
    opened: 0,
    added: 0,
    closed: 0,
    clipped: 0,
    desks: 0,
    scanned: shared.scanned,
    tickers: shared.tickersLoaded,
  };
  const users = new Set<string>();
  const done = new Set<string>();
  let wave = 0;

  while (maxMs === undefined || Date.now() - started < maxMs) {
    const hotLeft = hotIds.filter((id) => !done.has(id));
    const limit =
      wave === 0
        ? Math.max(batchSize, Math.min(hotLeft.length || batchSize, ENGINE_HOT_CLAIM_BATCH))
        : batchSize;
    const claimed = await claimEngineDesks({
      workerId,
      limit,
      ttlSeconds: ENGINE_LEASE_TTL_SECONDS,
      preferAccountIds: hotLeft,
      excludeAccountIds: [...done],
    });
    wave += 1;
    if (claimed.length === 0) {
      break;
    }
    await mapPool(claimed, ENGINE_DESK_CONCURRENCY, async (accountId) => {
      done.add(accountId);
      if (maxMs !== undefined && Date.now() - started >= maxMs) {
        await releaseEngineDesk({ accountId, workerId });
        return;
      }
      try {
        const desk = await runDeskTick({
          accountId,
          scan: shared.scan,
          tickers: shared.tickers,
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
    });
  }

  stats.users = users.size;
  if (maxMs === undefined || Date.now() - started < maxMs - 4_000) {
    try {
      await processOneQueuedBacktest();
    } catch (cause) {
      await writeEventLog({
        level: "error",
        scope: "system",
        event: "engine.tick",
        message:
          cause instanceof Error ? cause.message : "Backtest worker failed",
        data: { workerId },
      });
    }
  }
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
        scanned: stats.scanned,
        tickers: stats.tickers,
      },
    });
  }
  return stats;
}

async function loadSharedMarket(input: {
  workerId: string;
  cashAndCarry: boolean;
  linear: boolean;
}): Promise<{
  scan: ScannedOpportunity[];
  tickers: Map<string, BybitTicker>;
  scanned: boolean;
  tickersLoaded: boolean;
}> {
  let scan: ScannedOpportunity[] = [];
  let scanned = false;
  if (input.cashAndCarry) {
    const won = await tryClaimEngineScan({
      workerId: input.workerId,
      ttlSeconds: ENGINE_SCAN_TTL_SECONDS,
    });
    if (won) {
      scan = await scanCarryOpportunities();
      await persistOpportunities(scan);
      scanned = true;
    } else {
      scan = (await loadStoredOpportunities()).rows;
    }
  }
  const tickers = input.linear
    ? await fetchBybitTickers("linear").catch(
        () => new Map<string, BybitTicker>(),
      )
    : new Map<string, BybitTicker>();
  return {
    scan,
    tickers,
    scanned,
    tickersLoaded: input.linear,
  };
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
    .select("id, user_id, mode, desk_type, venue, venue_environment, copy_of_account_id")
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
  const copyDesk = deskIsCopy({
    copyOfAccountId: parseDeskQuery(
      (account as { copy_of_account_id?: unknown }).copy_of_account_id,
    ),
  });
  const venue = parseStoredVenueId((account as { venue?: unknown }).venue);
  const venueEnvironment = parseStoredVenueEnvironment(
    venue,
    (account as { venue_environment?: unknown }).venue_environment,
  );
  const tickers =
    venue === "hyperliquid"
      ? ((await loadDeskTickerMap(venue, venueEnvironment).catch(
          () => new Map(),
        )) as Map<string, BybitTicker>)
      : input.tickers;
  if (mode === "live") {
    await takeVenueSlot(
      await boundConnectionId({
        accountId: input.accountId,
        deskType,
      }),
    );
  }
  if (deskType !== "cash_and_carry") {
    try {
      await reconcileOpenFuturesBooks({
        accountId: input.accountId,
        userId,
        tickers,
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
  if (deskType === "perps_bots" && !copyDesk) {
    await runFuturesAutomationTick({
      accountId: input.accountId,
      tickers,
    });
    return { ...empty, userId };
  }
  if (deskType === "dca" && !copyDesk) {
    await runDcaPlaybookTick({
      accountId: input.accountId,
      tickers,
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
