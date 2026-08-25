"use server";

import { decideFuturesAction, hedgePositionIdx } from "./decide";
import {
  insertFuturesWorking,
  patchFuturesTpsl,
  writeFuturesAdd,
  writeFuturesFlatten,
  writeFuturesOpen,
} from "./ledger";
import { loadOpenFuturesOnSymbol, loadOpenFuturesWorking } from "./list";
import { markFromTicker } from "./math";
import {
  parseFuturesAction,
  parseFuturesLimitPrice,
  parseFuturesNotional,
  parseFuturesOrderType,
  parseFuturesQty,
  parseFuturesSizeUnit,
  parseFuturesSymbol,
} from "./model";
import { safeFuturesReturnPath } from "./path";
import {
  cancelFuturesWorkingRow,
  reconcileOpenFuturesBooks,
} from "./reconcile";
import { loadFuturesSettings } from "./settings";
import {
  formatStrategyDetachBlockers,
  strategyDetachBlockers,
} from "@/lib/accounts/model";
import { getSessionContext } from "@/lib/auth/session";
import { fetchBybitTicker } from "@/lib/exchanges/bybit/client";
import { loadPerpInstrument, priceForPerp, qtyForPerp, qtyForPerpNotional } from "@/lib/exchanges/bybit/perp";
import {
  cancelPerpOrderOnVenue,
  placePerpLimitOnVenue,
  placePerpMarketOnVenue,
  setPerpTradingStopOnVenue,
} from "@/lib/exchanges/execute";
import { loadBoundVenueForAccount } from "@/lib/exchanges/live-trade";
import {
  listExchangeConnections,
  type BoundConnectionSecrets,
} from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_PATHS, FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  parseFuturesTpslForm,
  parseFuturesTpslPatch,
  tpslHasLevels,
  validateTpslVsReference,
  venueTpslFields,
  venueTradingStopFields,
} from "./tpsl";

function fail(next: string, message: string): never {
  redirect(`${next}?paperError=${encodeURIComponent(message)}`);
}

function settingsFail(message: string): never {
  redirect(
    `${FUTURES_PATHS.settings}?error=${encodeURIComponent(message)}`,
  );
}

