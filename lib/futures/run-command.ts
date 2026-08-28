import { decideFuturesAction, flattenOrderAction, hedgePositionIdx } from "./decide";
import {
  insertFuturesWorking,
  patchFuturesTpsl,
  patchFuturesTrailing,
  patchFuturesWorking,
  writeFuturesAdd,
  writeFuturesCloseSlice,
  writeFuturesOpen,
} from "./ledger";
import { loadOpenFuturesOnSymbol, loadOpenFuturesWorking, loadFuturesPositions } from "./list";
import { markFromTicker } from "./math";
import {
  parseFuturesAction,
  parseCloseQty,
  parseFuturesLimitPrice,
  parseFuturesNotional,
  parseFuturesOrderType,
  parseFuturesQty,
  parseFuturesSizeUnit,
  parseFuturesSymbol,
  parseFuturesTradeSource,
  type FuturesSide,
} from "./model";
import {
  amendFuturesWorkingRow,
  cancelFuturesWorkingRow,
  cancelReduceOnlyWorkingForPosition,
  reconcileOpenFuturesBooks,
} from "./reconcile";
import {
  armFuturesAutomationReduceOnly,
  armFuturesReduceOnly,
  loadFuturesSettings,
} from "./settings";
import { checkFuturesRiskCaps } from "./risk";
import {
  futuresOriginLog,
  withFuturesOrigin,
} from "./source";
import { fetchBybitTicker } from "@/lib/exchanges/bybit/client";
import { loadPerpInstrument, priceForPerp, qtyForPerp, qtyForPerpNotional } from "@/lib/exchanges/bybit/perp";
import {
  cancelPerpOrderOnVenue,
  placePerpLimitOnVenue,
  placePerpMarketOnVenue,
  setPerpTradingStopOnVenue,
} from "@/lib/exchanges/execute";
import { loadBoundVenueForAccount } from "@/lib/exchanges/live-trade";
import { type BoundConnectionSecrets } from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_PATHS, FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  closeAllFlash,
  parseCloseAllConfirm,
  parseCloseAllScope,
  parseSetReduceOnly,
} from "./close-all";
import {
  parseIdempotencyKey,
  replayOrNull,
  saveCommandReceipt,
  type FuturesCommand,
  type FuturesCommandActor,
  type FuturesCommandFlash,
  type FuturesCommandResult,
  type FuturesPlaceCommand,
} from "./command";
import {
  combinedVenueTradingStop,
  parseFuturesTpslForm,
  parseFuturesTpslPatch,
  tpslFromRow,
  tpslHasLevels,
  validateTpslQty,
  validateTpslVsReference,
  venueTpslFields,
  type FuturesTpsl,
} from "./tpsl";
import {
  armTrailingAt,
  parseFuturesTrailingForm,
  parseFuturesTrailingPatch,
  trailingFromRow,
  trailingHasStop,
  validateTrailingVsReference,
  type FuturesTrailing,
} from "./trailing";
import { isUnchangedWorkingAmend, nextWorkingAmend } from "./working";

type CommandOk = {
  ok: true;
  flash: FuturesCommandFlash;
  workingId?: string | null;
  positionId?: string | null;
};

type CommandOutcome = CommandOk | { ok: false; error: string };

type CommandCtx = {
  actor: FuturesCommandActor;
  supabase: SupabaseClient;
  key: string | null;
  liveBook: boolean;
};

function actorScope(actor: FuturesCommandActor) {
  return { accountId: actor.accountId, userId: actor.userId };
}

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function revalidateFutures(kind: FuturesCommand["kind"]) {
  revalidatePath(FUTURES_PATHS.root);
  revalidatePath(FUTURES_PATHS.positions);
  if (kind !== "cancel-working" && kind !== "amend-working") {
    revalidatePath(FUTURES_PATHS.performance);
  }
}

async function boundLive(input: {
  actor: FuturesCommandActor;
  liveBook: boolean;
  connectionId: string | null;
}): Promise<
  | { ok: true; connection: BoundConnectionSecrets | null }
  | { ok: false; error: string }
> {
  if (!input.liveBook) {
    return { ok: true, connection: null };
  }
  if (!input.connectionId) {
    return fail(
      "Bind an exchange in Desk Settings before trading.",
    );
  }
  const bound = await loadBoundVenueForAccount({
    userId: input.actor.userId,
    accountId: input.actor.accountId,
    mode: input.actor.mode,
    connectionId: input.connectionId,
  });
  if (!bound.ok) {
    return fail(bound.error);
  }
  return { ok: true, connection: bound.connection };
}

