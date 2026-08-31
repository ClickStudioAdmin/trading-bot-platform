import {
  deskIsCopy,
  parseAccountMode,
  parseDeskQuery,
  parseTradingAccountRow,
} from "@/lib/accounts/model";
import { loadTradingAccountById } from "@/lib/accounts/store";
import { takeVenueSlot } from "@/lib/engine/lease-store";
import { loadAccountSnapshot } from "@/lib/exchanges/account-snapshot";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { loadDeskTickerMap } from "@/lib/market/desk-tickers";
import { CLOSE_ALL_CONFIRM } from "@/lib/futures/close-all";
import { runFuturesCommand } from "@/lib/futures/command";
import { loadFuturesPositions } from "@/lib/futures/list";
import { markFromTicker } from "@/lib/futures/math";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  loadCopyAvailableUsdt,
  loadCopyFollowerEquity,
  loadCopyGuardSnapshot,
} from "./balance";
import {
  COPY_FANOUT_MAX_FILLS,
  COPY_RULE_NAME,
  copyBreachIdempotencyKey,
  copyMinOrderRetryUsdt,
  copyParentFillNotional,
  copyParentFillPrice,
  copyUtcDayStartMs,
  decideCopyFanOut,
  parentCopyBookUsdt,
  type CopyParentFill,
} from "./decide";
import { loadDeskCopySettings, saveDeskCopySettings } from "./follower-settings";
import { loadDeskCopyListing } from "./listings";
import { copyMinBalanceMet, copyShareAllowsFanOut } from "./model";
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
  const [fills, shares, listing, parentSettings] = await Promise.all([
    loadParentCopyFills(
      input.parentAccountId,
      Number.isFinite(sinceMs) ? sinceMs : 0,
    ),
    loadDeskCopyShares(input.parentAccountId),
    loadDeskCopyListing(input.parentAccountId),
    loadFuturesSettings(input.parentAccountId),
  ]);
  if (fills.length === 0) {
    if (input.afterParentFill) {
      await logFanOutHalt({
        userId: input.parentUserId,
        accountId: input.parentAccountId,
        message: "No parent fills since follow. Copy did not run.",
      });
    }
    return;
  }
  const parentBook = parentSettings.connectionId
    ? await readParentCopyBook(input.parentUserId, parentSettings.connectionId)
    : { book: null, error: "Parent desk has no bound key." };
  if (!(parentBook.book != null && parentBook.book > 0)) {
    await logFanOutHalt({
      userId: input.parentUserId,
      accountId: input.parentAccountId,
      message: parentBook.error ?? "Could not read the parent book. Copy did not run.",
    });
    return;
  }
  const fillIds = fills.map((row) => row.id);
  const shareByUser = new Map(shares.map((row) => [row.toUserId, row] as const));

  for (const follower of followers) {
    try {
      await fanOutToFollower({
        parentAccountId: input.parentAccountId,
        parentAvailable: parentBook.book,
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
  parentAvailable: number;
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
  if (pending.length === 0) {
    return;
  }
  const [copySettings, futuresSettings, available, equity, guards, opens] =
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

  for (const fill of pending) {
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
      parentBalanceUsdt: input.parentAvailable,
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
        message: skipCopyReason(decision.reason),
        userId: input.follower.userId,
        accountId: input.follower.id,
        strategy: FUTURES_STRATEGY_ID,
        data: {
          parentFillId: fill.id,
          symbol: fill.symbol,
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
      const minUsdt = copyMinOrderRetryUsdt({
        error: placed.error,
        sizedUsdt: notionalUsdt,
        followerAvailableUsdt: available ?? 0,
      });
      if (minUsdt != null) {
        notionalUsdt = minUsdt;
        placed = await runFuturesCommand({
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
      }
    }
    if (!placed.ok) {
      await writeEventLog({
        level: "warning",
        scope: "trade",
        event: "copy.copy_skipped",
        message: placed.error,
        userId: input.follower.userId,
        accountId: input.follower.id,
        strategy: FUTURES_STRATEGY_ID,
        data: { parentFillId: fill.id, symbol: fill.symbol },
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
      message: `Copied ${fill.symbol} ${decision.place}`,
      userId: input.follower.userId,
      accountId: input.follower.id,
      strategy: FUTURES_STRATEGY_ID,
      data: {
        parentAccountId: input.parentAccountId,
        parentFillId: fill.id,
        notionalUsdt,
        replayed: placed.replayed === true,
      },
    });
  }
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

function skipCopyReason(reason: string): string {
  if (reason === "paused") {
    return "Copying is paused.";
  }
  if (reason === "revoked") {
    return "This follower is not an active share.";
  }
  if (reason === "reduce_only") {
    return "Reduce-only blocked a copied entry.";
  }
  if (reason === "unbound") {
    return "Live copy desk has no bound key.";
  }
  if (reason === "no_size") {
    return "Could not size the copied fill.";
  }
  if (reason === "min_balance") {
    return "Follower is below the listing min balance.";
  }
  if (reason === "no_position") {
    return "No follower position to close.";
  }
  if (reason === "before_follow") {
    return "Parent fill was before this copy desk existed.";
  }
  if (reason === "adverse_move") {
    return "Skipped entry after an adverse move.";
  }
  return `Skipped copied fill (${reason}).`;
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