export async function submitFuturesTrade(formData: FormData) {
  const next = safeFuturesReturnPath(String(formData.get("next") ?? ""));
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member: user, account } = session;
  const liveBook = accountCanHoldConnections(account.mode);

  const actionParsed = parseFuturesAction(formData.get("action"));
  if (!actionParsed.ok) {
    fail(next, actionParsed.error);
  }
  const symbolParsed = parseFuturesSymbol(formData.get("symbol"));
  if (!symbolParsed.ok) {
    fail(next, symbolParsed.error);
  }
  const symbol = symbolParsed.symbol;

  const supabase = createServiceClient();
  if (!supabase) {
    fail(next, "Auth is not configured.");
  }

  const settings = await loadFuturesSettings(account.id);
  const opens = await loadOpenFuturesOnSymbol(symbol);
  const wantedSide = actionParsed.action === "buy" ? "long" : "short";
  const flattenId = String(formData.get("positionId") ?? "").trim();
  const flattenTargets =
    actionParsed.action === "flatten"
      ? flattenId
        ? opens.filter((row) => row.id === flattenId)
        : []
      : [];
  if (actionParsed.action === "flatten" && flattenTargets.length === 0) {
    fail(
      next,
      flattenId
        ? "That position is no longer open."
        : "Close from the open row.",
    );
  }

  const instrument = await loadPerpInstrument(symbol);
  if (!instrument) {
    fail(next, "That symbol is not a trading USDT linear perpetual on Bybit.");
  }

  const ticker = await fetchBybitTicker("linear", symbol);
  const mark = markFromTicker(ticker ?? {});
  if (mark === null) {
    fail(next, "Could not read a mark price for that contract.");
  }

  const boundLive = async () => {
    if (!liveBook) {
      return null;
    }
    if (!settings.connectionId) {
      fail(next, "Bind an exchange in Futures Strategy Settings before trading.");
    }
    const bound = await loadBoundVenueForAccount({
      userId: user.id,
      accountId: account.id,
      mode: account.mode,
      connectionId: settings.connectionId,
    });
    if (!bound.ok) {
      fail(next, bound.error);
    }
    return bound.connection;
  };

  if (actionParsed.action === "flatten") {
    const connection = await boundLive();
    for (const row of flattenTargets) {
      const decided = decideFuturesAction({
        action: "flatten",
        open: { side: row.side, qty: row.qty },
        reduceOnly: settings.reduceOnly,
      });
      if (!decided.ok || decided.kind !== "flatten") {
        fail(next, decided.ok ? "Could not close that position." : decided.error);
      }
      const sized = qtyForPerp(row.qty, instrument);
      if (!sized.ok) {
        fail(next, sized.error);
      }
      let qtyNumber = sized.qty;
      let fillPrice = mark;
      let venue: string | null = null;
      let environment: string | null = null;
      let venueOrderId: string | null = null;
      if (connection) {
        const placed = await placePerpMarketOnVenue({
          connection,
          symbol,
          side: decided.orderSide,
          qty: sized.text,
          reduceOnly: true,
          positionIdx: hedgePositionIdx(row.side),
          requireHedge: flattenTargets.length > 1 || opens.length > 1,
        });
        if (!placed.ok) {
          await writeEventLog({
            level: "error",
            scope: "trade",
            event: "trade.futures_failed",
            message: placed.error,
            userId: user.id,
            accountId: account.id,
            strategy: FUTURES_STRATEGY_ID,
            data: { symbol, action: "flatten", positionId: row.id },
          });
          fail(next, placed.error);
        }
        venue = placed.fill.venue;
        environment = placed.fill.environment;
        venueOrderId = placed.fill.orderId;
        const filledQty = Number(placed.fill.qty);
        if (filledQty > 0) {
          qtyNumber = filledQty;
        }
        if (placed.fill.price != null && placed.fill.price > 0) {
          fillPrice = placed.fill.price;
        }
      }
      const written = await writeFuturesFlatten({
        supabase,
        row,
        qty: qtyNumber,
        price: fillPrice,
        venue,
        environment,
        venueOrderId,
      });
      if (written.error) {
        await writeEventLog({
          level: "error",
          scope: "trade",
          event: "trade.futures_failed",
          message: written.error,
          userId: user.id,
          accountId: account.id,
          strategy: FUTURES_STRATEGY_ID,
          data: { symbol, action: "flatten", positionId: row.id },
        });
        fail(next, written.error);
      }
      await writeEventLog({
        scope: "trade",
        event: "trade.futures",
        message: `Closed ${symbol} ${row.side}`,
        userId: user.id,
        accountId: account.id,
        strategy: FUTURES_STRATEGY_ID,
        data: {
          symbol,
          action: "flatten",
          qty: qtyNumber,
          live: liveBook,
          positionId: row.id,
          side: row.side,
        },
      });
    }
    revalidatePath(FUTURES_PATHS.root);
    revalidatePath(FUTURES_PATHS.positions);
    revalidatePath(FUTURES_PATHS.performance);
    redirect(
      `${next}?paper=${liveBook ? "live-closed" : "closed"}`,
    );
  }

  const sameSide = opens.find((row) => row.side === wantedSide) ?? null;
  const decided = decideFuturesAction({
    action: actionParsed.action,
    open: sameSide ? { side: sameSide.side, qty: sameSide.qty } : null,
    reduceOnly: settings.reduceOnly,
  });
  if (!decided.ok) {
    fail(next, decided.error);
  }

  const unitParsed = parseFuturesSizeUnit(formData.get("sizeUnit"));
  if (!unitParsed.ok) {
    fail(next, unitParsed.error);
  }
  const typeParsed = parseFuturesOrderType(formData.get("orderType"));
  if (!typeParsed.ok) {
    fail(next, typeParsed.error);
  }
  let limit:
    | { price: number; text: string }
    | null = null;
  if (typeParsed.orderType === "limit") {
    const parsed = parseFuturesLimitPrice(formData.get("limitPrice"));
    if (!parsed.ok) {
      fail(next, parsed.error);
    }
    const priced = priceForPerp(parsed.price, instrument);
    if (!priced.ok) {
      fail(next, priced.error);
    }
    limit = priced;
  }
  const sizePrice = limit?.price ?? mark;
  const sizeRaw = formData.get("size") ?? formData.get("qty");
  let sized: { ok: true; qty: number; text: string } | { ok: false; error: string };
  if (unitParsed.unit === "usdt") {
    const notional = parseFuturesNotional(sizeRaw);
    if (!notional.ok) {
      fail(next, notional.error);
    }
    sized = qtyForPerpNotional(notional.qty, sizePrice, instrument);
  } else {
    const qtyParsed = parseFuturesQty(sizeRaw);
    if (!qtyParsed.ok) {
      fail(next, qtyParsed.error);
    }
    sized = qtyForPerp(qtyParsed.qty, instrument);
  }
  if (!sized.ok) {
    fail(next, sized.error);
  }
  const qtyText = sized.text;
  let qtyNumber = sized.qty;

  const tpslParsed = parseFuturesTpslForm(formData, instrument);
  if (!tpslParsed.ok) {
    fail(next, tpslParsed.error);
  }
  const tpsl = tpslParsed.tpsl;
  if (tpsl) {
    const checked = validateTpslVsReference({
      side: decided.positionSide,
      tpsl,
      reference: sizePrice,
    });
    if (!checked.ok) {
      fail(next, checked.error);
    }
  }
  const venueTpsl = venueTpslFields(tpsl);

  if (limit) {
    const connection = await boundLive();
    let venue: string | null = null;
    let environment: string | null = null;
    let venueOrderId: string | null = null;
    if (connection) {
      const placed = await placePerpLimitOnVenue({
        connection,
        symbol,
        side: decided.orderSide,
        qty: qtyText,
        price: limit.text,
        reduceOnly: decided.reduceOnly,
        positionIdx: hedgePositionIdx(decided.positionSide),
        requireHedge:
          decided.kind === "open" &&
          opens.some((row) => row.side !== decided.positionSide),
        tpsl: venueTpsl,
      });
      if (!placed.ok) {
        await writeEventLog({
          level: "error",
          scope: "trade",
          event: "trade.futures_failed",
          message: placed.error,
          userId: user.id,
          accountId: account.id,
          strategy: FUTURES_STRATEGY_ID,
          data: { symbol, action: actionParsed.action },
        });
        fail(next, placed.error);
      }
      venue = connection.venue;
      environment = connection.environment;
      venueOrderId = placed.orderId;
    }
    const working = await insertFuturesWorking(supabase, {
      userId: user.id,
      accountId: account.id,
      symbol,
      action: actionParsed.action === "sell" ? "sell" : "buy",
      side: decided.positionSide,
      qty: qtyNumber,
      limitPrice: limit.price,
      venue,
      environment,
      venueOrderId,
      tpsl,
    });
    if (!working.ok) {
      if (connection && venueOrderId) {
        await cancelPerpOrderOnVenue({
          connection,
          symbol,
          orderId: venueOrderId,
        });
      }
      fail(next, working.error);
    }
    await writeEventLog({
      scope: "trade",
      event: "trade.futures",
      message: `Limit ${actionParsed.action === "sell" ? "Sell" : "Buy"} ${symbol} working`,
      userId: user.id,
      accountId: account.id,
      strategy: FUTURES_STRATEGY_ID,
      data: {
        symbol,
        action: actionParsed.action,
        qty: qtyNumber,
        limitPrice: limit.price,
        live: liveBook,
        workingId: working.id,
      },
    });
    await reconcileOpenFuturesBooks({
      accountId: account.id,
      userId: user.id,
    });
    const stillWorking = (await loadOpenFuturesWorking()).some(
      (row) => row.id === working.id,
    );
    revalidatePath(FUTURES_PATHS.root);
    revalidatePath(FUTURES_PATHS.positions);
    revalidatePath(FUTURES_PATHS.performance);
    if (!stillWorking) {
      const filledFlash =
        decided.kind === "add"
          ? liveBook
            ? "live-added"
            : "added"
          : liveBook
            ? "live-opened"
            : "opened";
      redirect(`${next}?paper=${filledFlash}`);
    }
    redirect(`${next}?paper=${liveBook ? "live-working" : "working"}`);
  }

  let fillPrice = mark;
  let venue: string | null = null;
  let environment: string | null = null;
  let venueOrderId: string | null = null;

  if (liveBook) {
    const connection = await boundLive();
    if (!connection) {
      fail(next, "Bind an exchange in Futures Strategy Settings before trading.");
    }
    const placed = await placePerpMarketOnVenue({
      connection,
      symbol,
      side: decided.orderSide,
      qty: qtyText,
      reduceOnly: decided.reduceOnly,
      positionIdx: hedgePositionIdx(decided.positionSide),
      requireHedge:
        decided.kind === "open" &&
        opens.some((row) => row.side !== decided.positionSide),
      tpsl: venueTpsl,
    });
    if (!placed.ok) {
      await writeEventLog({
        level: "error",
        scope: "trade",
        event: "trade.futures_failed",
        message: placed.error,
        userId: user.id,
        accountId: account.id,
        strategy: FUTURES_STRATEGY_ID,
        data: {
          symbol,
          action: actionParsed.action,
          positionId: sameSide?.id ?? null,
        },
      });
      fail(next, placed.error);
    }
    venue = placed.fill.venue;
    environment = placed.fill.environment;
    venueOrderId = placed.fill.orderId;
    const filledQty = Number(placed.fill.qty);
    if (filledQty > 0) {
      qtyNumber = filledQty;
    }
    if (placed.fill.price != null && placed.fill.price > 0) {
      fillPrice = placed.fill.price;
    }
  }

  let written: { error: string | null };
  let flash = liveBook ? "live-opened" : "opened";
  let positionId = sameSide?.id ?? null;
  if (decided.kind === "open") {
    const created = await writeFuturesOpen({
      supabase,
      userId: user.id,
      accountId: account.id,
      symbol,
      side: decided.positionSide,
      qty: qtyNumber,
      price: fillPrice,
      venue,
      environment,
      venueOrderId,
      tpsl,
    });
    if (!created.ok) {
      written = { error: created.error };
    } else {
      written = { error: null };
      positionId = created.positionId;
    }
  } else if (decided.kind === "add" && sameSide) {
    written = await writeFuturesAdd({
      supabase,
      row: sameSide,
      qty: qtyNumber,
      price: fillPrice,
      venue,
      environment,
      venueOrderId,
      tpsl,
    });
    flash = liveBook ? "live-added" : "added";
  } else {
    written = { error: "Could not apply that futures action." };
  }

  if (written.error) {
    if (liveBook && venueOrderId) {
      const connection = await boundLive();
      if (connection) {
        await placePerpMarketOnVenue({
          connection,
          symbol,
          side: decided.orderSide === "Buy" ? "Sell" : "Buy",
          qty: qtyText,
          reduceOnly: true,
          positionIdx: hedgePositionIdx(decided.positionSide),
          requireHedge:
            decided.kind === "open" &&
            opens.some((row) => row.side !== decided.positionSide),
        });
      }
    }
    await writeEventLog({
      level: "error",
      scope: "trade",
      event: "trade.futures_failed",
      message: written.error,
      userId: user.id,
      accountId: account.id,
      strategy: FUTURES_STRATEGY_ID,
      data: { symbol, action: actionParsed.action, positionId: sameSide?.id ?? null },
    });
    fail(next, written.error);
  }

  await writeEventLog({
    scope: "trade",
    event: "trade.futures",
    message:
      decided.kind === "add"
        ? `Added ${symbol} ${decided.positionSide}`
        : `Opened ${symbol} ${decided.positionSide}`,
    userId: user.id,
    accountId: account.id,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      symbol,
      action: actionParsed.action,
      qty: qtyNumber,
      live: liveBook,
      positionId,
      side: decided.positionSide,
    },
  });

  revalidatePath(FUTURES_PATHS.root);
  revalidatePath(FUTURES_PATHS.positions);
  revalidatePath(FUTURES_PATHS.performance);
  redirect(`${next}?paper=${flash}`);
}

