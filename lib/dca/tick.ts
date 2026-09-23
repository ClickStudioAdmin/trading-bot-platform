import {
  deskAllowsDcaPlaybooks,
  parseDeskQuery,
  parseDeskType,
  type TradingAccountMode,
} from "@/lib/accounts/model";
import {
  isBybitAgreementQuiet,
  isBybitAgreementReject,
} from "@/lib/exchanges/agreement";
import {
  fetchBybitTickers,
  type BybitTicker,
} from "@/lib/exchanges/bybit/client";
import { ENGINE_LEASE_HEARTBEAT_MS, ENGINE_LEASE_TTL_SECONDS } from "@/lib/engine/lease";
import {
  releaseEngineDesk,
  renewEngineDesk,
  tryClaimEngineDesk,
} from "@/lib/engine/lease-store";
import { mapPool } from "@/lib/engine/pool";
import {
  ensureBybitLinearTickerStream,
  noteBybitTickerSymbols,
  readBybitLinearTickerMap,
  waitForBybitTicker,
} from "@/lib/exchanges/bybit/ticker-stream";
import { warmLinearPerpInstruments } from "@/lib/exchanges/bybit/perp";
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
} from "@/lib/futures/list";
import { parseFuturesPositionRow } from "@/lib/futures/model";
import type { FuturesWorkingOrder } from "@/lib/futures/working";
import { FUTURES_LIVE_POSITION_STATUSES } from "@/lib/futures/pending-close";
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
  isDcaClipKey,
  dcaLegFor,
  dcaLegIsRunning,
  dcaLiveQtyBlocksCycleEnd,
  dcaNeedsAtrBars,
  dcaNeedsTickBars,
  dcaTickBarTimeframes,
  dcaOpenExitLimits,
  dcaPriceExitReason,
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
  type DcaSyncCache,
} from "./run";
import { loadAccountDcaSyncFailures } from "./sync-failure-store";
import {
  DCA_TICK_ENTRY_RANK,
  DCA_TICK_LANE_CONCURRENCY,
  DCA_TICK_PRICE_CONCURRENCY,
  dcaTickWorkRank,
  groupDcaTickSymbols,
  orderDcaTickWork,
  type DcaTickWorkKind,
} from "./tick-order";
import {
  listDcaPlaybooks,
  listDcaPlaybooksForAccount,
  patchDcaLeg,
  patchDcaPlaybook,
  resetDcaLeg,
} from "./store";

const entryCursorByAccount = new Map<string, number>();
let livePriceExits: (() => Promise<void>) | null = null;
let liveAccountId: string | null = null;

