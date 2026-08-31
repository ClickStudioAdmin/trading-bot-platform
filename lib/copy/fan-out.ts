import {
  deskIsCopy,
  parseAccountMode,
  parseDeskQuery,
  parseTradingAccountRow,
} from "@/lib/accounts/model";
import { loadTradingAccountById } from "@/lib/accounts/store";
import { parseDcaClipIndex } from "@/lib/dca/playbook";
import { listDcaPlaybooksForAccount } from "@/lib/dca/store";
import { dcaClipSizeAt } from "@/lib/dca/grid";
import { takeVenueSlot } from "@/lib/engine/lease-store";
import { loadAccountSnapshot } from "@/lib/exchanges/account-snapshot";
import { loadUsdtLinearPerps } from "@/lib/exchanges/bybit/perp";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { loadDeskTickerMap } from "@/lib/market/desk-tickers";
import { CLOSE_ALL_CONFIRM } from "@/lib/futures/close-all";
import { runFuturesCommand } from "@/lib/futures/command";
import { loadFuturesPositions, loadOpenFuturesWorking } from "@/lib/futures/list";
import { markFromTicker } from "@/lib/futures/math";
import { sameWorkingNumber, type FuturesWorkingOrder } from "@/lib/futures/working";
import { loadFuturesSettings, type FuturesSettings } from "@/lib/futures/settings";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import { hyperliquidInfoEnvironment } from "@/lib/venues/hyperliquid/desk";
import { loadHyperliquidLinearPerps } from "@/lib/venues/hyperliquid/market";
import {
  loadCopyAvailableUsdt,
  loadCopyFollowerEquity,
  loadCopyGuardSnapshot,
} from "./balance";
import {
  COPY_FANOUT_MAX_FILLS,
  COPY_FANOUT_MAX_WORKING,
  COPY_RULE_NAME,
  copiedWorkingMatchesParent,
  copyBreachIdempotencyKey,
  copyCycleKey,
  copyCycleMidParent,
  copyCycleReceiptKey,
  copyCycleSkipMessage,
  copyCycleSkipToken,
  copyFillIsEntry,
  copyFollowerAlreadyJoined,
  copyParentFillNotional,
  copyParentFillPrice,
  copyParentWorkingNotional,
  copyUtcDayStartMs,
  copyWorkingIdempotencyKey,
  decideCopyCycleSkip,
  decideCopyFanOut,
  parentCopyBookUsdt,
  type CopyCycleSkipReason,
  type CopyParentFill,
} from "./decide";
import { loadDeskCopySettings, saveDeskCopySettings } from "./follower-settings";
import { loadDeskCopyListing } from "./listings";
import {
  copyMinBalanceMet,
  copyShareAllowsFanOut,
  copySizedNotional,
  type DeskCopySettings,
} from "./model";
import { insertCopyReceipt, loadCopyReceiptFillIds } from "./receipts";
import { loadDeskCopyShares } from "./shares";

export async function fanOutCopyFills(input: {
  parentAccountId: string;
  parentUserId: string;
  tickers: Map<string, { lastPrice?: string; bid1Price?: string; ask1Price?: string }>;
  afterParentFill?: boolean;
}): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) {
    await logFanOutHalt({
      userId: input.parentUserId,
      accountId: input.parentAccountId,
      message: "Copy fan-out has no service role. Copy did not run.",
    });
    return;
  }
  const followers = await listCopyFollowerDesks(input.parentAccountId);
  if (followers.length === 0) {
    return;
  }
  const sinceMs = Math.min(
    ...followers.map((row) => row.createdAtMs).filter((ms) => ms > 0),
  );
  const parentAccount = await loadTradingAccountById(input.parentAccountId);
  const parentIsDca = parentAccount?.deskType === "dca";
  const [fills, parentWorking, parentOpens, shares, listing, parentSettings] =
    await Promise.all([
      loadParentCopyFills(
        input.parentAccountId,
        Number.isFinite(sinceMs) ? sinceMs : 0,
      ),
      loadOpenFuturesWorking({
        accountId: input.parentAccountId,
        userId: input.parentUserId,
      }),
      loadFuturesPositions({
        status: "open",
        scope: {
          accountId: input.parentAccountId,
          userId: input.parentUserId,
        },
      }),
      loadDeskCopyShares(input.parentAccountId),
      loadDeskCopyListing(input.parentAccountId),
      loadFuturesSettings(input.parentAccountId),
    ]);
  const [venueMins, parentPlaybooks] = parentIsDca
    ? await Promise.all([
        loadCopyVenueMins(
          parentAccount?.venue ?? "bybit",
          parentAccount?.venueEnvironment ?? null,
        ),
        listDcaPlaybooksForAccount(input.parentAccountId),
      ])
    : [new Map<string, { minQty: number; minNotionalUsdt: number }>(), []];
  const parentBook = parentSettings.connectionId
    ? await readParentCopyBook(input.parentUserId, parentSettings.connectionId)
    : { book: null, error: "Parent desk has no bound key." };
  if (
    !(parentBook.book != null && parentBook.book > 0) &&
    (fills.length > 0 || parentWorking.length > 0)
  ) {
    await logFanOutHalt({
      userId: input.parentUserId,
      accountId: input.parentAccountId,
      message: parentBook.error ?? "Could not read the parent book. Copy did not run.",
    });
  }
  const fillIds = fills.map((row) => row.id);
  const shareByUser = new Map(shares.map((row) => [row.toUserId, row] as const));

  for (const follower of followers) {
    try {
      await fanOutToFollower({
        parentAccountId: input.parentAccountId,
        parentAvailable: parentBook.book,
        parentIsDca,
        parentWorking,
        parentOpens,
        parentPlaybooks,
        venueMins,
        fills,
        fillIds,
        follower,
        shareActive: copyShareAllowsFanOut(
          shareByUser.get(follower.userId)?.status,
        ),
        minBalanceUsdt: listing?.minBalanceUsdt ?? null,
        tickers: input.tickers,
      });
    } catch (cause) {
      await writeEventLog({
        level: "error",
        scope: "trade",
        event: "copy.fanout_failed",
        message:
          cause instanceof Error ? cause.message : "Copy fan-out failed",
        userId: follower.userId,
        accountId: follower.id,
        strategy: FUTURES_STRATEGY_ID,
        data: { parentAccountId: input.parentAccountId },
      });
    }
  }
}