export async function saveFuturesTpsl(formData: FormData) {
  const next = safeFuturesReturnPath(String(formData.get("next") ?? ""));
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member: user, account } = session;
  const liveBook = accountCanHoldConnections(account.mode);
  const supabase = createServiceClient();
  if (!supabase) {
    fail(next, "Auth is not configured.");
  }
  const positionId = String(formData.get("positionId") ?? "").trim();
  const symbolParsed = parseFuturesSymbol(formData.get("symbol"));
  if (!symbolParsed.ok) {
    fail(next, symbolParsed.error);
  }
  const symbol = symbolParsed.symbol;
  const opens = await loadOpenFuturesOnSymbol(symbol);
  const row = opens.find((item) => item.id === positionId) ?? null;
  if (!row) {
    fail(next, "That position is no longer open.");
  }
  const instrument = await loadPerpInstrument(symbol);
  if (!instrument) {
    fail(next, "That symbol is not a trading USDT linear perpetual on Bybit.");
  }
  const parsed = parseFuturesTpslPatch(formData, instrument);
  if (!parsed.ok) {
    fail(next, parsed.error);
  }
  const tpsl = parsed.tpsl;
  const ticker = await fetchBybitTicker("linear", symbol);
  const mark = markFromTicker(ticker ?? {});
  if (tpslHasLevels(tpsl)) {
    const checked = validateTpslVsReference({
      side: row.side,
      tpsl,
      reference: mark ?? row.entryPrice,
    });
    if (!checked.ok) {
      fail(next, checked.error);
    }
  }
  if (liveBook) {
    const settings = await loadFuturesSettings(account.id);
    if (!settings.connectionId) {
      fail(next, "Bind an exchange in Futures Strategy Settings before trading.");
    }
    const bound = await loadBoundVenueForAccount({
      userId: user.id,
      accountId: account.id,
      mode: account.mode,
      connectionId: settings.connectionId,
    });
    if (!bound.ok) {
      fail(next, bound.error);
    }
    const stop = venueTradingStopFields(tpsl);
    const set = await setPerpTradingStopOnVenue({
      connection: bound.connection,
      symbol,
      positionIdx: hedgePositionIdx(row.side),
      takeProfit: stop.takeProfit,
      stopLoss: stop.stopLoss,
      tpTriggerBy: stop.tpTriggerBy,
      slTriggerBy: stop.slTriggerBy,
    });
    if (!set.ok) {
      await writeEventLog({
        level: "error",
        scope: "trade",
        event: "trade.futures_failed",
        message: set.error,
        userId: user.id,
        accountId: account.id,
        strategy: FUTURES_STRATEGY_ID,
        data: { symbol, action: "tpsl", positionId: row.id },
      });
      fail(next, set.error);
    }
  }
  const written = await patchFuturesTpsl({
    supabase,
    row,
    tpsl,
  });
  if (written.error) {
    fail(next, written.error);
  }
  await writeEventLog({
    scope: "trade",
    event: "trade.futures",
    message: tpslHasLevels(tpsl)
      ? `Set TP/SL on ${symbol} ${row.side}`
      : `Cleared TP/SL on ${symbol} ${row.side}`,
    userId: user.id,
    accountId: account.id,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      symbol,
      action: "tpsl",
      positionId: row.id,
      takeProfit: tpsl.takeProfit,
      stopLoss: tpsl.stopLoss,
      live: liveBook,
    },
  });
  revalidatePath(FUTURES_PATHS.root);
  revalidatePath(FUTURES_PATHS.positions);
  revalidatePath(FUTURES_PATHS.performance);
  redirect(`${next}?paper=${liveBook ? "live-tpsl" : "tpsl"}`);
}

