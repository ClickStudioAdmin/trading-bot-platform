import { parseDeskType, type TradingAccountMode } from "@/lib/accounts/model";
import {
  fetchBybitKlines,
  fetchBybitTickers,
} from "@/lib/exchanges/bybit/client";
import {
  loadFuturesWorking,
  loadOpenFuturesOnSymbol,
  loadOpenFuturesWorking,
} from "@/lib/futures/list";
import { parseFuturesPositionRow } from "@/lib/futures/model";
import type { FuturesSide } from "@/lib/futures/model";
import { tickerTriggerPrices } from "@/lib/futures/tpsl";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  dcaClipsFilledFromGrid,
  dcaCycleEnded,
  dcaEnabledSides,
  dcaGridClipCounts,
  dcaLegFor,
  dcaLegIsRunning,
  dcaLiveQtyBlocksCycleEnd,
  dcaOpenExitLimits,
  dcaStartListens,
  decideDcaTick,
  type DcaPlaybook,
} from "./playbook";
import {
  applyDcaVerb,
  flattenPlaybook,
  moveStopToBreakeven,
  placeClip,
  syncDcaPlaybookExits,
  syncDcaPlaybookGrid,
} from "./run";
import {
  listDcaPlaybooks,
  loadDcaPlaybookById,
  patchDcaLeg,
  patchDcaPlaybook,
  resetDcaLeg,
} from "./store";

export async function runDcaPlaybookTick(): Promise<{ acted: number }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { acted: 0 };
  }
  const playbooks = await listDcaPlaybooks(supabase);
  if (playbooks.length === 0) {
    return { acted: 0 };
  }
  const accountIds = [...new Set(playbooks.map((row) => row.accountId))];
  const [
    { data: accountRows },
    { data: settingsRows },
    { data: openRows },
    tickers,
  ] = await Promise.all([
    supabase
      .from("trading_accounts")
      .select("id, user_id, mode, desk_type")
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
    fetchBybitTickers("linear").catch(() => null),
  ]);
  if (!tickers) {
    await writeEventLog({
      level: "warning",
      scope: "strategy",
      event: "engine.open_failed",
      message: "DCA tick skipped: could not read linear tickers.",
      strategy: FUTURES_STRATEGY_ID,
    });
    return { acted: 0 };
  }
  const accounts = new Map(
    (accountRows ?? []).map((row) => [
      String((row as { id: string }).id),
      {
        userId: String((row as { user_id: string }).user_id),
        mode: String((row as { mode: string }).mode) as TradingAccountMode,
        deskType: parseDeskType((row as { desk_type?: unknown }).desk_type),
      },
    ]),
  );
  const reduceOnly = new Set(
    (settingsRows ?? [])
      .filter((row) => Boolean((row as { reduce_only?: unknown }).reduce_only))
      .map((row) => String((row as { account_id: string }).account_id)),
  );
  const opens = (openRows ?? []).map((row) =>
    parseFuturesPositionRow(row as Record<string, unknown>),
  );
  const klineCache = new Map<string, number[]>();

  let acted = 0;
  for (const listed of playbooks) {
    const playbook =
      (await loadDcaPlaybookById(listed.id, listed.accountId, supabase)) ??
      listed;
    const account = accounts.get(playbook.accountId);
    if (!account || account.deskType !== "dca") {
      continue;
    }
    const ticker = tickers.get(playbook.symbol) ?? {};
    const prices = tickerTriggerPrices(ticker);
    let closes: number[] | null = null;
    if (
      playbook.startKind === "indicator" &&
      playbook.indicatorTimeframe
    ) {
      const key = `${playbook.symbol}:${playbook.indicatorTimeframe}`;
      if (!klineCache.has(key)) {
        const fetched = await fetchBybitKlines({
          symbol: playbook.symbol,
          interval: playbook.indicatorTimeframe,
        }).catch(() => []);
        klineCache.set(key, fetched);
      }
      closes = klineCache.get(key) ?? [];
    }
    const working =
      playbook.dcaMode === "order"
        ? await loadFuturesWorking(
            {
              accountId: playbook.accountId,
              userId: playbook.userId,
            },
            ["open", "filled"],
          )
        : [];
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
      await syncDcaPlaybookGrid({
        playbook,
        mode: account.mode,
        side,
      });
      await syncDcaPlaybookExits({
        playbook,
        mode: account.mode,
        side,
        lastPrice: prices.last,
      });
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
      const openWorking = await loadOpenFuturesWorking({
        accountId: playbook.accountId,
        userId: playbook.userId,
      });
      const tpLimitResting =
        dcaOpenExitLimits(openWorking, playbook.id, side, "tp").length > 0;
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
        clipsFilled: leg.clipsFilled,
        maxClips: playbook.maxClips,
        maxValue: playbook.maxValue,
        positionQty: open?.qty ?? null,
        entryPrice: open?.entryPrice ?? null,
        takeProfitPct: playbook.takeProfitPct,
        stopLossPct: playbook.stopLossPct,
        takeProfitBasis: playbook.takeProfitBasis,
        stopLossBasis: playbook.stopLossBasis,
        takeProfitOrderType: playbook.takeProfitOrderType,
        tpLimitResting,
        breakevenActivationPct: playbook.breakevenActivationPct,
        breakevenDone: leg.breakevenDone,
        armTrigger: playbook.armTrigger,
        armConditionTrue: playbook.armConditionTrue,
        disarmTrigger: playbook.disarmTrigger,
        disarmConditionTrue: playbook.disarmConditionTrue,
        indicatorKind: playbook.indicatorKind,
        indicatorCompare: playbook.indicatorCompare,
        indicatorLevel: playbook.indicatorLevel,
        splitIndicatorSides: playbook.direction === "both",
        indicatorConditionTrue:
          side === "long"
            ? playbook.longIndicatorTrue
            : playbook.shortIndicatorTrue,
        closes,
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
      const result = await applyTickAction({
        playbook,
        mode: account.mode,
        side,
        lastPrice: prices.last,
        action: decision.action,
      });
      if (result.acted) {
        acted += 1;
      }
      await syncDcaPlaybookGrid({
        playbook,
        mode: account.mode,
        side,
      });
      await syncDcaPlaybookExits({
        playbook,
        mode: account.mode,
        side,
        lastPrice: prices.last,
      });
    }
  }
  return { acted };
}