type CopyFollowerDesk = {
  id: string;
  userId: string;
  mode: "paper" | "live";
  createdAtMs: number;
};

async function listCopyFollowerDesks(
  parentAccountId: string,
): Promise<CopyFollowerDesk[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("trading_accounts")
    .select("*")
    .eq("copy_of_account_id", parentAccountId);
  if (error || !data) {
    return [];
  }
  return data
    .map((row) => parseTradingAccountRow(row as Record<string, unknown>))
    .filter((row) => parseDeskQuery(row.copyOfAccountId) === parentAccountId)
    .map((row) => ({
      id: row.id,
      userId: row.userId,
      mode: parseAccountMode(row.mode),
      createdAtMs: row.createdAtMs,
    }));
}

async function loadParentCopyFills(
  parentAccountId: string,
  sinceMs: number,
): Promise<CopyParentFill[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const windowed = await queryParentFillRows(parentAccountId, {
    sinceMs,
    limit: 200,
  });
  const recent = await queryParentFillRows(parentAccountId, { limit: 20 });
  const orders = mergeParentFillRows(windowed, recent);
  if (orders.length === 0) {
    return [];
  }
  const positionIds = [
    ...new Set(
      orders.map((row) => String((row as { position_id?: string }).position_id ?? "")),
    ),
  ].filter(Boolean);
  const { data: positions } = await supabase
    .from("futures_positions")
    .select("id, symbol, side")
    .in("id", positionIds);
  const byId = new Map(
    (positions ?? []).map((row) => [
      String((row as { id: string }).id),
      {
        symbol: String((row as { symbol?: string }).symbol ?? ""),
        side: (row as { side?: string }).side === "short" ? "short" : "long",
      } as const,
    ]),
  );
  const fills: CopyParentFill[] = [];
  for (const row of orders as Record<string, unknown>[]) {
    const id = String(row.id ?? "").trim();
    const position = byId.get(String(row.position_id ?? ""));
    const action = String(row.action ?? "");
    if (!id || !position?.symbol) {
      continue;
    }
    if (action !== "buy" && action !== "sell" && action !== "flatten") {
      continue;
    }
    const filledAt = new Date(String(row.filled_at ?? "")).getTime();
    const notionalUsdt = copyParentFillNotional({
      notionalUsdt: Number(row.notional_usdt) || null,
      qty: Number(row.qty) || 0,
      price: Number(row.price) || null,
    });
    if (!(notionalUsdt > 0) || !Number.isFinite(filledAt)) {
      continue;
    }
    fills.push({
      id,
      action,
      symbol: position.symbol,
      side: position.side,
      notionalUsdt,
      price: copyParentFillPrice({
        price: Number(row.price) || null,
        qty: Number(row.qty) || 0,
        notionalUsdt: Number(row.notional_usdt) || null,
      }),
      filledAtMs: filledAt,
    });
  }
  return fills.sort(
    (left, right) =>
      left.filledAtMs - right.filledAtMs || left.id.localeCompare(right.id),
  );
}