export async function cancelFuturesWorking(formData: FormData) {
  const next = safeFuturesReturnPath(String(formData.get("next") ?? ""));
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member: user, account } = session;
  const supabase = createServiceClient();
  if (!supabase) {
    fail(next, "Auth is not configured.");
  }
  const workingId = String(formData.get("workingId") ?? "").trim();
  const opens = await loadOpenFuturesWorking();
  const row = opens.find((item) => item.id === workingId) ?? null;
  if (!row) {
    fail(next, "That order is no longer open.");
  }
  let connection: BoundConnectionSecrets | null = null;
  if (accountCanHoldConnections(account.mode)) {
    const settings = await loadFuturesSettings(account.id);
    if (!settings.connectionId && row.venueOrderId) {
      fail(next, "Bind an exchange in Futures Strategy Settings before cancelling.");
    }
    if (settings.connectionId) {
      const bound = await loadBoundVenueForAccount({
        userId: user.id,
        accountId: account.id,
        mode: account.mode,
        connectionId: settings.connectionId,
      });
      if (!bound.ok) {
        fail(next, bound.error);
      }
      connection = bound.connection;
    }
  }
  const cancelled = await cancelFuturesWorkingRow({
    supabase,
    row,
    connection,
  });
  if (!cancelled.ok) {
    fail(next, cancelled.error);
  }
  await writeEventLog({
    scope: "trade",
    event: "trade.futures",
    message: `Cancelled limit ${row.symbol}`,
    userId: user.id,
    accountId: account.id,
    strategy: FUTURES_STRATEGY_ID,
    data: { symbol: row.symbol, workingId: row.id, action: row.action },
  });
  revalidatePath(FUTURES_PATHS.root);
  revalidatePath(FUTURES_PATHS.positions);
  redirect(`${next}?paper=cancelled`);
}

