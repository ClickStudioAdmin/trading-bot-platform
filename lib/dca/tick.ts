import {
  deskAllowsDcaPlaybooks,
  parseDeskQuery,
  parseDeskType,
  type TradingAccountMode,
} from "@/lib/accounts/model";
import {
  fetchBybitTickers,
  type BybitTicker,
} from "@/lib/exchanges/bybit/client";
import {
  closedLiveIndicatorBars,
  loadDeskIndicatorBars,
} from "@/lib/market/desk-klines";
import type { CandleBar } from "@/lib/market/candles";
import { loadDeskTickerMap } from "@/lib/market/desk-tickers";
import {
  parseStoredVenueEnvironment,
  parseStoredVenueId,
} from "@/lib/exchanges/venues";
import {
  lastAtrValue,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import {
  loadFuturesWorking,
  loadOpenFuturesOnSymbol,
  loadOpenFuturesWorking,
} from "@/lib/futures/list";
import { parseFuturesPositionRow } from "@/lib/futures/model";
import type { FuturesSide } from "@/lib/futures/model";
import { tickerTriggerPrices } from "@/lib/futures/tpsl";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  dcaArmTriggerForSide,
  dcaClipsFilledFromGrid,
  dcaCycleEnded,
  dcaEnabledSides,
  dcaGridClipCounts,
  dcaIndicatorStartForSide,
  dcaAtrTimeframe,
  dcaLegFor,
  dcaLegIsRunning,
  dcaLiveQtyBlocksCycleEnd,
  dcaNeedsAtrBars,
  dcaNeedsTickBars,
  dcaTickBarTimeframes,
  dcaOpenExitLimits,
  dcaShouldFlattenIdleOpen,
  dcaStartListens,
  decideDcaTick,
  dcaTickValueCapUsdt,
  type DcaPlaybook,
} from "./playbook";
import {
  dcaFilterForSide,
  dcaPlaybookFilterNeedsWideBars,
  seriesForFilter,
} from "./filters";
import {
  formatBreakevenReason,
  formatDcaStartReasons,
  formatHardExitReason,
  formatPriceCrossReason,
} from "@/lib/bots/condition-copy";
import { dcaDecisionMessage } from "./log-copy";
import {
  applyDcaVerb,
  flattenPlaybook,
  keepListeningAfterFlatten,
  logDcaEvent,
  moveStopToBreakeven,
  placeClip,
  syncDcaPlaybookExits,
  syncDcaPlaybookGrid,
} from "./run";
import {
  listDcaPlaybooks,
  listDcaPlaybooksForAccount,
  patchDcaLeg,
  patchDcaPlaybook,
  resetDcaLeg,
} from "./store";