async function fanOutToFollower(input: {
  parentAccountId: string;
  parentAvailable: number | null;
  parentIsDca: boolean;
  parentWorking: FuturesWorkingOrder[];
  parentOpens: Awaited<ReturnType<typeof loadFuturesPositions>>;
  parentPlaybooks: Awaited<ReturnType<typeof listDcaPlaybooksForAccount>>;
  venueMins: Map<string, { minQty: number; minNotionalUsdt: number }>;
  fills: CopyParentFill[];
  fillIds: string[];
  follower: CopyFollowerDesk;
  shareActive: boolean;
  minBalanceUsdt: number | null;
  tickers: Map<string, { lastPrice?: string; bid1Price?: string; ask1Price?: string }>;
}): Promise<void> {
  const receipts = await loadCopyReceiptFillIds({
    followerAccountId: input.follower.id,
    parentFillIds: input.fillIds,
  });
  const pending = input.fills
    .filter((row) => !receipts.has(row.id))
    .slice(0, COPY_FANOUT_MAX_FILLS);
  const [copySettings, futuresSettings, available, equity, guards, opens, copiedWorking] =
    await Promise.all([
      loadDeskCopySettings(input.follower.id),
      loadFuturesSettings(input.follower.id),
      loadCopyAvailableUsdt({
        userId: input.follower.userId,
        accountId: input.follower.id,
        mode: input.follower.mode,
        tickers: input.tickers,
      }),
      loadCopyFollowerEquity({
        userId: input.follower.userId,
        accountId: input.follower.id,
        mode: input.follower.mode,
        tickers: input.tickers,
      }),
      loadCopyGuardSnapshot({
        userId: input.follower.userId,
        accountId: input.follower.id,
      }),
      loadFuturesPositions({
        status: "open",
        scope: {
          accountId: input.follower.id,
          userId: input.follower.userId,
        },
      }),
      loadOpenFuturesWorking({
        accountId: input.follower.id,
        userId: input.follower.userId,
      }),
    ]);
  if (
    equity != null &&
    equity > 0 &&
    (copySettings.equityPeakUsdt == null ||
      equity > copySettings.equityPeakUsdt)
  ) {
    await saveDeskCopySettings({
      accountId: input.follower.id,
      equityPeakUsdt: equity,
    });
    copySettings.equityPeakUsdt = equity;
  }
  const live = accountCanHoldConnections(input.follower.mode);
  const liveUnbound = live && !futuresSettings.connectionId;
  const minBalanceOk = copyMinBalanceMet({
    minBalanceUsdt: input.minBalanceUsdt,
    mode: input.follower.mode,
    availableBalance: available,
  }).ok;
  if (live && futuresSettings.connectionId) {
    await takeVenueSlot(futuresSettings.connectionId);
  }

  const skippedCycles = await applyCopyCycleGates({
    parentAccountId: input.parentAccountId,
    parentAvailable: input.parentAvailable,
    parentIsDca: input.parentIsDca,
    parentWorking: input.parentWorking,
    parentOpens: input.parentOpens,
    parentPlaybooks: input.parentPlaybooks,
    venueMins: input.venueMins,
    fills: input.fills,
    pending,
    follower: input.follower,
    copySettings,
    available,
    opens,
    copiedWorking,
    live,
    tickers: input.tickers,
  });

  await syncCopyWorkingOrders({
    parentAccountId: input.parentAccountId,
    parentAvailable: input.parentAvailable,
    parentWorking: input.parentWorking,
    skippedCycles,
    follower: input.follower,
    shareActive: input.shareActive,
    minBalanceOk,
    copySettings,
    futuresSettings,
    available,
    equity,
    guards,
    opens,
    tickers: input.tickers,
    liveUnbound,
  });

  const parentBook = input.parentAvailable;
  if (pending.length === 0 || !(parentBook != null && parentBook > 0)) {
    return;
  }

  for (const fill of pending) {
    if (skippedCycles.has(copyCycleKey(fill.symbol, fill.side))) {
      continue;
    }
    const hasFollowerPosition = opens.some(
      (row) => row.symbol === fill.symbol && row.side === fill.side,
    );
    const decision = decideCopyFanOut({
      paused: copySettings.paused,
      shareActive: input.shareActive,
      reduceOnly: futuresSettings.reduceOnly,
      liveUnbound,
      fill,
      followerCreatedAtMs: input.follower.createdAtMs,
      hasFollowerPosition,
      todayRealizedUsdt: guards.todayRealizedUsdt,
      maxDailyLossUsdt: copySettings.maxDailyLossUsdt,
      followerEquityUsdt: equity,
      equityPeakUsdt: copySettings.equityPeakUsdt,
      maxDrawdownPct: copySettings.maxDrawdownPct,
      markPrice: markFromTicker(input.tickers.get(fill.symbol) ?? {}),
      maxAdverseMovePct: copySettings.maxAdverseMovePct,
      parentBalanceUsdt: parentBook,
      followerAvailableUsdt: available ?? 0,
      sizeMode: copySettings.sizeMode,
      sizePercent: copySettings.sizePercent,
      sizeBookUsdt: copySettings.sizeBookUsdt,
      minBalanceOk,
    });
    if (decision.action === "flatten-pause") {
      await flattenAndPauseFollower({
        follower: input.follower,
        reason: decision.reason,
        parentFillId: fill.id,
      });
      await insertCopyReceipt({
        followerAccountId: input.follower.id,
        parentFillId: fill.id,
      });
      copySettings.paused = true;
      continue;
    }
    if (decision.action === "pause") {
      await saveDeskCopySettings({
        accountId: input.follower.id,
        paused: true,
      });
      copySettings.paused = true;
      await insertCopyReceipt({
        followerAccountId: input.follower.id,
        parentFillId: fill.id,
      });
      await writeEventLog({
        scope: "trade",
        event: "copy.paused",
        message: "Paused copying because the account dropped below the fixed book",
        userId: input.follower.userId,
        accountId: input.follower.id,
        strategy: FUTURES_STRATEGY_ID,
        data: { parentFillId: fill.id, reason: decision.reason },
      });
      continue;
    }
    if (decision.action === "skip") {
      const retryable =
        decision.reason === "no_size" ||
        decision.reason === "unbound" ||
        decision.reason === "min_balance";
      if (!retryable) {
        await insertCopyReceipt({
          followerAccountId: input.follower.id,
          parentFillId: fill.id,
        });
      }
      await writeEventLog({
        scope: "trade",
        event: "copy.copy_skipped",
        message: skipCopyReason(decision.reason, fill.symbol, fill.side),
        userId: input.follower.userId,
        accountId: input.follower.id,
        strategy: FUTURES_STRATEGY_ID,
        data: {
          parentAccountId: input.parentAccountId,
          parentFillId: fill.id,
          symbol: fill.symbol,
          side: fill.side,
          reason: decision.reason,
        },
      });
      continue;
    }
    const positionId = opens.find(
      (row) => row.symbol === fill.symbol && row.side === fill.side,
    )?.id;
    let notionalUsdt = decision.notionalUsdt;
    let placed = await runFuturesCommand({
      actor: {
        userId: input.follower.userId,
        accountId: input.follower.id,
        mode: input.follower.mode,
      },
      command: {
        kind: "place",
        action: decision.place,
        symbol: fill.symbol,
        orderType: "market",
        positionId: decision.place === "close" ? positionId : undefined,
        size: String(notionalUsdt),
        sizeUnit: "usdt",
        idempotencyKey: fill.id,
        source: "engine",
        ruleName: COPY_RULE_NAME,
      },
    });
    if (!placed.ok) {
      await writeEventLog({
        level: "warning",
        scope: "trade",
        event: "copy.copy_skipped",
        message: `Could not copy ${fill.symbol} ${fill.side}: ${placed.error}`,
        userId: input.follower.userId,
        accountId: input.follower.id,
        strategy: FUTURES_STRATEGY_ID,
        data: {
          parentAccountId: input.parentAccountId,
          parentFillId: fill.id,
          symbol: fill.symbol,
          side: fill.side,
        },
      });
      continue;
    }
    await insertCopyReceipt({
      followerAccountId: input.follower.id,
      parentFillId: fill.id,
    });
    const next = await loadFuturesPositions({
      status: "open",
      scope: {
        accountId: input.follower.id,
        userId: input.follower.userId,
      },
    });
    opens.splice(0, opens.length, ...next);
    await writeEventLog({
      scope: "trade",
      event: "copy.copied",
      message: `Copied ${fill.symbol} ${fill.side} ${decision.place} from the parent`,
      userId: input.follower.userId,
      accountId: input.follower.id,
      strategy: FUTURES_STRATEGY_ID,
      data: {
        parentAccountId: input.parentAccountId,
        parentFillId: fill.id,
        symbol: fill.symbol,
        side: fill.side,
        notionalUsdt,
        replayed: placed.replayed === true,
      },
    });
  }
}