export async function saveFuturesSettings(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member: user, account } = session;
  const supabase = createServiceClient();
  if (!supabase) {
    settingsFail("Auth is not configured.");
  }

  const reduceOnly =
    formData.get("reduceOnly") === "on" ||
    formData.get("reduceOnly") === "true";

  let connectionId: string | null = null;
  const bindSubmitted = formData.has("exchangeConnectionId");
  if (accountCanHoldConnections(account.mode) && bindSubmitted) {
    const nextId = String(formData.get("exchangeConnectionId") ?? "").trim();
    connectionId = nextId === "" || nextId === "none" ? null : nextId;
    const current = await loadFuturesSettings(account.id);
    if (current.connectionId !== null && connectionId !== current.connectionId) {
      const opens = await loadOpenFuturesCount(account.id, user.id);
      const detach = strategyDetachBlockers({
        openCount: opens,
        automationsRunning: false,
      });
      if (detach.length > 0) {
        settingsFail(formatStrategyDetachBlockers(detach));
      }
    }
    if (connectionId) {
      const connections = await listExchangeConnections(user.id, account.id);
      const match = connections.find((item) => item.id === connectionId);
      if (!match) {
        settingsFail("Pick an exchange connection on this account.");
      } else if (match.status !== "active" && match.id !== current.connectionId) {
        settingsFail("That connection is not active.");
      }
    }
  }

  const { error } = await supabase.from("strategy_settings").upsert({
    user_id: user.id,
    account_id: account.id,
    strategy_id: FUTURES_STRATEGY_ID,
    reduce_only: reduceOnly,
    ...(accountCanHoldConnections(account.mode) && bindSubmitted
      ? { exchange_connection_id: connectionId }
      : {}),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    settingsFail(error.message);
  }

  await writeEventLog({
    scope: "strategy",
    event: "settings.saved",
    message: "Saved futures settings",
    userId: user.id,
    accountId: account.id,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      reduceOnly,
      ...(bindSubmitted ? { exchangeConnectionId: connectionId } : {}),
    },
  });

  revalidatePath("/account/exchanges");
  revalidatePath(FUTURES_PATHS.root);
  revalidatePath(FUTURES_PATHS.settings);
  redirect(`${FUTURES_PATHS.settings}?saved=1`);
}