export async function runDcaPlaybookTick(input?: {
  accountId?: string;
  tickers?: Map<string, BybitTicker>;
}): Promise<{ acted: number }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { acted: 0 };
  }
  const playbooks = input?.accountId
    ? await listDcaPlaybooksForAccount(input.accountId, supabase)
    : await listDcaPlaybooks(supabase);
  if (playbooks.length === 0) {
    return { acted: 0 };
  }
  const accountIds = [...new Set(playbooks.map((row) => row.accountId))];
  const [
    { data: accountRows },
    { data: settingsRows },
    { data: openRows },
    fetchedTickers,
  ] = await Promise.all([
    supabase
      .from("trading_accounts")
      .select("id, user_id, mode, desk_type, venue, venue_environment, copy_of_account_id")
      .in("id", accountIds),
    supabase
      .from("strategy_settings")
      .select("account_id, reduce_only")
      .eq("strategy_id", FUTURES_STRATEGY_ID)
      .in("account_id", accountIds),
    supabase
      .from("futures_positions")
      .select("*")
      .eq("status", "open")
      .in("account_id", accountIds),
    input?.tickers
      ? Promise.resolve(input.tickers)
      : fetchBybitTickers("linear").catch(() => new Map<string, BybitTicker>()),
  ]);
  const tickers = fetchedTickers;
  const accounts = new Map(
    (accountRows ?? []).map((row) => {
      const venue = parseStoredVenueId((row as { venue?: unknown }).venue);
      return [
        String((row as { id: string }).id),
        {
          userId: String((row as { user_id: string }).user_id),
          mode: String((row as { mode: string }).mode) as TradingAccountMode,
          deskType: parseDeskType((row as { desk_type?: unknown }).desk_type),
          copyOfAccountId: parseDeskQuery(
            (row as { copy_of_account_id?: unknown }).copy_of_account_id,
          ),
          venue,
          venueEnvironment: parseStoredVenueEnvironment(
            venue,
            (row as { venue_environment?: unknown }).venue_environment,
          ),
        },
      ] as const;
    }),
  );
  const reduceOnly = new Set(
    (settingsRows ?? [])
      .filter((row) => Boolean((row as { reduce_only?: unknown }).reduce_only))
      .map((row) => String((row as { account_id: string }).account_id)),
  );
  const opens = (openRows ?? []).map((row) =>
    parseFuturesPositionRow(row as Record<string, unknown>),
  );
  const klineCache = new Map<string, CandleBar[]>();

  let acted = 0;
  for (const playbook of playbooks) {
    const account = accounts.get(playbook.accountId);
    if (!account || !deskAllowsDcaPlaybooks(account)) {
      continue;
    }
    const deskTickers =
      account.venue === "hyperliquid" && !input?.tickers
        ? await loadDeskTickerMap(
            account.venue,
            account.venueEnvironment,
          ).catch(() => tickers)
        : tickers;
    const ticker = deskTickers.get(playbook.symbol) ?? {};
    const prices = tickerTriggerPrices(ticker);
    const barsByTimeframe = new Map<DcaIndicatorTimeframe, CandleBar[]>();
    if (dcaNeedsTickBars(playbook)) {
      for (const indicatorTimeframe of dcaTickBarTimeframes(playbook)) {
        const key = `${account.venue}:${playbook.symbol}:${indicatorTimeframe}`;
        if (!klineCache.has(key)) {
          const supertrend =
            playbook.indicatorKind === "supertrend" ||
            playbook.shortIndicatorKind === "supertrend";
          const fetched = await loadDeskIndicatorBars({
            venue: account.venue,
            venueEnvironment: account.venueEnvironment,
            symbol: playbook.symbol,
            interval: indicatorTimeframe,
            limit:
              supertrend ||
              dcaNeedsAtrBars(playbook) ||
              dcaPlaybookFilterNeedsWideBars(playbook)
                ? 500
                : 80,
          }).catch((error: unknown) => {
            console.error(
              "engine indicator bars",
              playbook.symbol,
              indicatorTimeframe,
              error instanceof Error ? error.message : error,
            );
            return [];
          });
          klineCache.set(key, fetched);
        }
        barsByTimeframe.set(indicatorTimeframe, klineCache.get(key) ?? []);
      }
    }
    const atrTimeframe = dcaAtrTimeframe(playbook);
    const atr =
      dcaNeedsAtrBars(playbook) && playbook.atrPeriod != null
        ? lastAtrValue(
            closedLiveIndicatorBars(
              barsByTimeframe.get(atrTimeframe) ?? [],
              atrTimeframe,
            ),
            playbook.atrPeriod,
          )
        : null;
    const [working, openWorking] = await Promise.all([
      playbook.dcaMode === "order"
        ? loadFuturesWorking(
            {
              accountId: playbook.accountId,
              userId: playbook.userId,
            },
            ["open", "filled"],
          )
        : Promise.resolve([]),
      loadOpenFuturesWorking({
        accountId: playbook.accountId,
        userId: playbook.userId,
      }),
    ]);
    for (const side of dcaEnabledSides(playbook.direction)) {
      let leg = dcaLegFor(playbook, side);
      if (
        playbook.dcaMode === "order" &&
        playbook.maxClips !== null &&
        dcaLegIsRunning(leg.status)
      ) {
        const counts = dcaGridClipCounts(working, playbook.id, side);
        const hasFirstFill =
          leg.clipsFilled >= 1 || leg.firstFillPrice !== null;
        const computed = dcaClipsFilledFromGrid({
          hasFirstFill,
          maxClips: playbook.maxClips,
          openWorking: counts.open,
          filledAdds: counts.filledAdds,
        });
        if (computed !== leg.clipsFilled) {
          await patchDcaLeg({
            supabase,
            id: playbook.id,
            side,
            patch: { clipsFilled: computed },
          });
          leg = { ...leg, clipsFilled: computed };
          if (side === "long") {
            playbook.long = leg;
          } else {
            playbook.short = leg;
          }
        }
      }
      let open = opens.find(
        (row) =>
          row.accountId === playbook.accountId &&
          row.symbol === playbook.symbol &&
          row.side === side,
      );
      if (leg.status === "closing") {
        if (open && open.qty > 0) {
          const flattened = await flattenPlaybook({
            playbook,
            mode: account.mode,
            side,
            reason: "Close requested.",
          });
          if (!flattened.ok) {
            continue;
          }
        }
        const kept = await keepListeningAfterFlatten({
          playbook,
          side,
        });
        if (kept.ok) {
          acted += 1;
        }
        continue;
      }
      await syncDcaPlaybookExits({
        playbook,
        mode: account.mode,
        side,
        lastPrice: prices.last,
        atr,
      });
      await syncDcaPlaybookGrid({
        playbook,
        mode: account.mode,
        side,
        atr,
      });
      if (
        dcaShouldFlattenIdleOpen({
          status: leg.status,
          positionQty: open?.qty ?? null,
        })
      ) {
        const flattened = await flattenPlaybook({
          playbook,
          mode: account.mode,
          side,
          reason: "Bot is disabled.",
        });
        if (flattened.ok) {
          acted += 1;
        }
        continue;
      }
      if (
        dcaLegIsRunning(leg.status) &&
        leg.clipsFilled >= 1 &&
        !dcaLiveQtyBlocksCycleEnd(open?.qty ?? null)
      ) {
        const liveOpens = await loadOpenFuturesOnSymbol(playbook.symbol, {
          accountId: playbook.accountId,
          userId: playbook.userId,
        });
        open = liveOpens.find((row) => row.side === side);
      }
      const tpLimitResting =
        dcaOpenExitLimits(openWorking, playbook.id, side, "tp").length > 0;
      const indicatorStart = dcaIndicatorStartForSide(playbook, side);
      const confirm = dcaFilterForSide(playbook, side, "confirm");
      const exitIf = dcaFilterForSide(playbook, side, "exitIf");
      const confirmSeries = seriesForFilter(
        confirm,
        confirm
          ? closedLiveIndicatorBars(
              barsByTimeframe.get(confirm.timeframe) ?? [],
              confirm.timeframe,
            )
          : null,
      );
      const exitIfSeries = seriesForFilter(
        exitIf,
        exitIf
          ? closedLiveIndicatorBars(
              barsByTimeframe.get(exitIf.timeframe) ?? [],
              exitIf.timeframe,
            )
          : null,
      );
      const decision = decideDcaTick({
        status: leg.status,
        side,
        reduceOnly: reduceOnly.has(playbook.accountId),
        lastPrice: prices.last,
        mark: prices.mark,
        lastClipPrice: leg.lastClipPrice,
        lastClipAtMs: leg.lastClipAtMs,
        firstFillPrice: leg.firstFillPrice,
        nowMs: Date.now(),
        startKind: playbook.startKind,
        dcaMode: playbook.dcaMode,
        dipPct: playbook.dipPct,
        intervalMinutes: playbook.intervalMinutes,
        deviationMultiplier: playbook.deviationMultiplier,
        spacingKind: playbook.spacingKind,
        atr,
        atrSpacingMult: playbook.atrSpacingMult,
        clipsFilled: leg.clipsFilled,
        maxClips: playbook.maxClips,
        maxValue: dcaTickValueCapUsdt({
          kind: playbook.maxValueKind,
          maxValue: playbook.maxValue,
          cycleMaxValue: leg.cycleMaxValue,
        }),
        positionQty: open?.qty ?? null,
        entryPrice: open?.entryPrice ?? null,
        takeProfitKind: playbook.takeProfitKind,
        takeProfitAtrMult: playbook.takeProfitAtrMult,
        takeProfitPct: playbook.takeProfitPct,
        stopLossPct: playbook.stopLossPct,
        takeProfitBasis: playbook.takeProfitBasis,
        stopLossBasis: playbook.stopLossBasis,
        takeProfitOrderType: playbook.takeProfitOrderType,
        tpLimitResting,
        breakevenActivationPct: playbook.breakevenActivationPct,
        breakevenDone: leg.breakevenDone,
        armTrigger: dcaArmTriggerForSide(playbook, side),
        armConditionTrue: playbook.armConditionTrue,
        disarmTrigger: playbook.disarmTrigger,
        disarmConditionTrue: playbook.disarmConditionTrue,
        indicatorKind: indicatorStart?.kind ?? null,
        indicatorCompare: indicatorStart?.compare ?? null,
        indicatorLevel: indicatorStart?.level ?? null,
        indicatorPeriod: indicatorStart?.period ?? null,
        indicatorSlowPeriod: indicatorStart?.slowPeriod ?? null,
        indicatorMultiplier: indicatorStart?.multiplier ?? null,
        splitIndicatorSides:
          playbook.direction === "both" &&
          !playbook.shortIndicatorKind &&
          !playbook.shortArmTrigger,
        indicatorConditionTrue:
          side === "long"
            ? playbook.longIndicatorTrue
            : playbook.shortIndicatorTrue,
        closes: indicatorStart
          ? closedLiveIndicatorBars(
              barsByTimeframe.get(indicatorStart.timeframe) ?? [],
              indicatorStart.timeframe,
            ).map((row) => row.close)
          : null,
        bars: indicatorStart
          ? closedLiveIndicatorBars(
              barsByTimeframe.get(indicatorStart.timeframe) ?? [],
              indicatorStart.timeframe,
            )
          : null,
        confirm,
        confirmCloses: confirmSeries.closes,
        confirmBars: confirmSeries.bars,
        exitIf,
        exitIfCloses: exitIfSeries.closes,
        exitIfBars: exitIfSeries.bars,
        triggerPrices: prices,
      });
      const flags = await patchDcaPlaybook({
        supabase,
        id: playbook.id,
        patch: {
          armConditionTrue: decision.nextArmTrue,
          disarmConditionTrue: decision.nextDisarmTrue,
          ...(side === "long"
            ? { longIndicatorTrue: decision.nextIndicatorTrue }
            : { shortIndicatorTrue: decision.nextIndicatorTrue }),
        },
      });
      if (!flags.ok) {
        continue;
      }
      playbook.armConditionTrue = decision.nextArmTrue;
      playbook.disarmConditionTrue = decision.nextDisarmTrue;
      if (side === "long") {
        playbook.longIndicatorTrue = decision.nextIndicatorTrue;
      } else {
        playbook.shortIndicatorTrue = decision.nextIndicatorTrue;
      }
      const why = dcaActionWhy({
        playbook,
        side,
        action: decision.action,
        lastPrice: prices.last,
        mark: prices.mark,
        entryPrice: open?.entryPrice ?? null,
        clipsFilled: leg.clipsFilled,
      });
      if (
        decision.action.kind !== "none" &&
        decision.action.kind !== "end_cycle"
      ) {
        await logDcaEvent({
          playbook,
          side,
          positionId: open?.id ?? null,
          event: "dca.decision",
          message: dcaDecisionMessage({
            name: playbook.name,
            kind: decision.action.kind,
            reason:
              "reason" in decision.action ? decision.action.reason : null,
            clipsFilled: leg.clipsFilled,
            maxClips: playbook.maxClips,
            why,
          }),
          data: {
            kind: decision.action.kind,
            reason:
              "reason" in decision.action ? decision.action.reason : null,
            clipsFilled: leg.clipsFilled,
            maxClips: playbook.maxClips,
            mark: prices.mark,
            last: prices.last,
            entryPrice: open?.entryPrice ?? null,
            tpLimitResting,
            ...(why ? { why } : {}),
          },
        });
      }
      const result = await applyTickAction({
        playbook,
        mode: account.mode,
        side,
        lastPrice: prices.last,
        action: decision.action,
        why,
      });
      if (result.acted) {
        acted += 1;
      }
    }
  }
  return { acted };
}