async function syncCopyWorkingOrders(input: {
  parentAccountId: string;
  parentAvailable: number | null;
  parentWorking: FuturesWorkingOrder[];
  skippedCycles: Set<string>;
  follower: CopyFollowerDesk;
  shareActive: boolean;
  minBalanceOk: boolean;
  copySettings: DeskCopySettings;
  futuresSettings: FuturesSettings;
  available: number | null;
  equity: number | null;
  guards: { todayRealizedUsdt: number };
  opens: Awaited<ReturnType<typeof loadFuturesPositions>>;
  tickers: Map<string, { lastPrice?: string; bid1Price?: string; ask1Price?: string }>;
  liveUnbound: boolean;
}): Promise<void> {
  const copied = await loadOpenFuturesWorking({
    accountId: input.follower.id,
    userId: input.follower.userId,
  });
  const liveParent = input.parentWorking.filter(
    (row) => !input.skippedCycles.has(copyCycleKey(row.symbol, row.side)),
  );
  const findCopied = (parent: FuturesWorkingOrder) =>
    copied.find(
      (row) =>
        row.ruleName === COPY_RULE_NAME &&
        copiedWorkingMatchesParent(row.idempotencyKey, parent),
    );
  for (const row of copied) {
    if (row.ruleName !== COPY_RULE_NAME || !row.idempotencyKey) {
      continue;
    }
    const stillOnParent = liveParent.some((parent) =>
      copiedWorkingMatchesParent(row.idempotencyKey, parent),
    );
    if (stillOnParent) {
      continue;
    }
    const cancelled = await runFuturesCommand({
      actor: {
        userId: input.follower.userId,
        accountId: input.follower.id,
        mode: input.follower.mode,
      },
      command: { kind: "cancel-working", workingId: row.id },
    });
    if (!cancelled.ok) {
      await writeEventLog({
        level: "warning",
        scope: "trade",
        event: "copy.copy_skipped",
        message: `Could not cancel copied ${row.symbol} limit to match the parent: ${cancelled.error}`,
        userId: input.follower.userId,
        accountId: input.follower.id,
        strategy: FUTURES_STRATEGY_ID,
        data: {
          parentAccountId: input.parentAccountId,
          parentWorkingId: row.idempotencyKey,
          symbol: row.symbol,
        },
      });
      continue;
    }
    if (!cancelled.replayed) {
      await writeEventLog({
        scope: "trade",
        event: "copy.limit_cancelled",
        message: `Cancelled copied ${row.symbol} ${row.side} limit to match the parent`,
        userId: input.follower.userId,
        accountId: input.follower.id,
        strategy: FUTURES_STRATEGY_ID,
        data: {
          parentAccountId: input.parentAccountId,
          parentWorkingId: row.idempotencyKey,
          symbol: row.symbol,
          side: row.side,
        },
      });
    }
  }
  if (
    !(input.parentAvailable != null && input.parentAvailable > 0) ||
    liveParent.length === 0
  ) {
    return;
  }
  const parentBook = input.parentAvailable;
  for (const working of liveParent.slice(0, COPY_FANOUT_MAX_WORKING)) {
    const fill = workingAsCopyFill(working);
    if (!fill) {
      continue;
    }
    const hasFollowerPosition = input.opens.some(
      (row) => row.symbol === fill.symbol && row.side === fill.side,
    );
    const decision = decideCopyFanOut({
      paused: input.copySettings.paused,
      shareActive: input.shareActive,
      reduceOnly: input.futuresSettings.reduceOnly,
      liveUnbound: input.liveUnbound,
      fill,
      followerCreatedAtMs: 0,
      hasFollowerPosition,
      todayRealizedUsdt: input.guards.todayRealizedUsdt,
      maxDailyLossUsdt: input.copySettings.maxDailyLossUsdt,
      followerEquityUsdt: input.equity,
      equityPeakUsdt: input.copySettings.equityPeakUsdt,
      maxDrawdownPct: input.copySettings.maxDrawdownPct,
      markPrice: markFromTicker(input.tickers.get(fill.symbol) ?? {}),
      maxAdverseMovePct: null,
      parentBalanceUsdt: parentBook,
      followerAvailableUsdt: input.available ?? 0,
      sizeMode: input.copySettings.sizeMode,
      sizePercent: input.copySettings.sizePercent,
      sizeBookUsdt: input.copySettings.sizeBookUsdt,
      minBalanceOk: input.minBalanceOk,
    });
    if (decision.action === "skip") {
      continue;
    }
    if (decision.action !== "place") {
      continue;
    }
    const existing = findCopied(working);
    const clipKey = copyWorkingIdempotencyKey(working);
    if (existing) {
      const targetQty = decision.notionalUsdt / working.limitPrice;
      const samePrice = sameWorkingNumber(existing.limitPrice, working.limitPrice);
      const sameValue =
        Math.abs(existing.remainingQty * existing.limitPrice - decision.notionalUsdt) <=
        decision.notionalUsdt * 0.05 + 1;
      if (samePrice && sameValue) {
        continue;
      }
      const amended = await runFuturesCommand({
        actor: {
          userId: input.follower.userId,
          accountId: input.follower.id,
          mode: input.follower.mode,
        },
        command: {
          kind: "amend-working",
          workingId: existing.id,
          qty: String(targetQty),
          limitPrice: String(working.limitPrice),
        },
      });
      if (!amended.ok) {
        await writeEventLog({
          level: "warning",
          scope: "trade",
          event: "copy.copy_skipped",
          message: `Could not amend copied ${fill.symbol} limit to match the parent: ${amended.error}`,
          userId: input.follower.userId,
          accountId: input.follower.id,
          strategy: FUTURES_STRATEGY_ID,
          data: {
            parentAccountId: input.parentAccountId,
            parentWorkingId: working.id,
            symbol: fill.symbol,
            side: fill.side,
          },
        });
        continue;
      }
      if (!amended.replayed) {
        await writeEventLog({
          scope: "trade",
          event: "copy.limit_amended",
          message: `Amended copied ${fill.symbol} ${fill.side} limit to match the parent`,
          userId: input.follower.userId,
          accountId: input.follower.id,
          strategy: FUTURES_STRATEGY_ID,
          data: {
            parentAccountId: input.parentAccountId,
            parentWorkingId: working.id,
            symbol: fill.symbol,
            side: fill.side,
            notionalUsdt: decision.notionalUsdt,
            limitPrice: working.limitPrice,
          },
        });
      }
      continue;
    }
    const positionId = input.opens.find(
      (row) => row.symbol === fill.symbol && row.side === fill.side,
    )?.id;
    const notionalUsdt = decision.notionalUsdt;
    const placed = await runFuturesCommand({
      actor: {
        userId: input.follower.userId,
        accountId: input.follower.id,
        mode: input.follower.mode,
      },
      command: {
        kind: "place",
        action: decision.place,
        symbol: fill.symbol,
        orderType: "limit",
        limitPrice: String(working.limitPrice),
        positionId: decision.place === "close" ? positionId : undefined,
        size: String(notionalUsdt),
        sizeUnit: "usdt",
        idempotencyKey: clipKey,
        source: "engine",
        ruleName: COPY_RULE_NAME,
      },
    });
    if (!placed.ok) {
      await writeEventLog({
        level: "warning",
        scope: "trade",
        event: "copy.copy_skipped",
        message: `Could not copy ${fill.symbol} ${fill.side} limit: ${placed.error}`,
        userId: input.follower.userId,
        accountId: input.follower.id,
        strategy: FUTURES_STRATEGY_ID,
        data: {
          parentAccountId: input.parentAccountId,
          parentWorkingId: working.id,
          symbol: fill.symbol,
          side: fill.side,
        },
      });
      continue;
    }
    if (!placed.replayed) {
      await writeEventLog({
        scope: "trade",
        event: "copy.limit_copied",
        message: `Copied ${fill.symbol} ${fill.side} limit from the parent`,
        userId: input.follower.userId,
        accountId: input.follower.id,
        strategy: FUTURES_STRATEGY_ID,
        data: {
          parentAccountId: input.parentAccountId,
          parentWorkingId: working.id,
          symbol: fill.symbol,
          side: fill.side,
          notionalUsdt,
          limitPrice: working.limitPrice,
        },
      });
    }
  }
}