export async function detachFuturesConnection() {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member: user, account } = session;
  if (!accountCanHoldConnections(account.mode)) {
    redirect(FUTURES_PATHS.settings);
  }
  const supabase = createServiceClient();
  if (!supabase) {
    settingsFail("Auth is not configured.");
  }
  const settings = await loadFuturesSettings(account.id);
  if (!settings.connectionId) {
    redirect(FUTURES_PATHS.settings);
  }
  const opens = await loadOpenFuturesCount(account.id, user.id);
  const blocks = strategyDetachBlockers({
    openCount: opens,
    automationsRunning: false,
  });
  if (blocks.length > 0) {
    settingsFail(formatStrategyDetachBlockers(blocks));
  }
  const { error } = await supabase
    .from("strategy_settings")
    .update({
      exchange_connection_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", account.id)
    .eq("user_id", user.id)
    .eq("strategy_id", FUTURES_STRATEGY_ID);
  if (error) {
    settingsFail(error.message);
  }
  await writeEventLog({
    scope: "strategy",
    event: "settings.saved",
    message: "Detached futures exchange connection",
    userId: user.id,
    accountId: account.id,
    strategy: FUTURES_STRATEGY_ID,
    data: { exchangeConnectionId: null },
  });
  revalidatePath("/account/exchanges");
  revalidatePath(FUTURES_PATHS.root);
  revalidatePath(FUTURES_PATHS.settings);
  redirect(`${FUTURES_PATHS.settings}?saved=1`);
}

async function loadOpenFuturesCount(
  accountId: string,
  userId: string,
): Promise<number> {
  const supabase = createServiceClient();
  if (!supabase) {
    return 0;
  }
  const { count: positions } = await supabase
    .from("futures_positions")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .eq("status", "open");
  const { count: working } = await supabase
    .from("futures_working_orders")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .eq("status", "open");
  return (positions ?? 0) + (working ?? 0);
}
