import {
  parseAccountMode,
  parseDeskQuery,
  parseTradingAccountRow,
} from "@/lib/accounts/model";
import { takeVenueSlot } from "@/lib/engine/lease-store";
import { loadAccountSnapshot } from "@/lib/exchanges/account-snapshot";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
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
  copyParentFillNotional,
  copyParentFillPrice,
  copyUtcDayStartMs,
  decideCopyFanOut,
  type CopyParentFill,
} from "./decide";
import { loadDeskCopySettings, saveDeskCopySettings } from "./follower-settings";
import { loadDeskCopyListing } from "./listings";
import { copyMinBalanceMet } from "./model";
import { insertCopyReceipt, loadCopyReceiptFillIds } from "./receipts";
import { loadDeskCopyShares } from "./shares";

export async function fanOutCopyFills(input: {
  parentAccountId: string;
  parentUserId: string;
  tickers: Map<string, { lastPrice?: string; bid1Price?: string; ask1Price?: string }>;
}): Promise<void> {
  const supabase = createServiceClient();
  if (!supabase) {
    return;
  }
  const followers = await listCopyFollowerDesks(input.parentAccountId);
  if (followers.length === 0) {
    return;
  }
  const [fills, shares, listing, parentSettings] = await Promise.all([
    loadParentCopyFills(input.parentAccountId),
    loadDeskCopyShares(input.parentAccountId),
    loadDeskCopyListing(input.parentAccountId),
    loadFuturesSettings(input.parentAccountId),
  ]);
  if (fills.length === 0) {
    return;
  }
  const parentAvailable = parentSettings.connectionId
    ? await readLiveAvailable(input.parentUserId, parentSettings.connectionId)
    : null;
  if (!(parentAvailable != null && parentAvailable > 0)) {
    return;
  }
  const fillIds = fills.map((row) => row.id);
  const shareByUser = new Map(shares.map((row) => [row.toUserId, row] as const));

  for (const follower of followers) {
    try {
      await fanOutToFollower({
        parentAccountId: input.parentAccountId,
        parentAvailable,
        fills,
        fillIds,
        follower,
        shareActive: shareByUser.get(follower.userId)?.status === "active",
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
): Promise<CopyParentFill[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const { data: orders, error } = await supabase
    .from("futures_orders")
    .select("id, action, qty, price, notional_usdt, filled_at, position_id")
    .eq("account_id", parentAccountId)
    .order("filled_at", { ascending: true })
    .limit(150);
  if (error || !orders || orders.length === 0) {
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
  return fills;
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
      await insertCopyReceipt({
        followerAccountId: input.follower.id,
        parentFillId: fill.id,
      });
      if (decision.reason === "adverse_move") {
        await writeEventLog({
          scope: "trade",
          event: "copy.copy_skipped",
          message: "Skipped entry after an adverse move",
          userId: input.follower.userId,
          accountId: input.follower.id,
          strategy: FUTURES_STRATEGY_ID,
          data: {
            parentFillId: fill.id,
            symbol: fill.symbol,
            reason: decision.reason,
          },
        });
      }
      continue;
    }
    const positionId = opens.find(
      (row) => row.symbol === fill.symbol && row.side === fill.side,
    )?.id;
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
        orderType: "market",
        positionId: decision.place === "close" ? positionId : undefined,
        size: String(decision.notionalUsdt),
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
        notionalUsdt: decision.notionalUsdt,
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

async function readLiveAvailable(
  userId: string,
  connectionId: string,
): Promise<number | null> {
  const snapshot = await loadAccountSnapshot(userId, connectionId);
  if (!snapshot.ok) {
    return null;
  }
  const available = snapshot.snapshot.availableBalance;
  return available != null && Number.isFinite(available) ? available : null;
}