async function applyCopyCycleGates(input: {
  parentAccountId: string;
  parentAvailable: number | null;
  parentIsDca: boolean;
  parentWorking: FuturesWorkingOrder[];
  parentOpens: Awaited<ReturnType<typeof loadFuturesPositions>>;
  parentPlaybooks: Awaited<ReturnType<typeof listDcaPlaybooksForAccount>>;
  venueMins: Map<string, { minQty: number; minNotionalUsdt: number }>;
  fills: CopyParentFill[];
  pending: CopyParentFill[];
  follower: CopyFollowerDesk;
  copySettings: DeskCopySettings;
  available: number | null;
  opens: Awaited<ReturnType<typeof loadFuturesPositions>>;
  copiedWorking: FuturesWorkingOrder[];
  live: boolean;
  tickers: Map<string, { lastPrice?: string; bid1Price?: string; ask1Price?: string }>;
}): Promise<Set<string>> {
  const skipped = new Set<string>();
  if (!input.parentIsDca) {
    return skipped;
  }
  const keys = new Set<string>();
  for (const row of input.parentOpens) {
    keys.add(copyCycleKey(row.symbol, row.side));
  }
  for (const row of input.parentWorking) {
    keys.add(copyCycleKey(row.symbol, row.side));
  }
  for (const row of input.pending) {
    if (copyFillIsEntry(row.action)) {
      keys.add(copyCycleKey(row.symbol, row.side));
    }
  }
  for (const key of keys) {
    const [symbol, side] = key.split(":") as [string, "long" | "short"];
    const parentHasPosition = input.parentOpens.some(
      (row) => row.symbol === symbol && row.side === side,
    );
    const parentPositionId =
      input.parentOpens.find((row) => row.symbol === symbol && row.side === side)
        ?.id ?? null;
    const entryWorkings = input.parentWorking.filter(
      (row) =>
        row.symbol === symbol &&
        row.side === side &&
        !row.reduceOnly &&
        parseDcaClipIndex(row.idempotencyKey) != null,
    );
    const entryClipIndexes = entryWorkings
      .map((row) => parseDcaClipIndex(row.idempotencyKey))
      .filter((index): index is number => index != null);
    const hasNewEntryFillAfterFollow = input.pending.some(
      (row) =>
        row.symbol === symbol &&
        row.side === side &&
        copyFillIsEntry(row.action) &&
        row.filledAtMs >= input.follower.createdAtMs,
    );
    const parentHadEntryBeforeFollow = input.fills.some(
      (row) =>
        row.symbol === symbol &&
        row.side === side &&
        copyFillIsEntry(row.action) &&
        row.filledAtMs < input.follower.createdAtMs,
    );
    const alreadyJoined = copyFollowerAlreadyJoined({
      hasFollowerPosition: input.opens.some(
        (row) => row.symbol === symbol && row.side === side,
      ),
      hasCopiedWorking: input.copiedWorking.some(
        (row) =>
          row.ruleName === COPY_RULE_NAME &&
          row.symbol === symbol &&
          row.side === side,
      ),
    });
    const parentBook = input.parentAvailable;
    const ladderClips: { sizedUsdt: number; price: number }[] = [];
    if (parentBook != null && parentBook > 0) {
      const sources: { notionalUsdt: number; price: number | null }[] = [
        ...entryWorkings.map((row) => ({
          notionalUsdt: copyParentWorkingNotional({
            remainingQty: row.remainingQty,
            qty: row.qty,
            filledQty: row.filledQty,
            limitPrice: row.limitPrice,
          }),
          price: row.limitPrice,
        })),
        ...input.pending
          .filter(
            (row) =>
              row.symbol === symbol &&
              row.side === side &&
              copyFillIsEntry(row.action),
          )
          .map((row) => ({
            notionalUsdt: row.notionalUsdt,
            price:
              row.price ??
              markFromTicker(input.tickers.get(symbol) ?? {}),
          })),
      ];
      const playbook = input.parentPlaybooks.find((row) => row.symbol === symbol);
      const mark = markFromTicker(input.tickers.get(symbol) ?? {});
      const priceGuess =
        entryWorkings[0]?.limitPrice ??
        sources.find((row) => row.price != null && row.price > 0)?.price ??
        mark;
      if (playbook && priceGuess != null && priceGuess > 0) {
        const clipCount = Math.min(playbook.maxClips ?? 8, 40);
        for (let index = 0; index < clipCount; index += 1) {
          const raw = dcaClipSizeAt(
            index,
            playbook.clipSize,
            playbook.sizeMultiplier,
          );
          const notionalUsdt =
            playbook.sizeUnit === "usdt" ? raw : raw * priceGuess;
          sources.push({ notionalUsdt, price: priceGuess });
        }
      }
      for (const source of sources) {
        const price = source.price;
        if (!(source.notionalUsdt > 0) || !(price != null && price > 0)) {
          continue;
        }
        const sized = copySizedNotional({
          parentFillUsdt: source.notionalUsdt,
          parentBalanceUsdt: parentBook,
          followerAvailableUsdt: input.available ?? 0,
          sizeMode: input.copySettings.sizeMode,
          sizePercent: input.copySettings.sizePercent,
          sizeBookUsdt: input.copySettings.sizeBookUsdt,
        });
        if (sized.ok) {
          ladderClips.push({ sizedUsdt: sized.notionalUsdt, price });
        }
      }
    }
    const mins = input.venueMins.get(symbol) ?? {
      minQty: 0,
      minNotionalUsdt: 0,
    };
    const reason = decideCopyCycleSkip({
      parentIsDca: true,
      alreadyJoined,
      midParent: copyCycleMidParent({
        parentHasPosition,
        entryClipIndexes,
        hasNewEntryFillAfterFollow,
        parentHadEntryBeforeFollow,
      }),
      live: input.live,
      ladderClips,
      minQty: mins.minQty,
      minNotionalUsdt: mins.minNotionalUsdt,
    });
    if (!reason) {
      continue;
    }
    skipped.add(key);
    await logCopyCycleSkipOnce({
      follower: input.follower,
      parentAccountId: input.parentAccountId,
      reason,
      symbol,
      side,
      token: copyCycleSkipToken({
        parentPositionId,
        minClipIndex:
          entryClipIndexes.length > 0 ? Math.min(...entryClipIndexes) : null,
      }),
    });
    for (const fill of input.pending) {
      if (fill.symbol === symbol && fill.side === side) {
        await insertCopyReceipt({
          followerAccountId: input.follower.id,
          parentFillId: fill.id,
        });
      }
    }
  }
  return skipped;
}