async function applyTickAction(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
  lastPrice: number | null;
  action: ReturnType<typeof decideDcaTick>["action"];
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
    });
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
    });
    if (!placed.ok) {
      await writeEventLog({
        level: "warning",
        scope: "trade",
        event: "engine.open_failed",
        message: placed.error,
        userId: input.playbook.userId,
        accountId: input.playbook.accountId,
        strategy: FUTURES_STRATEGY_ID,
        data: { playbookId: input.playbook.id, side: input.side },
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
    if (dcaStartListens(input.playbook.startKind)) {
      const patched = await patchDcaLeg({
        supabase,
        id: input.playbook.id,
        side: input.side,
        patch: {
          status: "armed",
          clipsFilled: 0,
          lastClipPrice: null,
          lastClipAtMs: null,
          firstFillPrice: null,
          breakevenDone: false,
        },
      });
      if (!patched.ok) {
        return { acted: false };
      }
    } else {
      const reset = await resetDcaLeg({
        supabase,
        id: input.playbook.id,
        side: input.side,
      });
      if (!reset.ok) {
        return { acted: false };
      }
    }
    await writeEventLog({
      scope: "trade",
      event: "dca.closed",
      message: dcaStartListens(input.playbook.startKind)
        ? `${input.playbook.name} position closed. Waiting for the next start.`
        : `${input.playbook.name} position closed. Playbook is idle.`,
      userId: input.playbook.userId,
      accountId: input.playbook.accountId,
      strategy: FUTURES_STRATEGY_ID,
      data: { playbookId: input.playbook.id, side: input.side },
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
  });
  if (!closed.ok) {
    await writeEventLog({
      level: "warning",
      scope: "trade",
      event: "engine.open_failed",
      message: closed.error,
      userId: input.playbook.userId,
      accountId: input.playbook.accountId,
      strategy: FUTURES_STRATEGY_ID,
      data: {
        playbookId: input.playbook.id,
        side: input.side,
        reason: input.action.reason,
      },
    });
    return { acted: false };
  }
  await resetDcaLeg({
    supabase,
    id: input.playbook.id,
    side: input.side,
  });
  await writeEventLog({
    scope: "trade",
    event: "dca.closed",
    message:
      input.action.reason === "take_profit"
        ? `${input.playbook.name} hit take profit.`
        : `${input.playbook.name} hit stop loss.`,
    userId: input.playbook.userId,
    accountId: input.playbook.accountId,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      playbookId: input.playbook.id,
      side: input.side,
      reason: input.action.reason,
    },
  });
  return { acted: true };
}
