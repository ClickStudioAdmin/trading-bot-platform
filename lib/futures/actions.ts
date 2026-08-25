"use server";

import { decideFuturesAction } from "./decide";
import {
  writeFuturesAdd,
  writeFuturesFlatten,
  writeFuturesOpen,
} from "./ledger";
import { loadOpenFuturesForSymbol } from "./list";
import { markFromTicker } from "./math";
import {
  parseFuturesAction,
  parseFuturesNotional,
  parseFuturesQty,
  parseFuturesSizeUnit,
  parseFuturesSymbol,
} from "./model";
import { safeFuturesReturnPath } from "./path";
import { loadFuturesSettings } from "./settings";
import {
  formatStrategyDetachBlockers,
  strategyDetachBlockers,
} from "@/lib/accounts/model";
import { getSessionContext } from "@/lib/auth/session";
import { fetchBybitTicker } from "@/lib/exchanges/bybit/client";
import { loadPerpInstrument, qtyForPerp, qtyForPerpNotional } from "@/lib/exchanges/bybit/perp";
import { placePerpMarketOnVenue } from "@/lib/exchanges/execute";
import { loadBoundVenueForAccount } from "@/lib/exchanges/live-trade";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_PATHS, FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
  const open = await loadOpenFuturesForSymbol(symbol);
  const decided = decideFuturesAction({
    action: actionParsed.action,
    open: open ? { side: open.side, qty: open.qty } : null,
    reduceOnly: settings.reduceOnly,
  });
  if (!decided.ok) {
    fail(next, decided.error);
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

  let qtyText: string;
  let qtyNumber: number;
  if (decided.kind === "flatten") {
    const sized = qtyForPerp(open?.qty ?? decided.qty, instrument);
    if (!sized.ok) {
      fail(next, sized.error);
    }
    qtyText = sized.text;
    qtyNumber = sized.qty;
  } else {
    const unitParsed = parseFuturesSizeUnit(formData.get("sizeUnit"));
    if (!unitParsed.ok) {
      fail(next, unitParsed.error);
    }
    const sizeRaw = formData.get("size") ?? formData.get("qty");
    let sized: { ok: true; qty: number; text: string } | { ok: false; error: string };
    if (unitParsed.unit === "usdt") {
      const notional = parseFuturesNotional(sizeRaw);
      if (!notional.ok) {
        fail(next, notional.error);
      }
      sized = qtyForPerpNotional(notional.qty, mark, instrument);
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
    qtyText = sized.text;
    qtyNumber = sized.qty;
  }

  let fillPrice = mark;
  let venue: string | null = null;
  let environment: string | null = null;
  let venueOrderId: string | null = null;

  if (liveBook) {
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
    const placed = await placePerpMarketOnVenue({
      connection: bound.connection,
      symbol,
      side: decided.orderSide,
      qty: qtyText,
      reduceOnly: decided.reduceOnly,
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
        data: { symbol, action: actionParsed.action, positionId: open?.id ?? null },
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
  let positionId = open?.id ?? null;
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
    });
    if (!created.ok) {
      written = { error: created.error };
    } else {
      written = { error: null };
      positionId = created.positionId;
    }
  } else if (decided.kind === "add" && open) {
    written = await writeFuturesAdd({
      supabase,
      row: open,
      qty: qtyNumber,
      price: fillPrice,
      venue,
      environment,
      venueOrderId,
    });
    flash = liveBook ? "live-added" : "added";
  } else if (decided.kind === "flatten" && open) {
    written = await writeFuturesFlatten({
      supabase,
      row: open,
      qty: qtyNumber,
      price: fillPrice,
      venue,
      environment,
      venueOrderId,
    });
    flash = liveBook ? "live-closed" : "closed";
  } else {
    written = { error: "Could not apply that futures action." };
  }

  if (written.error) {
    if (liveBook && venueOrderId && decided.kind !== "flatten") {
      const bound = await loadBoundVenueForAccount({
        userId: user.id,
        accountId: account.id,
        mode: account.mode,
        connectionId: settings.connectionId,
      });
      if (bound.ok) {
        await placePerpMarketOnVenue({
          connection: bound.connection,
          symbol,
          side: decided.orderSide === "Buy" ? "Sell" : "Buy",
          qty: qtyText,
          reduceOnly: true,
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
      data: { symbol, action: actionParsed.action, positionId: open?.id ?? null },
    });
    fail(next, written.error);
  }

  await writeEventLog({
    scope: "trade",
    event: "trade.futures",
    message:
      decided.kind === "flatten"
        ? `Flattened ${symbol}`
        : decided.kind === "add"
          ? `Added ${symbol}`
          : `Opened ${symbol}`,
    userId: user.id,
    accountId: account.id,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      symbol,
      action: actionParsed.action,
      qty: qtyNumber,
      live: liveBook,
      positionId,
    },
  });

  revalidatePath(FUTURES_PATHS.root);
  revalidatePath(FUTURES_PATHS.positions);
  revalidatePath(FUTURES_PATHS.performance);
  redirect(`${next}?paper=${flash}`);
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
  const { count } = await supabase
    .from("futures_positions")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .eq("status", "open");
  return count ?? 0;
}