async function logCopyCycleSkipOnce(input: {
  follower: CopyFollowerDesk;
  parentAccountId: string;
  reason: CopyCycleSkipReason;
  symbol: string;
  side: "long" | "short";
  token: string;
}): Promise<void> {
  const receiptId = copyCycleReceiptKey(
    input.reason,
    input.symbol,
    input.side,
    input.token,
  );
  const existing = await loadCopyReceiptFillIds({
    followerAccountId: input.follower.id,
    parentFillIds: [receiptId],
  });
  if (existing.has(receiptId)) {
    return;
  }
  await insertCopyReceipt({
    followerAccountId: input.follower.id,
    parentFillId: receiptId,
  });
  await writeEventLog({
    scope: "trade",
    event: "copy.cycle_skipped",
    message: copyCycleSkipMessage(input.reason, input.symbol, input.side),
    userId: input.follower.userId,
    accountId: input.follower.id,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      parentAccountId: input.parentAccountId,
      symbol: input.symbol,
      side: input.side,
      reason: input.reason,
    },
  });
}

async function loadCopyVenueMins(
  venue: string,
  venueEnvironment: string | null,
): Promise<Map<string, { minQty: number; minNotionalUsdt: number }>> {
  const out = new Map<string, { minQty: number; minNotionalUsdt: number }>();
  try {
    const pairs =
      venue === "hyperliquid"
        ? await loadHyperliquidLinearPerps(
            hyperliquidInfoEnvironment(venueEnvironment),
          )
        : await loadUsdtLinearPerps();
    for (const row of pairs) {
      out.set(row.symbol, {
        minQty: row.minQty,
        minNotionalUsdt: row.minNotional,
      });
    }
  } catch {
    return out;
  }
  return out;
}