function dcaActionWhy(input: {
  playbook: DcaPlaybook;
  side: FuturesSide;
  action: ReturnType<typeof decideDcaTick>["action"];
  lastPrice: number | null;
  mark: number | null;
  entryPrice: number | null;
  clipsFilled: number;
}): string {
  const { playbook, side, action } = input;
  if (
    action.kind === "arm" ||
    (action.kind === "clip" && input.clipsFilled === 0)
  ) {
    return formatDcaStartReasons({
      startKind: playbook.startKind,
      side,
      armTrigger: dcaArmTriggerForSide(playbook, side),
      indicator: dcaIndicatorStartForSide(playbook, side),
      confirm: dcaFilterForSide(playbook, side, "confirm"),
      price: input.lastPrice,
    });
  }
  if (action.kind === "disarm" && playbook.disarmTrigger) {
    return formatPriceCrossReason({
      source: playbook.disarmTrigger.triggerBy,
      compare: playbook.disarmTrigger.compare,
      level: playbook.disarmTrigger.price,
      price: input.lastPrice,
    });
  }
  if (action.kind === "close" && action.reason === "exit_if") {
    const exitIf = dcaFilterForSide(playbook, side, "exitIf");
    return exitIf ? formatHardExitReason(exitIf, side) : "";
  }
  if (action.kind === "breakeven") {
    return formatBreakevenReason({
      side,
      entryPrice: input.entryPrice ?? 0,
      mark: input.mark ?? input.lastPrice ?? 0,
      activationPct: playbook.breakevenActivationPct ?? 0,
      offsetPct: playbook.breakevenOffsetPct,
    });
  }
  return "";
}