export async function runDcaPlaybookTick(input?: {
  accountId?: string;
  tickers?: Map<string, BybitTicker>;
  onYield?: () => Promise<void>;
  onBeforeEntries?: () => Promise<void>;
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
      .in("status", [...FUTURES_LIVE_POSITION_STATUSES])
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
  const bybitDesk = [...accounts.values()].some((row) => row.venue === "bybit");
  if (bybitDesk) {
    noteBybitTickerSymbols(playbooks.map((row) => row.symbol));
    ensureBybitLinearTickerStream();
  }
  const instrumentsReady = bybitDesk
    ? warmLinearPerpInstruments().catch((error: unknown) => {
        console.error(
          "engine instruments",
          error instanceof Error ? error.message : error,
        );
      })
    : Promise.resolve();
  const workingBooks = new Map<
    string,
    { live: FuturesWorkingOrder[]; history: FuturesWorkingOrder[] }
  >();
  const failureBooks = new Map<
    string,
    Awaited<ReturnType<typeof loadAccountDcaSyncFailures>>
  >();
  await Promise.all([
    instrumentsReady,
    ...accountIds.map(async (accountId) => {
      const account = accounts.get(accountId);
      if (!account) {
        return;
      }
      const [rows, failures] = await Promise.all([
        loadFuturesWorking(
          { accountId, userId: account.userId },
          ["open", "filled", "cancelling"],
        ),
        loadAccountDcaSyncFailures(accountId),
      ]);
      workingBooks.set(accountId, {
        live: rows.filter(
          (row) => row.status === "open" || row.status === "cancelling",
        ),
        history: rows.filter(
          (row) => row.status === "open" || row.status === "filled",
        ),
      });
      failureBooks.set(accountId, failures);
    }),
  ]);
  const barJobs: {
    venue: string;
    venueEnvironment: string | null;
    symbol: string;
    interval: DcaIndicatorTimeframe;
    limit: number;
  }[] = [];
  const seenBars = new Set<string>();
  for (const playbook of playbooks) {
    const account = accounts.get(playbook.accountId);
    if (!account || !dcaNeedsTickBars(playbook)) {
      continue;
    }
    const wide =
      playbook.indicatorKind === "supertrend" ||
      playbook.shortIndicatorKind === "supertrend" ||
      dcaNeedsAtrBars(playbook) ||
      dcaPlaybookFilterNeedsWideBars(playbook);
    for (const interval of dcaTickBarTimeframes(playbook)) {
      const key = `${account.venue}:${playbook.symbol}:${interval}`;
      if (seenBars.has(key)) {
        continue;
      }
      seenBars.add(key);
      barJobs.push({
        venue: account.venue,
        venueEnvironment: account.venueEnvironment,
        symbol: playbook.symbol,
        interval,
        limit: wide ? 500 : 80,
      });
    }
  }
  const barsReady = mapPool(barJobs, 8, async (job) => {
    const key = `${job.venue}:${job.symbol}:${job.interval}`;
    const fetched = await loadDeskIndicatorBars({
      venue: job.venue,
      venueEnvironment: job.venueEnvironment,
      symbol: job.symbol,
      interval: job.interval,
      limit: job.limit,
    }).catch((error: unknown) => {
      console.error(
        "engine indicator bars",
        job.symbol,
        job.interval,
        error instanceof Error ? error.message : error,
      );
      return [] as CandleBar[];
    });
    klineCache.set(key, fetched);
  });

  type TickWork = {
    rank: number;
    kind: DcaTickWorkKind;
    playbook: DcaPlaybook;
    mode: TradingAccountMode;
    side: FuturesSide;
    lastPrice: number | null;
    atr: number | null;
    clipsFilled: number;
    positionId: string | null;
    entryPrice: number | null;
    mark: number | null;
    tpLimitResting: boolean;
    keepListening: boolean;
    flattenReason: string;
    action: ReturnType<typeof decideDcaTick>["action"] | null;
    why: string;
    cache: DcaSyncCache;
  };
  const work: TickWork[] = [];
  const flagWrites: {
    id: string;
    patch: {
      armConditionTrue?: boolean;
      disarmConditionTrue?: boolean;
      longIndicatorTrue?: boolean;
      shortIndicatorTrue?: boolean;
    };
  }[] = [];

  let acted = 0;
  const rushed = new Set<string>();
  const failedFlags = new Set<string>();
  let flagsFlushed = false;
  let lastHeartbeat = 0;
  async function heartbeat(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - lastHeartbeat < ENGINE_LEASE_HEARTBEAT_MS) {
      return;
    }
    lastHeartbeat = now;
    await input?.onYield?.();
  }
  async function runTickItem(item: TickWork): Promise<void> {
    if (
      (item.kind === "arm" || item.kind === "clip") &&
      failedFlags.has(item.playbook.id)
    ) {
      return;
    }
    if (
      item.action &&
      item.action.kind !== "none" &&
      item.action.kind !== "end_cycle"
    ) {
      await logDcaEvent({
        playbook: item.playbook,
        side: item.side,
        positionId: item.positionId,
        event: "dca.decision",
        message: dcaDecisionMessage({
          name: item.playbook.name,
          kind: item.action.kind,
          reason: "reason" in item.action ? item.action.reason : null,
          clipsFilled: item.clipsFilled,
          maxClips: item.playbook.maxClips,
          why: item.why,
        }),
        data: {
          kind: item.action.kind,
          reason: "reason" in item.action ? item.action.reason : null,
          clipsFilled: item.clipsFilled,
          maxClips: item.playbook.maxClips,
          mark: item.mark,
          last: item.lastPrice,
          entryPrice: item.entryPrice,
          tpLimitResting: item.tpLimitResting,
          ...(item.why ? { why: item.why } : {}),
        },
      });
    }
    if (item.kind === "flatten") {
      const flattened = await flattenPlaybook({
        playbook: item.playbook,
        mode: item.mode,
        side: item.side,
        reason: item.flattenReason,
      });
      if (!flattened.ok) {
        return;
      }
      if (item.keepListening) {
        const kept = await keepListeningAfterFlatten({
          playbook: item.playbook,
          side: item.side,
        });
        if (kept.ok) {
          acted += 1;
        }
      } else {
        acted += 1;
      }
      return;
    }
    if (item.kind === "sync") {
      await syncDcaPlaybookExits({
        playbook: item.playbook,
        mode: item.mode,
        side: item.side,
        lastPrice: item.lastPrice,
        atr: item.atr,
        cache: item.cache,
      });
      await syncDcaPlaybookGrid({
        playbook: item.playbook,
        mode: item.mode,
        side: item.side,
        atr: item.atr,
        cache: item.cache,
      });
      return;
    }
    if (!item.action) {
      return;
    }
    const result = await applyTickAction({
      playbook: item.playbook,
      mode: item.mode,
      side: item.side,
      lastPrice: item.lastPrice,
      action: item.action,
      why: item.why,
      positionId: item.positionId,
      fast: item.kind === "close" && Boolean(item.positionId),
    });
    if (result.acted) {
      acted += 1;
    }
  }
  async function runLane(items: TickWork[], concurrency: number): Promise<void> {
    const chains = groupDcaTickSymbols(
      items.map((item) => ({ ...item, symbol: item.playbook.symbol })),
    );
    await mapPool(chains, concurrency, async (chain) => {
      for (const item of chain) {
        await heartbeat();
        await runTickItem(item);
      }
    });
  }
  const streamTickers = readBybitLinearTickerMap();
  async function runPriceExits(): Promise<void> {
  const priceWork: TickWork[] = [];
  for (const playbook of playbooks) {
    const account = accounts.get(playbook.accountId);
    if (!account || !deskAllowsDcaPlaybooks(account)) {
      continue;
    }
    const ticker =
      streamTickers.get(playbook.symbol) ?? tickers.get(playbook.symbol) ?? {};
    const prices = tickerTriggerPrices(ticker);
    const book = workingBooks.get(playbook.accountId) ?? {
      live: [],
      history: [],
    };
    const syncCache: DcaSyncCache = {
      opens,
      liveWorking: book.live,
      gridWorking: book.history,
      recentFailures:
        failureBooks.get(playbook.accountId)?.get(playbook.id) ?? [],
    };
    for (const side of dcaEnabledSides(playbook.direction)) {
      const leg = dcaLegFor(playbook, side);
      if (leg.status === "idle" || leg.status === "closing") {
        continue;
      }
      const open = opens.find(
        (row) =>
          row.accountId === playbook.accountId &&
          row.symbol === playbook.symbol &&
          row.side === side,
      );
      if (!open || !(open.qty > 0)) {
        continue;
      }
      const tpLimitResting =
        dcaOpenExitLimits(book.live, playbook.id, side, "tp").length > 0;
      const reason = dcaPriceExitReason({
        side,
        qty: open.qty,
        entryPrice: open.entryPrice,
        firstFillPrice: leg.firstFillPrice,
        mark: prices.mark,
        stopLossPct: playbook.stopLossPct,
        stopLossBasis: playbook.stopLossBasis,
        takeProfitPct: playbook.takeProfitPct,
        takeProfitBasis: playbook.takeProfitBasis,
        takeProfitKind: playbook.takeProfitKind,
        takeProfitOrderType: playbook.takeProfitOrderType,
        tpLimitResting,
      });
      if (!reason) {
        continue;
      }
      const rushKey = `${playbook.id}:${side}`;
      if (rushed.has(rushKey)) {
        continue;
      }
      rushed.add(rushKey);
      open.qty = 0;
      priceWork.push({
        rank: dcaTickWorkRank("close"),
        kind: "close",
        playbook,
        mode: account.mode,
        side,
        lastPrice: prices.last,
        atr: null,
        clipsFilled: leg.clipsFilled,
        positionId: open.id,
        entryPrice: open.entryPrice,
        mark: prices.mark,
        tpLimitResting,
        keepListening: false,
        flattenReason: "",
        action: { kind: "close", reason },
        why: "",
        cache: syncCache,
      });
    }
  }
  if (priceWork.length > 0) {
    await heartbeat(true);
    await runLane(priceWork, DCA_TICK_PRICE_CONCURRENCY);
  }
  }
  livePriceExits = runPriceExits;
  liveAccountId = input?.accountId ?? playbooks[0]?.accountId ?? null;
  await runPriceExits();
  let signalDone = false;
  const priceLoop = (async () => {
    while (!signalDone) {
      await waitForBybitTicker(1_000);
      if (signalDone) {
        return;
      }
      await runPriceExits();
    }
  })();
  try {
  await barsReady;
  for (const playbook of playbooks) {
    const listening = dcaEnabledSides(playbook.direction).some((side) => {
      const status = dcaLegFor(playbook, side).status;
      return (
        status === "armed" || status === "stop_adding" || status === "closing"
      );
    });
    const symbolOpen = opens.some(
      (row) =>
        row.accountId === playbook.accountId &&
        row.symbol === playbook.symbol &&
        row.qty > 0,
    );
    if (!listening && !symbolOpen) {
      continue;
    }
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
    const book = workingBooks.get(playbook.accountId) ?? {
      live: [],
      history: [],
    };
    const working = book.history;
    const openWorking = book.live;
    const syncCache: DcaSyncCache = {
      opens,
      liveWorking: book.live,
      gridWorking: book.history,
      recentFailures:
        failureBooks.get(playbook.accountId)?.get(playbook.id) ?? [],
    };
    for (const side of dcaEnabledSides(playbook.direction)) {
      if (rushed.has(`${playbook.id}:${side}`)) {
        continue;
      }
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
      if (leg.status === "closing" || open?.status === "closing") {
        work.push({
          rank: dcaTickWorkRank("flatten"),
          kind: "flatten",
          playbook,
          mode: account.mode,
          side,
          lastPrice: prices.last,
          atr,
          clipsFilled: leg.clipsFilled,
          positionId: open?.id ?? null,
          entryPrice: open?.entryPrice ?? null,
          mark: prices.mark,
          tpLimitResting: false,
          keepListening: leg.status === "closing",
          flattenReason:
            leg.status === "closing" ? "Close requested." : "Close All requested.",
          action: null,
          why: "",
          cache: syncCache,
        });
        continue;
      }
      if (
        dcaShouldFlattenIdleOpen({
          status: leg.status,
          positionQty: open?.qty ?? null,
        })
      ) {
        work.push({
          rank: dcaTickWorkRank("flatten"),
          kind: "flatten",
          playbook,
          mode: account.mode,
          side,
          lastPrice: prices.last,
          atr,
          clipsFilled: leg.clipsFilled,
          positionId: open?.id ?? null,
          entryPrice: open?.entryPrice ?? null,
          mark: prices.mark,
          tpLimitResting: false,
          keepListening: false,
          flattenReason: "Bot is disabled.",
          action: null,
          why: "",
          cache: syncCache,
        });
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
      const flagPatch: (typeof flagWrites)[number]["patch"] = {};
      if (decision.nextArmTrue !== playbook.armConditionTrue) {
        flagPatch.armConditionTrue = decision.nextArmTrue;
        playbook.armConditionTrue = decision.nextArmTrue;
      }
      if (decision.nextDisarmTrue !== playbook.disarmConditionTrue) {
        flagPatch.disarmConditionTrue = decision.nextDisarmTrue;
        playbook.disarmConditionTrue = decision.nextDisarmTrue;
      }
      if (
        side === "long" &&
        decision.nextIndicatorTrue !== playbook.longIndicatorTrue
      ) {
        flagPatch.longIndicatorTrue = decision.nextIndicatorTrue;
        playbook.longIndicatorTrue = decision.nextIndicatorTrue;
      }
      if (
        side === "short" &&
        decision.nextIndicatorTrue !== playbook.shortIndicatorTrue
      ) {
        flagPatch.shortIndicatorTrue = decision.nextIndicatorTrue;
        playbook.shortIndicatorTrue = decision.nextIndicatorTrue;
      }
      if (Object.keys(flagPatch).length > 0) {
        const existing = flagWrites.find((row) => row.id === playbook.id);
        if (existing) {
          Object.assign(existing.patch, flagPatch);
        } else {
          flagWrites.push({ id: playbook.id, patch: flagPatch });
        }
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
      const closingNow = decision.action.kind === "close";
      const needsSync =
        !closingNow &&
        (Boolean(open) ||
          (playbook.dcaMode === "order" &&
            (dcaLegIsRunning(leg.status) ||
              working.some(
                (row) =>
                  (row.status === "open" || row.status === "cancelling") &&
                  isDcaClipKey(row.idempotencyKey, playbook.id, side),
              ))));
      if (needsSync) {
        work.push({
          rank: dcaTickWorkRank("sync"),
          kind: "sync",
          playbook,
          mode: account.mode,
          side,
          lastPrice: prices.last,
          atr,
          clipsFilled: leg.clipsFilled,
          positionId: open?.id ?? null,
          entryPrice: open?.entryPrice ?? null,
          mark: prices.mark,
          tpLimitResting: false,
          keepListening: false,
          flattenReason: "",
          action: null,
          why: "",
          cache: syncCache,
        });
      }
      if (decision.action.kind !== "none") {
        const kind: DcaTickWorkKind =
          decision.action.kind === "close"
            ? "close"
            : decision.action.kind === "breakeven"
              ? "breakeven"
              : decision.action.kind === "disarm"
                ? "disarm"
                : decision.action.kind === "stop_adding"
                  ? "stop_adding"
                  : decision.action.kind === "end_cycle"
                    ? "end_cycle"
                    : decision.action.kind === "clip"
                      ? "clip"
                      : "arm";
        work.push({
          rank: dcaTickWorkRank(kind),
          kind,
          playbook,
          mode: account.mode,
          side,
          lastPrice: prices.last,
          atr,
          clipsFilled: leg.clipsFilled,
          positionId: open?.id ?? null,
          entryPrice: open?.entryPrice ?? null,
          mark: prices.mark,
          tpLimitResting,
          keepListening: false,
          flattenReason: "",
          action: decision.action,
          why,
          cache: syncCache,
        });
      }
    }
  }

  const cursorKey = input?.accountId ?? "all";
  const planned = orderDcaTickWork(
    work,
    undefined,
    entryCursorByAccount.get(cursorKey) ?? 0,
  );
  entryCursorByAccount.set(cursorKey, planned.nextEntryOffset);
  const ordered = planned.items;
  async function flushFlags(): Promise<void> {
    if (flagsFlushed) {
      return;
    }
    flagsFlushed = true;
    if (!supabase) {
      return;
    }
    const client = supabase;
    await mapPool(flagWrites, 8, async (row) => {
      const saved = await patchDcaPlaybook({
        supabase: client,
        id: row.id,
        patch: row.patch,
      });
      if (!saved.ok) {
        failedFlags.add(row.id);
      }
    });
  }
  let index = 0;
  while (index < ordered.length && (ordered[index]?.rank ?? 0) < DCA_TICK_ENTRY_RANK) {
    const rank = ordered[index]?.rank ?? 0;
    const batch: TickWork[] = [];
    while (index < ordered.length && ordered[index]?.rank === rank) {
      const row = ordered[index];
      if (row) {
        batch.push(row);
      }
      index += 1;
    }
    await runLane(batch, DCA_TICK_LANE_CONCURRENCY);
  }
  await flushFlags();
  await heartbeat(true);
  await input?.onBeforeEntries?.();
  while (index < ordered.length) {
    const rank = ordered[index]?.rank ?? 0;
    const batch: TickWork[] = [];
    while (index < ordered.length && ordered[index]?.rank === rank) {
      const row = ordered[index];
      if (row) {
        batch.push(row);
      }
      index += 1;
    }
    await runLane(batch, 1);
  }
  await flushFlags();
  return { acted };
  } finally {
    signalDone = true;
    await priceLoop;
  }
}

export async function watchDcaPriceExits(input: {
  maxMs: number;
  workerId: string;
}): Promise<void> {
  const run = livePriceExits;
  const accountId = liveAccountId;
  if (!run || !accountId || input.maxMs <= 0) {
    return;
  }
  const claim = await tryClaimEngineDesk({
    accountId,
    workerId: input.workerId,
    ttlSeconds: ENGINE_LEASE_TTL_SECONDS,
  });
  if (claim === "busy") {
    return;
  }
  const started = Date.now();
  try {
    while (Date.now() - started < input.maxMs) {
      await renewEngineDesk({ accountId, workerId: input.workerId });
      await run();
      const left = input.maxMs - (Date.now() - started);
      if (left <= 0) {
        break;
      }
      await waitForBybitTicker(Math.min(1_000, left));
    }
  } finally {
    if (claim === "acquired") {
      await releaseEngineDesk({ accountId, workerId: input.workerId });
    }
  }
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

async function stopBotForAgreement(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
  error: string;
}): Promise<boolean> {
  if (
    !isBybitAgreementQuiet(input.error) &&
    !isBybitAgreementReject(input.error)
  ) {
    return false;
  }
  await applyDcaVerb({
    playbook: input.playbook,
    mode: input.mode,
    verb: "disarm",
    side: input.side,
  });
  return true;
}

async function applyTickAction(input: {
  playbook: DcaPlaybook;
  mode: TradingAccountMode;
  side: FuturesSide;
  lastPrice: number | null;
  action: ReturnType<typeof decideDcaTick>["action"];
  why?: string;
  positionId?: string | null;
  fast?: boolean;
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
      if (
        await stopBotForAgreement({
          playbook: input.playbook,
          mode: input.mode,
          side: input.side,
          error: armed.error,
        })
      ) {
        if (!isBybitAgreementQuiet(armed.error)) {
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
        return { acted: false };
      }
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
      if (
        await stopBotForAgreement({
          playbook: input.playbook,
          mode: input.mode,
          side: input.side,
          error: placed.error,
        })
      ) {
        if (!isBybitAgreementQuiet(placed.error)) {
          const why = String(input.why ?? "").trim();
          await logDcaEvent({
            playbook: input.playbook,
            side: input.side,
            level: "warning",
            event: "engine.open_failed",
            message: why ? `${placed.error} Trying: ${why}.` : placed.error,
            data: { reason: "clip", ...(why ? { why } : {}) },
          });
        }
        return { acted: false };
      }
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
    positionId: input.positionId,
    fast: input.fast,
  });
  if (!closed.ok) {
    if (isBybitAgreementQuiet(closed.error)) {
      return { acted: false };
    }
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