function workingAsCopyFill(row: FuturesWorkingOrder): CopyParentFill | null {
  const notionalUsdt = copyParentWorkingNotional({
    remainingQty: row.remainingQty,
    qty: row.qty,
    filledQty: row.filledQty,
    limitPrice: row.limitPrice,
  });
  if (!(notionalUsdt > 0) || !row.symbol) {
    return null;
  }
  return {
    id: row.id,
    action: row.reduceOnly ? "flatten" : row.action,
    symbol: row.symbol,
    side: row.side,
    notionalUsdt,
    price: row.limitPrice,
    filledAtMs: Date.now(),
  };
}

async function flattenAndPauseFollower(input: {
  follower: CopyFollowerDesk;
  reason: "daily_loss" | "drawdown";
  parentFillId: string;
}): Promise<void> {
  const dayStart = copyUtcDayStartMs(Date.now());
  await runFuturesCommand({
    actor: {
      userId: input.follower.userId,
      accountId: input.follower.id,
      mode: input.follower.mode,
    },
    command: {
      kind: "close-all",
      scope: "all",
      confirm: CLOSE_ALL_CONFIRM,
      setReduceOnly: "on",
      idempotencyKey: copyBreachIdempotencyKey(input.follower.id, dayStart),
    },
  });
  await saveDeskCopySettings({
    accountId: input.follower.id,
    paused: true,
  });
  await writeEventLog({
    scope: "trade",
    event: "copy.breach_flattened",
    message:
      input.reason === "drawdown"
        ? "Flattened and paused after max drawdown"
        : "Flattened and paused after max daily loss",
    userId: input.follower.userId,
    accountId: input.follower.id,
    strategy: FUTURES_STRATEGY_ID,
    data: { reason: input.reason, parentFillId: input.parentFillId },
  });
}