async function applyTickAction(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
  lastPrice: number | null;
  action: ReturnType<typeof decideDcaTick>["action"];
  why?: string;
}): Promise<{ acted: boolean }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { acted: false };
  }
  if (input.action.kind === "none") {
    return { acted: false };
  }
  if (input.action.kind === "arm") {
    const armed = await applyDcaVerb({
      playbook: input.playbook,
      mode: input.mode,
      verb: "arm",
      side: input.side,
      forcePlace: true,
      reason: input.why,
    });
    if (!armed.ok) {
      const why = String(input.why ?? "").trim();
      await logDcaEvent({
        playbook: input.playbook,
        side: input.side,
        level: "warning",
        event: "engine.open_failed",
        message: why ? `${armed.error} Trying: ${why}.` : armed.error,
        data: { reason: "arm", ...(why ? { why } : {}) },
      });
    }
    return { acted: armed.ok };
  }
  if (input.action.kind === "disarm") {
    const disarmed = await applyDcaVerb({
      playbook: input.playbook,
      mode: input.mode,
      verb: "disarm",
      side: input.side,
    });
    return { acted: disarmed.ok };
  }
  if (input.action.kind === "stop_adding") {
    const patched = await patchDcaLeg({
      supabase,
      id: input.playbook.id,
      side: input.side,
      patch: { status: "stop_adding" },
    });
    return { acted: patched.ok };
  }
  if (input.action.kind === "breakeven") {
    const moved = await moveStopToBreakeven({
      playbook: input.playbook,
      mode: input.mode,
      side: input.side,
      reason: input.why,
    });
    return { acted: moved.ok };
  }
  if (input.action.kind === "clip") {
    if (input.lastPrice === null) {
      return { acted: false };
    }
    const placed = await placeClip({
      playbook: input.playbook,
      mode: input.mode,
      side: input.side,
      lastPrice: input.lastPrice,
      reason: input.why,
    });
    if (!placed.ok) {
      const why = String(input.why ?? "").trim();
      await logDcaEvent({
        playbook: input.playbook,
        side: input.side,
        level: "warning",
        event: "engine.open_failed",
        message: why ? `${placed.error} Trying: ${why}.` : placed.error,
        data: { reason: "clip", ...(why ? { why } : {}) },
      });
      return { acted: false };
    }
    return { acted: true };
  }
  if (input.action.kind === "end_cycle") {
    const liveOpens = await loadOpenFuturesOnSymbol(input.playbook.symbol, {
      accountId: input.playbook.accountId,
      userId: input.playbook.userId,
    });
    const liveQty =
      liveOpens.find((row) => row.side === input.side)?.qty ?? null;
    const leg = dcaLegFor(input.playbook, input.side);
    if (
      !dcaCycleEnded({
        status: leg.status,
        clipsFilled: leg.clipsFilled,
        positionQty: liveQty,
      })
    ) {
      await logDcaEvent({
        playbook: input.playbook,
        side: input.side,
        positionId: liveOpens.find((row) => row.side === input.side)?.id ?? null,
        event: "dca.decision",
        message: `${input.playbook.name} cycle-end skipped. Position is still open.`,
        data: { kind: "end_cycle", reason: "position_open", qty: liveQty },
      });
      return { acted: false };
    }
    const flattened = await flattenPlaybook({
      playbook: input.playbook,
      mode: input.mode,
      side: input.side,
    });
    if (!flattened.ok) {
      return { acted: false };
    }
    const kept = await keepListeningAfterFlatten({
      playbook: input.playbook,
      side: input.side,
    });
    if (!kept.ok) {
      return { acted: false };
    }
    await logDcaEvent({
      playbook: input.playbook,
      side: input.side,
      event: "dca.closed",
      message: dcaStartListens(input.playbook.startKind)
        ? `${input.playbook.name} position closed. Waiting for the next start.`
        : `${input.playbook.name} position closed. Bot is idle.`,
      data: { reason: "end_cycle" },
    });
    return { acted: true };
  }
  if (input.action.kind !== "close") {
    return { acted: false };
  }
  const closed = await flattenPlaybook({
    playbook: input.playbook,
    mode: input.mode,
    side: input.side,
    reason: input.why,
  });
  if (!closed.ok) {
    const why = String(input.why ?? "").trim();
    await logDcaEvent({
      playbook: input.playbook,
      side: input.side,
      level: "warning",
      event: "engine.open_failed",
      message: why ? `${closed.error} Trying: ${why}.` : closed.error,
      data: {
        reason: input.action.reason,
        ...(why ? { why } : {}),
      },
    });
    return { acted: false };
  }
  await resetDcaLeg({
    supabase,
    id: input.playbook.id,
    side: input.side,
  });
  const why = String(input.why ?? "").trim();
  await logDcaEvent({
    playbook: input.playbook,
    side: input.side,
    event: "dca.closed",
    message:
      input.action.reason === "take_profit"
        ? `${input.playbook.name} hit take profit.`
        : input.action.reason === "exit_if"
          ? why
            ? `${input.playbook.name} Hard Exit hit. ${why}.`
            : `${input.playbook.name} Hard Exit hit.`
          : `${input.playbook.name} hit stop loss.`,
    data: {
      reason: input.action.reason,
      ...(why ? { why } : {}),
    },
  });
  return { acted: true };
}