async function applyVenueTradingStop(input: {
  connection: BoundConnectionSecrets;
  symbol: string;
  side: FuturesSide;
  tpsl: FuturesTpsl | null | undefined;
  trailing: FuturesTrailing | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const stop = combinedVenueTradingStop(input.tpsl, input.trailing);
  return setPerpTradingStopOnVenue({
    connection: input.connection,
    symbol: input.symbol,
    positionIdx: hedgePositionIdx(input.side),
    ...stop,
  });
}

function resolvePlaceTpsl(
  command: FuturesPlaceCommand,
  instrument: Parameters<typeof parseFuturesTpslForm>[1],
): { ok: true; tpsl: FuturesTpsl | null } | { ok: false; error: string } {
  if (command.tpsl !== undefined) {
    return { ok: true, tpsl: command.tpsl };
  }
  if (command.tpslForm) {
    return parseFuturesTpslForm(command.tpslForm, instrument);
  }
  return { ok: true, tpsl: null };
}

function resolvePlaceTrailing(
  command: FuturesPlaceCommand,
  instrument: Parameters<typeof parseFuturesTrailingForm>[1],
):
  | { ok: true; trailing: FuturesTrailing | null }
  | { ok: false; error: string } {
  if (command.trailing !== undefined) {
    return { ok: true, trailing: command.trailing };
  }
  if (command.trailingForm) {
    return parseFuturesTrailingForm(command.trailingForm, instrument);
  }
  return { ok: true, trailing: null };
}

export async function runFuturesCommand(input: {
  actor: FuturesCommandActor;
  command: FuturesCommand;
}): Promise<FuturesCommandResult> {
  const parsedKey = parseIdempotencyKey(input.command.idempotencyKey);
  if (!parsedKey.ok) {
    return fail(parsedKey.error);
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return fail("Auth is not configured.");
  }
  const liveBook = accountCanHoldConnections(input.actor.mode);
  const replayed = await replayOrNull({
    supabase,
    accountId: input.actor.accountId,
    key: parsedKey.key,
    liveBook,
  });
  if (replayed) {
    return replayed;
  }

  const ctx: CommandCtx = {
    actor: input.actor,
    supabase,
    key: parsedKey.key,
    liveBook,
  };

  let outcome: CommandOutcome;
  switch (input.command.kind) {
    case "place":
      outcome = await runPlace(ctx, input.command);
      break;
    case "set-tpsl":
      outcome = await runSetTpsl(ctx, input.command);
      break;
    case "set-trailing":
      outcome = await runSetTrailing(ctx, input.command);
      break;
    case "cancel-working":
      outcome = await runCancelWorking(ctx, input.command);
      break;
    case "amend-working":
      outcome = await runAmendWorking(ctx, input.command);
      break;
    case "close-all":
      outcome = await runCloseAll(ctx, input.command);
      break;
  }

  if (!outcome.ok) {
    const recovered = await replayOrNull({
      supabase,
      accountId: input.actor.accountId,
      key: parsedKey.key,
      liveBook,
    });
    if (recovered) {
      revalidateFutures(input.command.kind);
      return recovered;
    }
    return outcome;
  }
  if (parsedKey.key) {
    await saveCommandReceipt({
      supabase,
      userId: input.actor.userId,
      accountId: input.actor.accountId,
      key: parsedKey.key,
      flash: outcome.flash,
      workingId: outcome.workingId,
      positionId: outcome.positionId,
    });
  }
  revalidateFutures(input.command.kind);
  return { ok: true, flash: outcome.flash };
}

async function runPlace(
  ctx: CommandCtx,
  command: FuturesPlaceCommand,
): Promise<CommandOutcome> {
  const { actor, supabase, key, liveBook } = ctx;
  const actionParsed = parseFuturesAction(command.action);
  if (!actionParsed.ok) {
    return fail(actionParsed.error);
  }
  const symbolParsed = parseFuturesSymbol(command.symbol);
  if (!symbolParsed.ok) {
    return fail(symbolParsed.error);
  }
  const symbol = symbolParsed.symbol;
  const source = parseFuturesTradeSource(command.source);
  const ruleId = String(command.ruleId ?? "").trim() || null;
  const ruleName = String(command.ruleName ?? "").trim() || null;
  const origin = futuresOriginLog({ source, ruleName });
  const settings = await loadFuturesSettings(actor.accountId);
  const opens = await loadOpenFuturesOnSymbol(symbol, actorScope(actor));
  const wantedSide = actionParsed.action === "buy" ? "long" : "short";
  const flattenId = String(command.positionId ?? "").trim();
  const flattenTargets =
    actionParsed.action === "flatten"
      ? flattenId
        ? opens.filter((row) => row.id === flattenId)
        : []
      : [];
  if (actionParsed.action === "flatten" && flattenTargets.length === 0) {
    return fail(
      flattenId
        ? "That position is no longer open."
        : "Close from the open row.",
    );
  }

  const instrument = await loadPerpInstrument(symbol);
  if (!instrument) {
    return fail(
      "That symbol is not a trading USDT linear perpetual on Bybit.",
    );
  }

  const ticker = await fetchBybitTicker("linear", symbol);
  const mark = markFromTicker(ticker ?? {});
  if (mark === null) {
    return fail("Could not read a mark price for that contract.");
  }

  const live = () =>
    boundLive({
      actor,
      liveBook,
      connectionId: settings.connectionId,
    });

  if (actionParsed.action === "flatten") {
    const connectionBound = await live();
    if (!connectionBound.ok) {
      return connectionBound;
    }
    const connection = connectionBound.connection;
    const typeParsed = parseFuturesOrderType(command.orderType);
    if (!typeParsed.ok) {
      return fail(typeParsed.error);
    }
    for (const row of flattenTargets) {
      const decided = decideFuturesAction({
        action: "flatten",
        open: { side: row.side, qty: row.qty },
        reduceOnly: settings.reduceOnly,
      });
      if (!decided.ok || decided.kind !== "flatten") {
        return fail(
          decided.ok ? "Could not close that position." : decided.error,
        );
      }
      if (typeParsed.orderType === "limit") {
        const parsedPrice = parseFuturesLimitPrice(command.limitPrice);
        if (!parsedPrice.ok) {
          return fail(parsedPrice.error);
        }
        const priced = priceForPerp(parsedPrice.price, instrument);
        if (!priced.ok) {
          return fail(priced.error);
        }
        const qtyParsed = parseCloseQty(command.size, row.qty);
        if (!qtyParsed.ok) {
          return fail(qtyParsed.error);
        }
        const sized = qtyForPerp(qtyParsed.qty, instrument);
        if (!sized.ok) {
          return fail(sized.error);
        }
        let venue: string | null = null;
        let environment: string | null = null;
        let venueOrderId: string | null = null;
        if (connection) {
          const placed = await placePerpLimitOnVenue({
            connection,
            symbol,
            side: decided.orderSide,
            qty: sized.text,
            price: priced.text,
            reduceOnly: true,
            positionIdx: hedgePositionIdx(row.side),
            requireHedge: flattenTargets.length > 1 || opens.length > 1,
            orderLinkId: key ?? undefined,
          });
          if (!placed.ok) {
            await writeEventLog({
              level: "error",
              scope: "trade",
              event: "trade.futures_failed",
              message: placed.error,
              userId: actor.userId,
              accountId: actor.accountId,
              strategy: FUTURES_STRATEGY_ID,
              data: { symbol, action: "flatten", positionId: row.id },
            });
            return fail(placed.error);
          }
          venue = connection.venue;
          environment = connection.environment;
          venueOrderId = placed.orderId;
        }
        const working = await insertFuturesWorking(supabase, {
          userId: actor.userId,
          accountId: actor.accountId,
          symbol,
          action: flattenOrderAction(row.side),
          side: row.side,
          qty: sized.qty,
          limitPrice: priced.price,
          venue,
          environment,
          venueOrderId,
          positionId: row.id,
          reduceOnly: true,
          idempotencyKey: key,
          source,
          ruleName,
        });
        if (!working.ok) {
          if (connection && venueOrderId) {
            await cancelPerpOrderOnVenue({
              connection,
              symbol,
              orderId: venueOrderId,
            });
          }
          return fail(working.error);
        }
        await writeEventLog({
          scope: "trade",
          event: "trade.futures",
          message: withFuturesOrigin(
            `Limit Close ${symbol} ${row.side} working`,
            origin,
          ),
          userId: actor.userId,
          accountId: actor.accountId,
          strategy: FUTURES_STRATEGY_ID,
          data: {
            symbol,
            action: "flatten",
            qty: sized.qty,
            limitPrice: priced.price,
            live: liveBook,
            workingId: working.id,
            positionId: row.id,
            ...origin,
          },
        });
        await reconcileOpenFuturesBooks({
          accountId: actor.accountId,
          userId: actor.userId,
          workingId: working.id,
        });
        const stillWorking = (
          await loadOpenFuturesWorking(actorScope(actor))
        ).some((item) => item.id === working.id);
        if (!stillWorking) {
          return {
            ok: true,
            flash: liveBook ? "live-closed" : "closed",
            workingId: working.id,
            positionId: row.id,
          };
        }
        return {
          ok: true,
          flash: liveBook ? "live-working" : "working",
          workingId: working.id,
          positionId: row.id,
        };
      }
      const qtyParsed = parseCloseQty(command.size, row.qty);
      if (!qtyParsed.ok) {
        return fail(qtyParsed.error);
      }
      const sized = qtyForPerp(qtyParsed.qty, instrument);
      if (!sized.ok) {
        return fail(sized.error);
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
          orderLinkId: key ?? undefined,
        });
        if (!placed.ok) {
          await writeEventLog({
            level: "error",
            scope: "trade",
            event: "trade.futures_failed",
            message: placed.error,
            userId: actor.userId,
            accountId: actor.accountId,
            strategy: FUTURES_STRATEGY_ID,
            data: { symbol, action: "flatten", positionId: row.id },
          });
          return fail(placed.error);
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
      const written = await writeFuturesCloseSlice({
        supabase,
        row,
        qty: qtyNumber,
        price: fillPrice,
        venue,
        environment,
        venueOrderId,
        remainingTpsl: tpslFromRow(row),
        idempotencyKey: key,
        source,
        ruleName,
      });
      if (written.error) {
        await writeEventLog({
          level: "error",
          scope: "trade",
          event: "trade.futures_failed",
          message: written.error,
          userId: actor.userId,
          accountId: actor.accountId,
          strategy: FUTURES_STRATEGY_ID,
          data: { symbol, action: "flatten", positionId: row.id },
        });
        return fail(written.error);
      }
      if (written.remaining <= 1e-12) {
        await cancelReduceOnlyWorkingForPosition({
          supabase,
          accountId: actor.accountId,
          userId: actor.userId,
          positionId: row.id,
          connection,
        });
      }
      await writeEventLog({
        scope: "trade",
        event: "trade.futures",
        message: withFuturesOrigin(
          written.remaining <= 1e-12
            ? `Closed ${symbol} ${row.side}`
            : `Reduced ${symbol} ${row.side}`,
          origin,
        ),
        userId: actor.userId,
        accountId: actor.accountId,
        strategy: FUTURES_STRATEGY_ID,
        data: {
          symbol,
          action: "flatten",
          qty: qtyNumber,
          live: liveBook,
          positionId: row.id,
          side: row.side,
          ...origin,
        },
      });
      return {
        ok: true,
        flash: liveBook ? "live-closed" : "closed",
        positionId: row.id,
      };
    }
    return {
      ok: true,
      flash: liveBook ? "live-closed" : "closed",
      positionId: flattenTargets[0]?.id ?? null,
    };
  }

  const sameSide = opens.find((row) => row.side === wantedSide) ?? null;
  const decided = decideFuturesAction({
    action: actionParsed.action,
    open: sameSide ? { side: sameSide.side, qty: sameSide.qty } : null,
    reduceOnly: settings.reduceOnly,
  });
  if (!decided.ok) {
    return fail(decided.error);
  }

  const unitParsed = parseFuturesSizeUnit(command.sizeUnit);
  if (!unitParsed.ok) {
    return fail(unitParsed.error);
  }
  const typeParsed = parseFuturesOrderType(command.orderType);
  if (!typeParsed.ok) {
    return fail(typeParsed.error);
  }
  let limit: { price: number; text: string } | null = null;
  if (typeParsed.orderType === "limit") {
    const parsed = parseFuturesLimitPrice(command.limitPrice);
    if (!parsed.ok) {
      return fail(parsed.error);
    }
    const priced = priceForPerp(parsed.price, instrument);
    if (!priced.ok) {
      return fail(priced.error);
    }
    limit = priced;
  }
  const sizePrice = limit?.price ?? mark;
  let sized: { ok: true; qty: number; text: string } | { ok: false; error: string };
  if (unitParsed.unit === "usdt") {
    const notional = parseFuturesNotional(command.size);
    if (!notional.ok) {
      return fail(notional.error);
    }
    sized = qtyForPerpNotional(notional.qty, sizePrice, instrument);
  } else {
    const qtyParsed = parseFuturesQty(command.size);
    if (!qtyParsed.ok) {
      return fail(qtyParsed.error);
    }
    sized = qtyForPerp(qtyParsed.qty, instrument);
  }
  if (!sized.ok) {
    return fail(sized.error);
  }
  const qtyText = sized.text;
  let qtyNumber = sized.qty;

  const tpslParsed = resolvePlaceTpsl(command, instrument);
  if (!tpslParsed.ok) {
    return fail(tpslParsed.error);
  }
  const tpsl = tpslParsed.tpsl;
  if (tpsl) {
    const checked = validateTpslVsReference({
      side: decided.positionSide,
      tpsl,
      reference: sizePrice,
    });
    if (!checked.ok) {
      return fail(checked.error);
    }
    const tpslSized = validateTpslQty({
      tpsl,
      capQty: qtyNumber,
      capLabel: "order size",
    });
    if (!tpslSized.ok) {
      return fail(tpslSized.error);
    }
  }
  const venueTpsl = venueTpslFields(tpsl);

  const trailingParsed = resolvePlaceTrailing(command, instrument);
  if (!trailingParsed.ok) {
    return fail(trailingParsed.error);
  }
  const trailing = trailingParsed.trailing;
  if (trailing) {
    const checked = validateTrailingVsReference({
      side: decided.positionSide,
      trailing,
      reference: sizePrice,
    });
    if (!checked.ok) {
      return fail(checked.error);
    }
  }

  const working = await loadOpenFuturesWorking(actorScope(actor));
  const risk = checkFuturesRiskCaps({
    caps: settings,
    symbol,
    side: decided.positionSide,
    orderValue: qtyNumber * sizePrice,
    opens,
    working,
  });
  if (!risk.ok) {
    return fail(risk.error);
  }

  if (limit) {
    const connectionBound = await live();
    if (!connectionBound.ok) {
      return connectionBound;
    }
    const connection = connectionBound.connection;
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
        orderLinkId: key ?? undefined,
      });
      if (!placed.ok) {
        await writeEventLog({
          level: "error",
          scope: "trade",
          event: "trade.futures_failed",
          message: placed.error,
          userId: actor.userId,
          accountId: actor.accountId,
          strategy: FUTURES_STRATEGY_ID,
          data: { symbol, action: actionParsed.action },
        });
        return fail(placed.error);
      }
      venue = connection.venue;
      environment = connection.environment;
      venueOrderId = placed.orderId;
    }
    const working = await insertFuturesWorking(supabase, {
      userId: actor.userId,
      accountId: actor.accountId,
      symbol,
      action: actionParsed.action === "sell" ? "sell" : "buy",
      side: decided.positionSide,
      qty: qtyNumber,
      limitPrice: limit.price,
      venue,
      environment,
      venueOrderId,
      tpsl,
      trailing,
      idempotencyKey: key,
      source,
      ruleName,
    });
    if (!working.ok) {
      if (connection && venueOrderId) {
        await cancelPerpOrderOnVenue({
          connection,
          symbol,
          orderId: venueOrderId,
        });
      }
      return fail(working.error);
    }
    await writeEventLog({
      scope: "trade",
      event: "trade.futures",
      message: withFuturesOrigin(
        `Limit ${actionParsed.action === "sell" ? "Sell" : "Buy"} ${symbol} working`,
        origin,
      ),
      userId: actor.userId,
      accountId: actor.accountId,
      strategy: FUTURES_STRATEGY_ID,
      data: {
        symbol,
        action: actionParsed.action,
        qty: qtyNumber,
        limitPrice: limit.price,
        live: liveBook,
        workingId: working.id,
        positionId: sameSide?.id ?? null,
        side: decided.positionSide,
        ...origin,
      },
    });
    await reconcileOpenFuturesBooks({
      accountId: actor.accountId,
      userId: actor.userId,
      workingId: working.id,
    });
    const stillWorking = (await loadOpenFuturesWorking(actorScope(actor))).some(
      (row) => row.id === working.id,
    );
    if (!stillWorking) {
      const filledFlash =
        decided.kind === "add"
          ? liveBook
            ? "live-added"
            : "added"
          : liveBook
            ? "live-opened"
            : "opened";
      return {
        ok: true,
        flash: filledFlash,
        workingId: working.id,
        positionId: sameSide?.id ?? null,
      };
    }
    return {
      ok: true,
      flash: liveBook ? "live-working" : "working",
      workingId: working.id,
      positionId: sameSide?.id ?? null,
    };
  }

  let fillPrice = mark;
  let venue: string | null = null;
  let environment: string | null = null;
  let venueOrderId: string | null = null;

  if (liveBook) {
    const connectionBound = await live();
    if (!connectionBound.ok) {
      return connectionBound;
    }
    if (!connectionBound.connection) {
      return fail(
        "Bind an exchange in Desk Settings before trading.",
      );
    }
    const connection = connectionBound.connection;
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
      orderLinkId: key ?? undefined,
    });
    if (!placed.ok) {
      await writeEventLog({
        level: "error",
        scope: "trade",
        event: "trade.futures_failed",
        message: placed.error,
        userId: actor.userId,
        accountId: actor.accountId,
        strategy: FUTURES_STRATEGY_ID,
        data: {
          symbol,
          action: actionParsed.action,
          positionId: sameSide?.id ?? null,
        },
      });
      return fail(placed.error);
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
  let flash: FuturesCommandFlash = liveBook ? "live-opened" : "opened";
  let positionId = sameSide?.id ?? null;
  if (decided.kind === "open") {
    const created = await writeFuturesOpen({
      supabase,
      userId: actor.userId,
      accountId: actor.accountId,
      symbol,
      side: decided.positionSide,
      qty: qtyNumber,
      price: fillPrice,
      venue,
      environment,
      venueOrderId,
      tpsl,
      trailing: armTrailingAt(trailing, fillPrice),
      idempotencyKey: key,
      source,
      ruleId,
      ruleName,
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
      trailing: armTrailingAt(trailing, fillPrice),
      idempotencyKey: key,
      source,
      ruleName,
    });
    flash = liveBook ? "live-added" : "added";
  } else {
    written = { error: "Could not apply that futures action." };
  }

  if (written.error) {
    if (liveBook && venueOrderId) {
      const connectionBound = await live();
      if (connectionBound.ok && connectionBound.connection) {
        await placePerpMarketOnVenue({
          connection: connectionBound.connection,
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
      userId: actor.userId,
      accountId: actor.accountId,
      strategy: FUTURES_STRATEGY_ID,
      data: {
        symbol,
        action: actionParsed.action,
        positionId: sameSide?.id ?? null,
      },
    });
    return fail(written.error);
  }

  if (liveBook && trailingHasStop(trailing)) {
    const connectionBound = await live();
    if (!connectionBound.ok) {
      return connectionBound;
    }
    if (connectionBound.connection) {
      const set = await applyVenueTradingStop({
        connection: connectionBound.connection,
        symbol,
        side: decided.positionSide,
        tpsl,
        trailing,
      });
      if (!set.ok) {
        await writeEventLog({
          level: "error",
          scope: "trade",
          event: "trade.futures_failed",
          message: set.error,
          userId: actor.userId,
          accountId: actor.accountId,
          strategy: FUTURES_STRATEGY_ID,
          data: { symbol, action: "trailing", positionId },
        });
        return fail(set.error);
      }
    }
  }

  await writeEventLog({
    scope: "trade",
    event: "trade.futures",
    message: withFuturesOrigin(
      decided.kind === "add"
        ? `Added ${symbol} ${decided.positionSide}`
        : `Opened ${symbol} ${decided.positionSide}`,
      origin,
    ),
    userId: actor.userId,
    accountId: actor.accountId,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      symbol,
      action: actionParsed.action,
      qty: qtyNumber,
      live: liveBook,
      positionId,
      side: decided.positionSide,
      ...origin,
    },
  });

  return { ok: true, flash, positionId };
}

async function runSetTpsl(
  ctx: CommandCtx,
  command: Extract<FuturesCommand, { kind: "set-tpsl" }>,
): Promise<CommandOutcome> {
  const { actor, supabase, liveBook } = ctx;
  const positionId = String(command.positionId ?? "").trim();
  const symbolParsed = parseFuturesSymbol(command.symbol);
  if (!symbolParsed.ok) {
    return fail(symbolParsed.error);
  }
  const symbol = symbolParsed.symbol;
  const opens = await loadOpenFuturesOnSymbol(symbol, actorScope(actor));
  const row = opens.find((item) => item.id === positionId) ?? null;
  if (!row) {
    return fail("That position is no longer open.");
  }
  const instrument = await loadPerpInstrument(symbol);
  if (!instrument) {
    return fail(
      "That symbol is not a trading USDT linear perpetual on Bybit.",
    );
  }
  let tpsl: FuturesTpsl;
  if (command.tpsl !== undefined) {
    tpsl = command.tpsl;
  } else {
    const parsed = parseFuturesTpslPatch(command.form, instrument);
    if (!parsed.ok) {
      return fail(parsed.error);
    }
    tpsl = parsed.tpsl;
  }
  const ticker = await fetchBybitTicker("linear", symbol);
  const mark = markFromTicker(ticker ?? {});
  if (tpslHasLevels(tpsl)) {
    const checked = validateTpslVsReference({
      side: row.side,
      tpsl,
      reference: mark ?? row.entryPrice,
    });
    if (!checked.ok) {
      return fail(checked.error);
    }
    const sized = validateTpslQty({
      tpsl,
      capQty: row.qty,
      capLabel: "position size",
    });
    if (!sized.ok) {
      return fail(sized.error);
    }
  }
  if (liveBook) {
    const settings = await loadFuturesSettings(actor.accountId);
    const connectionBound = await boundLive({
      actor,
      liveBook,
      connectionId: settings.connectionId,
    });
    if (!connectionBound.ok) {
      return connectionBound;
    }
    if (!connectionBound.connection) {
      return fail(
        "Bind an exchange in Desk Settings before trading.",
      );
    }
    const stop = combinedVenueTradingStop(
      command.venueTpsl ?? tpsl,
      trailingFromRow(row),
    );
    const set = await setPerpTradingStopOnVenue({
      connection: connectionBound.connection,
      symbol,
      positionIdx: hedgePositionIdx(row.side),
      ...stop,
    });
    if (!set.ok) {
      await writeEventLog({
        level: "error",
        scope: "trade",
        event: "trade.futures_failed",
        message: set.error,
        userId: actor.userId,
        accountId: actor.accountId,
        strategy: FUTURES_STRATEGY_ID,
        data: { symbol, action: "tpsl", positionId: row.id },
      });
      return fail(set.error);
    }
  }
  const written = await patchFuturesTpsl({
    supabase,
    row,
    tpsl,
  });
  if (written.error) {
    return fail(written.error);
  }
  await writeEventLog({
    scope: "trade",
    event: "trade.futures",
    message: tpslHasLevels(tpsl)
      ? `Set TP/SL on ${symbol} ${row.side}`
      : `Cleared TP/SL on ${symbol} ${row.side}`,
    userId: actor.userId,
    accountId: actor.accountId,
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
  return {
    ok: true,
    flash: liveBook ? "live-tpsl" : "tpsl",
    positionId: row.id,
  };
}

async function runSetTrailing(
  ctx: CommandCtx,
  command: Extract<FuturesCommand, { kind: "set-trailing" }>,
): Promise<CommandOutcome> {
  const { actor, supabase, liveBook } = ctx;
  const positionId = String(command.positionId ?? "").trim();
  const symbolParsed = parseFuturesSymbol(command.symbol);
  if (!symbolParsed.ok) {
    return fail(symbolParsed.error);
  }
  const symbol = symbolParsed.symbol;
  const opens = await loadOpenFuturesOnSymbol(symbol, actorScope(actor));
  const row = opens.find((item) => item.id === positionId) ?? null;
  if (!row) {
    return fail("That position is no longer open.");
  }
  const instrument = await loadPerpInstrument(symbol);
  if (!instrument) {
    return fail(
      "That symbol is not a trading USDT linear perpetual on Bybit.",
    );
  }
  let trailing: FuturesTrailing | null;
  if (command.trailing !== undefined) {
    trailing = command.trailing;
  } else {
    const parsed = parseFuturesTrailingPatch(command.form, instrument);
    if (!parsed.ok) {
      return fail(parsed.error);
    }
    trailing = parsed.trailing;
  }
  const ticker = await fetchBybitTicker("linear", symbol);
  const mark = markFromTicker(ticker ?? {});
  const last = Number(ticker?.lastPrice ?? "");
  const reference = last > 0 ? last : mark ?? row.entryPrice;
  if (trailing) {
    const checked = validateTrailingVsReference({
      side: row.side,
      trailing,
      reference,
    });
    if (!checked.ok) {
      return fail(checked.error);
    }
  }
  const armed = trailing ? armTrailingAt(trailing, reference) : null;
  if (liveBook) {
    const settings = await loadFuturesSettings(actor.accountId);
    const connectionBound = await boundLive({
      actor,
      liveBook,
      connectionId: settings.connectionId,
    });
    if (!connectionBound.ok) {
      return connectionBound;
    }
    if (!connectionBound.connection) {
      return fail(
        "Bind an exchange in Desk Settings before trading.",
      );
    }
    const set = await applyVenueTradingStop({
      connection: connectionBound.connection,
      symbol,
      side: row.side,
      tpsl: tpslFromRow(row),
      trailing: armed,
    });
    if (!set.ok) {
      await writeEventLog({
        level: "error",
        scope: "trade",
        event: "trade.futures_failed",
        message: set.error,
        userId: actor.userId,
        accountId: actor.accountId,
        strategy: FUTURES_STRATEGY_ID,
        data: { symbol, action: "trailing", positionId: row.id },
      });
      return fail(set.error);
    }
  }
  const written = await patchFuturesTrailing({
    supabase,
    row,
    trailing: armed,
  });
  if (written.error) {
    return fail(written.error);
  }
  await writeEventLog({
    scope: "trade",
    event: "trade.futures",
    message: trailingHasStop(armed)
      ? `Set trailing stop on ${symbol} ${row.side}`
      : `Cleared trailing stop on ${symbol} ${row.side}`,
    userId: actor.userId,
    accountId: actor.accountId,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      symbol,
      action: "trailing",
      positionId: row.id,
      trailingStop: armed?.distance ?? null,
      trailingActive: armed?.activePrice ?? null,
      live: liveBook,
    },
  });
  return {
    ok: true,
    flash: liveBook ? "live-trailing" : "trailing",
    positionId: row.id,
  };
}

async function runCancelWorking(
  ctx: CommandCtx,
  command: Extract<FuturesCommand, { kind: "cancel-working" }>,
): Promise<CommandOutcome> {
  const { actor, supabase } = ctx;
  const workingId = String(command.workingId ?? "").trim();
  const opens = await loadOpenFuturesWorking(actorScope(actor));
  const row = opens.find((item) => item.id === workingId) ?? null;
  if (!row) {
    return fail("That order is no longer open.");
  }
  let connection: BoundConnectionSecrets | null = null;
  if (accountCanHoldConnections(actor.mode)) {
    const settings = await loadFuturesSettings(actor.accountId);
    if (!settings.connectionId && row.venueOrderId) {
      return fail(
        "Bind an exchange in Desk Settings before cancelling.",
      );
    }
    if (settings.connectionId) {
      const bound = await loadBoundVenueForAccount({
        userId: actor.userId,
        accountId: actor.accountId,
        mode: actor.mode,
        connectionId: settings.connectionId,
      });
      if (!bound.ok) {
        return fail(bound.error);
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
    return fail(cancelled.error);
  }
  await writeEventLog({
    scope: "trade",
    event: "trade.futures",
    message: withFuturesOrigin(`Cancelled limit ${row.symbol}`, {
      source: row.source,
      ruleName: row.ruleName,
    }),
    userId: actor.userId,
    accountId: actor.accountId,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      symbol: row.symbol,
      workingId: row.id,
      action: row.action,
      ...futuresOriginLog({ source: row.source, ruleName: row.ruleName }),
    },
  });
  return { ok: true, flash: "cancelled", workingId: row.id };
}

async function runAmendWorking(
  ctx: CommandCtx,
  command: Extract<FuturesCommand, { kind: "amend-working" }>,
): Promise<CommandOutcome> {
  const { actor, supabase, liveBook } = ctx;
  const workingId = String(command.workingId ?? "").trim();
  const opens = await loadOpenFuturesWorking(actorScope(actor));
  const row = opens.find((item) => item.id === workingId) ?? null;
  if (!row) {
    return fail("That order is no longer open.");
  }
  const qtyParsed = parseFuturesQty(command.qty);
  if (!qtyParsed.ok) {
    return fail(qtyParsed.error);
  }
  const limitParsed = parseFuturesLimitPrice(command.limitPrice);
  if (!limitParsed.ok) {
    return fail(limitParsed.error);
  }
  const instrument = await loadPerpInstrument(row.symbol);
  if (!instrument) {
    return fail(
      "That symbol is not a trading USDT linear perpetual on Bybit.",
    );
  }
  const remainingSized = qtyForPerp(qtyParsed.qty, instrument);
  if (!remainingSized.ok) {
    return fail(remainingSized.error);
  }
  const priced = priceForPerp(limitParsed.price, instrument);
  if (!priced.ok) {
    return fail(priced.error);
  }
  const totalSized = qtyForPerp(row.filledQty + remainingSized.qty, instrument);
  if (!totalSized.ok) {
    return fail(totalSized.error);
  }
  const remaining = Number(
    (totalSized.qty - Math.max(0, row.filledQty)).toPrecision(12),
  );
  const amended = nextWorkingAmend({
    filledQty: row.filledQty,
    qty: row.qty,
    limitPrice: row.limitPrice,
    nextRemainingQty: remaining,
    nextLimitPrice: priced.price,
  });
  if (!amended.ok) {
    if (isUnchangedWorkingAmend(amended.error)) {
      return { ok: true, flash: "amended", workingId: row.id };
    }
    return fail(amended.error);
  }
  const tpsl = tpslFromRow(row);
  if (tpslHasLevels(tpsl) && tpsl) {
    const checked = validateTpslVsReference({
      side: row.side,
      tpsl,
      reference: priced.price,
    });
    if (!checked.ok) {
      return fail(checked.error);
    }
  }
  let connection: BoundConnectionSecrets | null = null;
  if (liveBook) {
    const settings = await loadFuturesSettings(actor.accountId);
    if (!settings.connectionId && row.venueOrderId) {
      return fail(
        "Bind an exchange in Desk Settings before editing.",
      );
    }
    if (settings.connectionId) {
      const bound = await loadBoundVenueForAccount({
        userId: actor.userId,
        accountId: actor.accountId,
        mode: actor.mode,
        connectionId: settings.connectionId,
      });
      if (!bound.ok) {
        return fail(bound.error);
      }
      connection = bound.connection;
    }
  }
  const saved = await amendFuturesWorkingRow({
    supabase,
    row,
    connection,
    qty: totalSized.qty,
    qtyText: totalSized.text,
    remainingQty: amended.remainingQty,
    limitPrice: amended.limitPrice,
    priceText: priced.text,
    qtyChanged: amended.qtyChanged,
    priceChanged: amended.priceChanged,
  });
  if (!saved.ok) {
    if (isUnchangedWorkingAmend(saved.error)) {
      const patched = await patchFuturesWorking({
        supabase,
        row,
        qty: totalSized.qty,
        remainingQty: remaining,
        limitPrice: priced.price,
      });
      if (!patched.ok) {
        return fail(patched.error);
      }
      return {
        ok: true,
        flash: liveBook ? "live-amended" : "amended",
        workingId: row.id,
      };
    }
    return fail(saved.error);
  }
  await writeEventLog({
    scope: "trade",
    event: "trade.futures",
    message: withFuturesOrigin(`Amended limit ${row.symbol}`, {
      source: row.source,
      ruleName: row.ruleName,
    }),
    userId: actor.userId,
    accountId: actor.accountId,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      symbol: row.symbol,
      workingId: row.id,
      action: row.action,
      qty: totalSized.qty,
      limitPrice: amended.limitPrice,
      live: liveBook,
      ...futuresOriginLog({ source: row.source, ruleName: row.ruleName }),
    },
  });
  return {
    ok: true,
    flash: liveBook ? "live-amended" : "amended",
    workingId: row.id,
  };
}

async function runCloseAll(
  ctx: CommandCtx,
  command: Extract<FuturesCommand, { kind: "close-all" }>,
): Promise<CommandOutcome> {
  const scoped = parseCloseAllScope(command.scope);
  if (!scoped.ok) {
    return fail(scoped.error);
  }
  const confirmed = parseCloseAllConfirm(command.confirm, scoped.scope);
  if (!confirmed.ok) {
    return fail(confirmed.error);
  }
  const cancelOrders = scoped.scope === "orders" || scoped.scope === "all";
  const closePositions = scoped.scope === "positions" || scoped.scope === "all";
  const setReduceOnly =
    closePositions && parseSetReduceOnly(command.setReduceOnly);
  const { actor, supabase, liveBook } = ctx;
  const listScope = actorScope(actor);
  const working = cancelOrders ? await loadOpenFuturesWorking(listScope) : [];
  const opens = closePositions
    ? await loadFuturesPositions({ status: "open", scope: listScope })
    : [];
  if (working.length === 0 && opens.length === 0) {
    return fail(
      closePositions && cancelOrders
        ? "Nothing to cancel or close."
        : closePositions
          ? "Nothing to close."
          : "Nothing to cancel.",
    );
  }

  if (setReduceOnly) {
    const armed = await armFuturesReduceOnly({
      supabase,
      userId: actor.userId,
      accountId: actor.accountId,
    });
    if (!armed.ok) {
      return fail(armed.error);
    }
    const automationArmed = await armFuturesAutomationReduceOnly({
      supabase,
      accountId: actor.accountId,
    });
    if (!automationArmed.ok) {
      return fail(automationArmed.error);
    }
    await writeEventLog({
      scope: "strategy",
      event: "settings.saved",
      message: "Set reduce only from Close All",
      userId: actor.userId,
      accountId: actor.accountId,
      strategy: FUTURES_STRATEGY_ID,
      data: { reduceOnly: true, source: "close-all", automations: true },
    });
    revalidatePath(FUTURES_PATHS.settings);
    revalidatePath(FUTURES_PATHS.automations);
  }

  let connection: BoundConnectionSecrets | null = null;
  if (working.length > 0 && accountCanHoldConnections(actor.mode)) {
    const settings = await loadFuturesSettings(actor.accountId);
    if (!settings.connectionId && working.some((row) => row.venueOrderId)) {
      return fail(
        "Bind an exchange in Desk Settings before cancelling.",
      );
    }
    if (settings.connectionId) {
      const bound = await loadBoundVenueForAccount({
        userId: actor.userId,
        accountId: actor.accountId,
        mode: actor.mode,
        connectionId: settings.connectionId,
      });
      if (!bound.ok) {
        return fail(bound.error);
      }
      connection = bound.connection;
    }
  }

  const childCtx: CommandCtx = { ...ctx, key: null };
  let cancelledCount = 0;
  for (const row of working) {
    const cancelled = await cancelFuturesWorkingRow({
      supabase,
      row,
      connection,
    });
    if (!cancelled.ok) {
      return fail(`Could not cancel ${row.symbol}: ${cancelled.error}`);
    }
    cancelledCount += 1;
    await writeEventLog({
      scope: "trade",
      event: "trade.futures",
      message: withFuturesOrigin(`Cancelled limit ${row.symbol}`, {
        source: row.source,
        ruleName: row.ruleName,
      }),
      userId: actor.userId,
      accountId: actor.accountId,
      strategy: FUTURES_STRATEGY_ID,
      data: {
        symbol: row.symbol,
        workingId: row.id,
        action: row.action,
        ...futuresOriginLog({ source: row.source, ruleName: row.ruleName }),
      },
    });
  }

  let closedCount = 0;
  for (const row of opens) {
    const closed = await runPlace(childCtx, {
      kind: "place",
      action: "close",
      symbol: row.symbol,
      positionId: row.id,
      orderType: "market",
    });
    if (!closed.ok) {
      return fail(`Could not close ${row.symbol}: ${closed.error}`);
    }
    closedCount += 1;
  }

  await writeEventLog({
    scope: "trade",
    event: "trade.futures",
    message:
      cancelledCount > 0 && closedCount > 0
        ? "Cancelled working orders and closed all open futures"
        : closedCount > 0
          ? "Closed all open futures"
          : "Cancelled all working futures orders",
    userId: actor.userId,
    accountId: actor.accountId,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      action: "close-all",
      scope: scoped.scope,
      cancelledCount,
      closedCount,
      setReduceOnly,
      live: liveBook,
    },
  });

  return {
    ok: true,
    flash: closeAllFlash({
      live: liveBook,
      closedCount,
      cancelledCount,
    }),
  };
}