function skipCopyReason(
  reason: string,
  symbol?: string,
  side?: string,
): string {
  const target =
    symbol && side ? `${symbol} ${side}` : symbol ? symbol : "this trade";
  if (reason === "paused") {
    return `Skipped ${target}. Copying is paused.`;
  }
  if (reason === "revoked") {
    return `Skipped ${target}. This follower is not an active share.`;
  }
  if (reason === "reduce_only") {
    return `Skipped ${target}. Reduce-only blocked a copied entry.`;
  }
  if (reason === "unbound") {
    return `Skipped ${target}. Live copy desk has no bound key.`;
  }
  if (reason === "no_size") {
    return `Skipped ${target}. Could not size the copied fill.`;
  }
  if (reason === "min_balance") {
    return `Skipped ${target}. Follower is below the listing min balance.`;
  }
  if (reason === "no_position") {
    return `Skipped ${target}. No follower position to close.`;
  }
  if (reason === "before_follow") {
    return `Skipped ${target}. Parent fill was before this copy desk existed.`;
  }
  if (reason === "adverse_move") {
    return `Skipped ${target}. Mark moved against the parent fill.`;
  }
  return `Skipped ${target} (${reason}).`;
}

export async function maybeFanOutAfterParentFill(input: {
  accountId: string;
  userId: string;
}): Promise<void> {
  const account = await loadTradingAccountById(input.accountId);
  if (!account) {
    await logFanOutHalt({
      userId: input.userId,
      accountId: input.accountId,
      message: "Copy fan-out could not load the parent desk.",
    });
    return;
  }
  if (deskIsCopy(account)) {
    return;
  }
  let tickers = new Map<
    string,
    { lastPrice?: string; bid1Price?: string; ask1Price?: string }
  >();
  try {
    tickers = await loadDeskTickerMap(account.venue, account.venueEnvironment);
  } catch (cause) {
    await writeEventLog({
      level: "warning",
      scope: "trade",
      event: "copy.fanout_failed",
      message:
        cause instanceof Error
          ? `Copy marks failed (${cause.message}). Copying without them.`
          : "Copy marks failed. Copying without them.",
      userId: input.userId,
      accountId: account.id,
      strategy: FUTURES_STRATEGY_ID,
    });
  }
  await fanOutCopyFills({
    parentAccountId: account.id,
    parentUserId: input.userId,
    tickers,
    afterParentFill: true,
  });
}

async function queryParentFillRows(
  parentAccountId: string,
  input: { sinceMs?: number; limit: number },
): Promise<Record<string, unknown>[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  let query = supabase
    .from("futures_orders")
    .select("id, action, qty, price, notional_usdt, filled_at, position_id")
    .eq("account_id", parentAccountId)
    .order("filled_at", { ascending: false })
    .limit(input.limit);
  if (input.sinceMs != null && input.sinceMs > 0) {
    query = query.gte("filled_at", new Date(input.sinceMs).toISOString());
  }
  const { data, error } = await query;
  if (error || !data) {
    return [];
  }
  return data as Record<string, unknown>[];
}

function mergeParentFillRows(
  ...groups: readonly Record<string, unknown>[][]
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const group of groups) {
    for (const row of group) {
      const id = String(row.id ?? "").trim();
      if (id) {
        byId.set(id, row);
      }
    }
  }
  return [...byId.values()];
}

async function readParentCopyBook(
  userId: string,
  connectionId: string,
): Promise<{ book: number | null; error: string | null }> {
  const snapshot = await loadAccountSnapshot(userId, connectionId);
  if (!snapshot.ok) {
    return { book: null, error: snapshot.error };
  }
  const book = parentCopyBookUsdt({
    availableBalance: snapshot.snapshot.availableBalance,
    marginBalance: snapshot.snapshot.marginBalance,
  });
  if (book == null) {
    return {
      book: null,
      error: "Parent available and margin are both 0. Copy did not run.",
    };
  }
  return { book, error: null };
}

async function logFanOutHalt(input: {
  userId: string;
  accountId: string;
  message: string;
}): Promise<void> {
  await writeEventLog({
    level: "warning",
    scope: "trade",
    event: "copy.fanout_failed",
    message: input.message,
    userId: input.userId,
    accountId: input.accountId,
    strategy: FUTURES_STRATEGY_ID,
  });
}
