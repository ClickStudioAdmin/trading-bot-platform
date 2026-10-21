import {
  decideDcaTick,
  dcaArmTriggerForSide,
  dcaRetraceForReason,
  dcaStartKindForSide,
  dcaAtrTimeframe,
  dcaClassicForSide,
  dcaClipForSide,
  dcaCycleClipSize,
  dcaEnabledSides,
  dcaIndicatorStartForSide,
  dcaTickValueCapUsdt,
  IDLE_DCA_LEG,
  type DcaLegState,
} from "@/lib/dca/playbook";
import {
  dcaEntryStackForSide,
  dcaEntryTickExtras,
  dcaSideGates,
} from "@/lib/dca/entry-stack";
import {
  exitExpressionMet,
  exitLeafResults,
  exitStackForSide,
  exitStackTimeframes,
  formatExitExpressionText,
} from "@/lib/dca/exit-stack";
import {
  dcaFilterForSide,
  seriesForFilter,
} from "@/lib/dca/filters";
import { hardExitForSide, hardExitMet } from "@/lib/dca/hard-exit";
import { entryStackIsLegacy, entryStackTimeframes } from "@/lib/strategy/expr";
import {
  atrAtEachTapeBar,
  resampleBarsForTimeframe,
  resampleClosesForTimeframe,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import {
  DEFAULT_DCA_ATR_PERIOD,
  dcaClipQtyAt,
  dcaPlannedExits,
  dcaResolvedSafetyPrices,
  dcaTrailingDistance,
} from "@/lib/dca/grid";
import { formatDcaStartReasons } from "@/lib/bots/condition-copy";
import { formatRetraceLabel } from "@/lib/strategy/retrace";
import { canBacktestDcaRecipe } from "./eligibility";
import { dcaRecipeToConfig, type DcaTemplateRecipe } from "@/lib/templates/recipe";
import type { FuturesSide } from "@/lib/futures/model";
import {
  advanceTrailingOnBar,
  armTrailingAt,
  type FuturesTrailing,
} from "@/lib/futures/trailing";
import type { CandleBar } from "@/lib/market/candles";
import {
  backtestLiquidationPrice,
  backtestMarginUsdt,
  emptyBacktestStats,
  finishBacktestStats,
  firstAdverseFill,
  normalizeBacktestLeverage,
  type BacktestFillReason,
  type BacktestStats,
  type SimulatedOrder,
  backtestTapeInterval,
  yieldBacktestReplay,
} from "./model";
import { fillSentence, skippedEntrySentence } from "./events";
import {
  emptyExitRuntime,
  evaluateExitActions,
  reduceOpenLots,
  exitActionTimeframes,
  exitBookForClassic,
  sideExitActions,
  type ExitActionKind,
  type ExitLot,
  type ExitRuntime,
} from "@/lib/strategy/exit-actions";
import type { ReplayEvent } from "./model";
import { filterBecause, indicatorBecause, priceStartBecause } from "./explain";

export { canBacktestDcaRecipe };

function feeUsdt(qty: number, price: number, feeRate: number): number {
  return Math.abs(qty * price) * feeRate;
}

function unrealized(
  side: FuturesSide,
  qty: number,
  entry: number,
  mark: number,
): number {
  return side === "long" ? (mark - entry) * qty : (entry - mark) * qty;
}

type SimLeg = DcaLegState & {
  qty: number;
  entry: number;
  trailing: FuturesTrailing | null;
  slPrice: number | null;
  slQty: number | null;
  armTrue: boolean;
  disarmTrue: boolean;
  indicatorTrue: boolean;
  cycleClipSize: number | null;
};

function emptyLeg(): SimLeg {
  return {
    ...IDLE_DCA_LEG,
    status: "armed",
    qty: 0,
    entry: 0,
    trailing: null,
    slPrice: null,
    slQty: null,
    armTrue: false,
    disarmTrue: false,
    indicatorTrue: false,
    cycleClipSize: null,
  };
}

export async function replayDcaPlaybook(input: {
  bars: CandleBar[];
  recipe: DcaTemplateRecipe;
  feeRate: number;
  startingUsdt: number;
  leverage?: number;
  venue?: string;
  onBar?: (barIndex: number) => void;
}): Promise<{ orders: SimulatedOrder[]; stats: BacktestStats; events: ReplayEvent[] }> {
  const allowed = canBacktestDcaRecipe(input.recipe);
  if (!allowed.ok) {
    return { orders: [], stats: emptyBacktestStats(input.startingUsdt), events: [] };
  }
  const built = dcaRecipeToConfig(input.recipe, {
    venue: input.venue ?? "bybit",
  });
  if (!built.ok) {
    return { orders: [], stats: emptyBacktestStats(input.startingUsdt), events: [] };
  }
  const config = {
    ...built.config,
    startKind: input.recipe.startKind,
    shortStartKind:
      input.recipe.direction === "both"
        ? (input.recipe.shortStartKind ?? input.recipe.startKind)
        : null,
  };
  const sides = dcaEnabledSides(config.direction);
  const splitSides = config.direction === "both";
  const legs: Record<FuturesSide, SimLeg> = {
    long: emptyLeg(),
    short: emptyLeg(),
  };
  const orders: SimulatedOrder[] = [];
  const events: ReplayEvent[] = [];
  let realized = 0;
  let wins = 0;
  let trades = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let peak = input.startingUsdt;
  let maxDrawdown = 0;
  let barsIn = 0;
  let liquidated = false;
  const closes: number[] = [];
  const ohlc: Array<{ high: number; low: number; close: number }> = [];
  const shortAtrPeriod =
    config.direction === "both" && config.shortClassic?.takeProfitKind === "atr"
      ? config.shortClassic.atrPeriod
      : null;
  const needsAtr =
    (config.spacingKind ?? "percent") === "atr" ||
    (config.takeProfitKind ?? "percent") === "atr" ||
    config.shortClassic?.takeProfitKind === "atr";
  const firstBar = input.bars[0];
  const lastBar = input.bars[input.bars.length - 1];
  const tape =
    firstBar && lastBar
      ? backtestTapeInterval(input.recipe, firstBar.timeMs, lastBar.timeMs)
      : dcaAtrTimeframe(config);
  const atrByBar = needsAtr
    ? atrAtEachTapeBar(
        input.bars,
        tape,
        dcaAtrTimeframe(config),
        config.atrPeriod ?? DEFAULT_DCA_ATR_PERIOD,
      )
    : null;
  const shortAtrByBar =
    needsAtr &&
    shortAtrPeriod != null &&
    shortAtrPeriod !== (config.atrPeriod ?? DEFAULT_DCA_ATR_PERIOD)
      ? atrAtEachTapeBar(
          input.bars,
          tape,
          dcaAtrTimeframe(config),
          shortAtrPeriod,
        )
      : null;

  function bookForLeg(side: FuturesSide, atMs: number, mark: number) {
    const leg = legs[side];
    if (!(leg.qty > 0)) {
      return null;
    }
    if (actionsFor(side)) {
      return exitArms[side].book ?? null;
    }
    const classic =
      side === "short" && config.direction === "both" && config.shortClassic
        ? config.shortClassic
        : config;
    return exitBookForClassic({
      side,
      qty: leg.qty,
      entryPrice: leg.entry,
      mark,
      last: mark,
      nowMs: atMs,
      breakevenDone: leg.breakevenDone,
      trailingPeak: leg.trailing?.peak ?? null,
      stopLossPrice: leg.slPrice,
      takeProfitPct: classic.takeProfitPct,
      stopLossPct: leg.slPrice != null ? null : classic.stopLossPct,
      trailingPct: classic.trailingPct,
      trailingTriggerPct: classic.trailingTriggerPct,
      breakevenActivationPct: classic.breakevenActivationPct,
      breakevenOffsetPct: classic.breakevenOffsetPct,
    });
  }

  function remember(
    order: SimulatedOrder,
    because?: string,
  ) {
    const exitBook = bookForLeg(order.side, order.atMs, order.price);
    const orderIndex = orders.length;
    orders.push(order);
    events.push({
      atMs: order.atMs,
      kind: "fill",
      reason: order.reason ?? "close",
      orderIndex,
      side: order.side,
      clipIndex: order.clipIndex,
      text: fillSentence({
        reason: order.reason ?? "close",
        side: order.side,
        price: order.price,
        clipIndex: order.clipIndex,
        because,
      }),
      ...(exitBook ? { exitBook } : {}),
    });
  }

  const exitLots: Record<FuturesSide, ExitLot[]> = { long: [], short: [] };
  const exitArms: Record<FuturesSide, ExitRuntime> = {
    long: emptyExitRuntime(),
    short: emptyExitRuntime(),
  };
  function actionsFor(side: FuturesSide) {
    return sideExitActions(
      config.exitActions,
      config.shortExitActions,
      config.direction,
      side,
    );
  }
  function claimFillReason(kind: ExitActionKind): BacktestFillReason {
    if (kind === "stop_loss" || kind === "breakeven") {
      return "stop";
    }
    if (kind === "trailing_stop") {
      return "trailing";
    }
    if (kind === "close") {
      return "exit_if";
    }
    return "take_profit";
  }

  function flatten(
    side: FuturesSide,
    atMs: number,
    fill: number,
    rearm: boolean,
    reason: BacktestFillReason,
    because?: string,
  ) {
    const leg = legs[side];
    if (!(leg.qty > 0)) {
      legs[side] = rearm ? emptyLeg() : { ...emptyLeg(), status: "idle" };
      return;
    }
    const fee = feeUsdt(leg.qty, fill, input.feeRate);
    const pnl = unrealized(side, leg.qty, leg.entry, fill) - fee;
    realized += pnl;
    trades += 1;
    if (pnl > 0) {
      wins += 1;
      grossWin += pnl;
    } else {
      grossLoss += Math.abs(pnl);
    }
    remember(
      {
        atMs,
        action: "flatten",
        side,
        qty: leg.qty,
        price: fill,
        feeUsdt: fee,
        realizedUsdt: pnl,
        reason,
      },
      because,
    );
    legs[side] = rearm ? emptyLeg() : { ...emptyLeg(), status: "idle" };
    exitLots[side] = [];
    exitArms[side] = emptyExitRuntime();
  }

  function reduceLeg(
    side: FuturesSide,
    atMs: number,
    fill: number,
    qty: number,
    reason: BacktestFillReason,
  ) {
    const leg = legs[side];
    const take = Math.min(leg.qty, qty);
    if (!(take > 0) || take + 1e-8 >= leg.qty) {
      flatten(side, atMs, fill, true, reason);
      return;
    }
    const fee = feeUsdt(take, fill, input.feeRate);
    const pnl = unrealized(side, take, leg.entry, fill) - fee;
    realized += pnl;
    trades += 1;
    if (pnl > 0) {
      wins += 1;
      grossWin += pnl;
    } else {
      grossLoss += Math.abs(pnl);
    }
    remember(
      {
        atMs,
        action: "flatten",
        side,
        qty: take,
        price: fill,
        feeUsdt: fee,
        realizedUsdt: pnl,
        reason,
      },
    );
    legs[side] = { ...leg, qty: leg.qty - take, slPrice: null, slQty: null };
    exitLots[side] = reduceOpenLots(exitLots[side], take);
  }

  function cashUsdt() {
    return input.startingUsdt + realized;
  }

  function wipeAccount(
    atMs: number,
    triggerSide: FuturesSide,
    fill: number,
    mark: number,
  ) {
    for (const side of sides) {
      const leg = legs[side];
      if (!(leg.qty > 0)) {
        continue;
      }
      const price = side === triggerSide ? fill : mark;
      flatten(side, atMs, price, false, "liquidation");
    }
    liquidated = true;
  }

  function adverseExit(
    side: FuturesSide,
    adverse: number,
    extra: Array<{ price: number; reason: BacktestFillReason } | null>,
  ): { price: number; reason: BacktestFillReason } | null {
    const leg = legs[side];
    const liq = backtestLiquidationPrice({
      side,
      entry: leg.entry,
      qty: leg.qty,
      cashUsdt: cashUsdt(),
      feeRate: input.feeRate,
    });
    return firstAdverseFill(side, adverse, [
      ...extra,
      liq != null ? { price: liq, reason: "liquidation" } : null,
    ]);
  }

  function addClip(
    side: FuturesSide,
    atMs: number,
    price: number,
    because?: string,
  ) {
    const leg = legs[side];
    const firstClip = leg.clipsFilled === 0;
    const leverage = normalizeBacktestLeverage(input.leverage);
    const sideClip = dcaClipForSide(config, side);
    const sized = firstClip
      ? dcaCycleClipSize({
          kind: config.maxValueKind,
          maxValue: config.maxValue,
          maxClips: config.maxClips,
          clipSize: sideClip.clipSize,
          sizeMultiplier: config.sizeMultiplier,
          sizeUnit: sideClip.sizeUnit,
          bookUsdt: input.startingUsdt + realized,
          leverage,
          mark: price,
        })
      : {
          clipSize: leg.cycleClipSize ?? sideClip.clipSize,
          cycleMaxValue: leg.cycleMaxValue,
        };
    const qty = dcaClipQtyAt(
      leg.clipsFilled,
      sized.clipSize,
      config.sizeMultiplier,
      sideClip.sizeUnit,
      price,
    );
    if (!(qty > 0)) {
      return;
    }
    const fee = feeUsdt(qty, price, input.feeRate);
    const locked = Object.values(legs).reduce(
      (sum, row) => sum + backtestMarginUsdt(row.qty * row.entry, leverage),
      0,
    );
    const available = input.startingUsdt + realized - locked;
    if (backtestMarginUsdt(qty * price, leverage) + fee > available) {
      if (firstClip) {
        events.push({
          atMs,
          kind: "skipped",
          reason: "entry",
          orderIndex: null,
          side,
          clipIndex: 1,
          text: skippedEntrySentence(side, because),
        });
      }
      return;
    }
    realized -= fee;
    const action = side === "short" ? "sell" : "buy";
    const clipIndex = leg.clipsFilled + 1;
    remember(
      {
        atMs,
        action,
        side,
        qty,
        price,
        feeUsdt: fee,
        realizedUsdt: -fee,
        reason: firstClip ? "entry" : "clip",
        clipIndex,
      },
      firstClip ? because : undefined,
    );
    const nextQty = leg.qty + qty;
    const entry =
      nextQty > 0 ? (leg.entry * leg.qty + price * qty) / nextQty : price;
    let trailing = leg.trailing;
    const classic = dcaClassicForSide(config, side);
    const sideActions = actionsFor(side);
    if (sideActions) {
      exitLots[side].push({ id: `${side}-${clipIndex}-${atMs}`, qty, price });
      trailing = null;
    } else if (classic.trailingPct != null && classic.trailingPct > 0) {
      const distance = dcaTrailingDistance(price, classic.trailingPct);
      trailing = armTrailingAt(
        {
          distance,
          activePrice:
            classic.trailingTriggerPct == null
              ? null
              : side === "long"
                ? price * (1 + classic.trailingTriggerPct / 100)
                : price * (1 - classic.trailingTriggerPct / 100),
          peak: null,
        },
        price,
      );
    }
    legs[side] = {
      ...leg,
      status: "armed",
      clipsFilled: leg.clipsFilled + 1,
      lastClipPrice: price,
      lastClipAtMs: atMs,
      firstFillPrice: leg.firstFillPrice ?? price,
      cycleMaxValue: sized.cycleMaxValue,
      cycleClipSize: sized.clipSize,
      qty: nextQty,
      entry,
      trailing,
    };
  }

  function currentAtr(): number | null {
    if (atrByBar == null || ohlc.length === 0) {
      return null;
    }
    return atrByBar[ohlc.length - 1] ?? null;
  }

  function atrForSide(side: FuturesSide): number | null {
    const classic = dcaClassicForSide(config, side);
    if (
      side === "short" &&
      classic.takeProfitKind === "atr" &&
      shortAtrByBar &&
      ohlc.length > 0
    ) {
      return shortAtrByBar[ohlc.length - 1] ?? null;
    }
    return currentAtr();
  }

  function nextRestingGridPrice(side: FuturesSide): number | null {
    const leg = legs[side];
    if (
      config.dcaMode !== "order" ||
      leg.status !== "armed" ||
      !(leg.qty > 0) ||
      !(leg.entry > 0) ||
      config.maxClips == null ||
      config.maxClips < 2 ||
      leg.clipsFilled >= config.maxClips
    ) {
      return null;
    }
    const prices = dcaResolvedSafetyPrices({
      side,
      entryPrice: leg.entry,
      maxClips: config.maxClips,
      spacingKind: config.spacingKind,
      dipPct: config.dipPct,
      atr: currentAtr(),
      atrSpacingMult: config.atrSpacingMult,
      deviationMultiplier: config.deviationMultiplier,
    });
    const limit = prices[leg.clipsFilled - 1];
    return limit != null && limit > 0 ? limit : null;
  }

  function fillRestingGrid(side: FuturesSide, bar: CandleBar) {
    const adverse = side === "long" ? bar.low : bar.high;
    while (true) {
      const limit = nextRestingGridPrice(side);
      if (limit == null) {
        return;
      }
      const hit =
        side === "long" ? adverse <= limit : adverse >= limit;
      if (!hit) {
        return;
      }
      const before = legs[side].clipsFilled;
      addClip(side, bar.timeMs, limit);
      if (legs[side].clipsFilled === before) {
        return;
      }
    }
  }

  function limitTakeProfitPrice(side: FuturesSide, bar: CandleBar): number | null {
    const classic = dcaClassicForSide(config, side);
    if (classic.takeProfitOrderType !== "limit") {
      return null;
    }
    const live = legs[side];
    if (!(live.qty > 0)) {
      return null;
    }
    const planned = dcaPlannedExits({
      side,
      entryPrice: live.entry,
      firstFillPrice: live.firstFillPrice,
      mark: live.entry,
      takeProfitPct: classic.takeProfitPct,
      stopLossPct: classic.stopLossPct,
      takeProfitBasis: classic.takeProfitBasis,
      stopLossBasis: classic.stopLossBasis,
      trailingPct: classic.trailingPct,
      takeProfitKind: classic.takeProfitKind,
      atr: atrForSide(side),
      takeProfitAtrMult: classic.takeProfitAtrMult,
    });
    if (planned.takeProfit == null) {
      return null;
    }
    const favorable = side === "long" ? bar.high : bar.low;
    const hit =
      side === "long"
        ? favorable >= planned.takeProfit
        : favorable <= planned.takeProfit;
    return hit ? planned.takeProfit : null;
  }

  let barIndex = 0;
  for (const bar of input.bars) {
    barIndex += 1;
    await yieldBacktestReplay(barIndex);
    input.onBar?.(barIndex);
    const price = bar.close;
    if (!(price > 0)) {
      continue;
    }
    if (liquidated) {
      if (0 < peak) {
        const drawdown = peak;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
      continue;
    }
    closes.push(price);
    ohlc.push({ high: bar.high, low: bar.low, close: bar.close });
    const window = closes.slice(-80);
    const barWindow = ohlc.slice(-80);
    const triggerPrices = { last: price, mark: price, index: price };
    let held = false;
    let closedThisBar = false;
    let startedThisBar = false;
    for (const side of sides) {
      if (liquidated) {
        break;
      }
      const leg = legs[side];
      if (leg.qty > 0) {
        held = true;
        const adverse = side === "long" ? bar.low : bar.high;
        const exitClassic = dcaClassicForSide(config, side);
        const actionBook = actionsFor(side);
        const plannedStop =
          actionBook
            ? null
            : exitClassic.stopLossPct != null && exitClassic.stopLossPct > 0
            ? dcaPlannedExits({
                side,
                entryPrice: leg.entry,
                firstFillPrice: leg.firstFillPrice,
                mark: price,
                takeProfitPct: exitClassic.takeProfitPct,
                stopLossPct: exitClassic.stopLossPct,
                takeProfitBasis: exitClassic.takeProfitBasis,
                stopLossBasis: exitClassic.stopLossBasis,
                trailingPct: exitClassic.trailingPct,
                takeProfitKind: exitClassic.takeProfitKind,
                atr: atrForSide(side),
                takeProfitAtrMult: exitClassic.takeProfitAtrMult,
              }).stopLoss
            : null;
        const firstHit = adverseExit(side, adverse, [
          leg.slPrice != null ? { price: leg.slPrice, reason: "stop" } : null,
          plannedStop != null ? { price: plannedStop, reason: "stop" } : null,
        ]);
        if (firstHit) {
          if (firstHit.reason === "liquidation") {
            wipeAccount(bar.timeMs, side, firstHit.price, price);
          } else if (
            firstHit.reason === "stop" &&
            leg.slQty != null &&
            leg.slQty > 0 &&
            leg.slQty + 1e-8 < leg.qty
          ) {
            reduceLeg(side, bar.timeMs, firstHit.price, leg.slQty, "stop");
          } else {
            flatten(side, bar.timeMs, firstHit.price, true, firstHit.reason);
          }
          closedThisBar = true;
          continue;
        }
        if (!actionBook && leg.trailing) {
          const trail = advanceTrailingOnBar({
            side,
            trailing: leg.trailing,
            favorable: side === "long" ? bar.high : bar.low,
            adverse,
          });
          legs[side] = { ...leg, trailing: { ...leg.trailing, peak: trail.peak } };
          if (trail.hit && trail.fillPrice != null) {
            flatten(side, bar.timeMs, trail.fillPrice, true, "trailing");
            closedThisBar = true;
            continue;
          }
        }
        fillRestingGrid(side, bar);
        if (liquidated) {
          continue;
        }
        const afterGrid = legs[side];
        if (afterGrid.qty > 0) {
          const gridLiq = adverseExit(side, adverse, []);
          if (gridLiq?.reason === "liquidation") {
            wipeAccount(bar.timeMs, side, gridLiq.price, price);
            continue;
          }
        }
        const limitTp = actionsFor(side) ? null : limitTakeProfitPrice(side, bar);
        if (limitTp != null) {
          const exitNow = hardExitForSide(config, side);
          const exitStackNow = exitStackForSide(config, side);
          const tapeIntervalNow = backtestTapeInterval(input.recipe, 1, 2);
          const exitBarsNow = new Map<DcaIndicatorTimeframe, CandleBar[]>();
          const exitFrames = new Set<DcaIndicatorTimeframe>(
            exitStackTimeframes(exitStackNow),
          );
          if (exitNow.filter) {
            exitFrames.add(exitNow.filter.timeframe);
          }
          for (const timeframe of exitFrames) {
            const sampled = resampleBarsForTimeframe(
              barWindow,
              tapeIntervalNow,
              timeframe,
            );
            exitBarsNow.set(
              timeframe,
              sampled.map((row) => ({
                timeMs: 0,
                open: row.close,
                high: row.high,
                low: row.low,
                close: row.close,
              })),
            );
          }
          const exitSeries = seriesForFilter(
            exitNow.filter,
            exitNow.filter
              ? resampleBarsForTimeframe(
                  barWindow,
                  tapeIntervalNow,
                  exitNow.filter.timeframe,
                )
              : null,
          );
          const stackMet = exitExpressionMet({
            first: hardExitMet({
              filter: exitNow.filter,
              signal: exitNow.signal,
              side,
              closes: exitSeries.closes,
              bars: exitSeries.bars,
              prices: triggerPrices,
            }),
            stack: exitStackNow,
            side,
            price,
            prices: triggerPrices,
            barsByTimeframe: exitBarsNow,
          });
          if (stackMet) {
            flatten(
              side,
              bar.timeMs,
              price,
              true,
              "exit_if",
              formatExitExpressionText({
                filter: exitNow.filter,
                signal: exitNow.signal,
                stack: exitStackNow,
                side,
              }),
            );
          } else {
            flatten(side, bar.timeMs, limitTp, true, "take_profit");
          }
          closedThisBar = true;
          continue;
        }
      }
      const live = legs[side];
      const indicatorStart = dcaIndicatorStartForSide(config, side);
      const confirm = dcaFilterForSide(config, side, "confirm");
      const exit = hardExitForSide(config, side);
      const exitStack = exitStackForSide(config, side);
      const exitIf = exit.filter;
      const tapeInterval = backtestTapeInterval(input.recipe, 1, 2);
      const confirmSeries = seriesForFilter(
        confirm,
        confirm
          ? resampleBarsForTimeframe(barWindow, tapeInterval, confirm.timeframe)
          : null,
      );
      const exitIfSeries = seriesForFilter(
        exitIf,
        exitIf
          ? resampleBarsForTimeframe(barWindow, tapeInterval, exitIf.timeframe)
          : null,
      );
      const entryStack = dcaEntryStackForSide(config, side);
      const entryBars = new Map<DcaIndicatorTimeframe, CandleBar[]>();
      const gateTimeframes = [
        ...(entryStackIsLegacy(entryStack)
          ? []
          : entryStackTimeframes(entryStack)),
      ];
      const sideRetrace =
        config.direction === "both" && side === "short"
          ? config.shortRetrace
          : config.retrace;
      if (dcaStartKindForSide(config, side) === "retrace" && sideRetrace) {
        gateTimeframes.push(sideRetrace.timeframe);
      }
      const sideAdd =
        config.direction === "both" && side === "short"
          ? config.shortAddStack
          : config.addStack;
      if (sideAdd) {
        gateTimeframes.push(...entryStackTimeframes(sideAdd));
      }
      for (const timeframe of gateTimeframes) {
        if (entryBars.has(timeframe)) {
          continue;
        }
        const sampled = resampleBarsForTimeframe(
          barWindow,
          tapeInterval,
          timeframe,
        );
        entryBars.set(
          timeframe,
          sampled.map((row) => ({
            timeMs: 0,
            open: row.close,
            high: row.high,
            low: row.low,
            close: row.close,
          })),
        );
      }
      const decision = decideDcaTick({
        status: live.status,
        side,
        reduceOnly: false,
        lastPrice: price,
        mark: price,
        lastClipPrice: live.lastClipPrice,
        lastClipAtMs: live.lastClipAtMs,
        firstFillPrice: live.firstFillPrice,
        nowMs: bar.timeMs,
        startKind: dcaStartKindForSide(config, side),
        dcaMode: config.dcaMode,
        dipPct: config.dipPct,
        intervalMinutes: config.intervalMinutes,
        deviationMultiplier: config.deviationMultiplier,
        spacingKind: config.spacingKind,
        atr: currentAtr(),
        takeProfitAtr: atrForSide(side),
        atrSpacingMult: config.atrSpacingMult,
        clipsFilled: live.clipsFilled,
        maxClips: config.maxClips,
        maxValue: dcaTickValueCapUsdt({
          kind: config.maxValueKind,
          maxValue: config.maxValue,
          cycleMaxValue: live.cycleMaxValue,
          bookUsdt: input.startingUsdt + realized,
          leverage: normalizeBacktestLeverage(input.leverage),
        }),
        positionQty: live.qty > 0 ? live.qty : null,
        entryPrice: live.qty > 0 ? live.entry : null,
        takeProfitKind: dcaClassicForSide(config, side).takeProfitKind,
        takeProfitAtrMult: dcaClassicForSide(config, side).takeProfitAtrMult,
        takeProfitPct: actionsFor(side)
          ? null
          : dcaClassicForSide(config, side).takeProfitPct,
        stopLossPct: actionsFor(side)
          ? null
          : dcaClassicForSide(config, side).stopLossPct,
        takeProfitBasis: dcaClassicForSide(config, side).takeProfitBasis,
        stopLossBasis: dcaClassicForSide(config, side).stopLossBasis,
        breakevenActivationPct: actionsFor(side)
          ? null
          : dcaClassicForSide(config, side).breakevenActivationPct,
        breakevenDone: live.breakevenDone,
        armTrigger: dcaArmTriggerForSide(config, side),
        armConditionTrue: live.armTrue,
        disarmTrigger: config.disarmTrigger,
        disarmConditionTrue: live.disarmTrue,
        indicatorKind: indicatorStart?.kind ?? null,
        indicatorCompare: indicatorStart?.compare ?? null,
        indicatorLevel: indicatorStart?.level ?? null,
        indicatorPeriod: indicatorStart?.period ?? null,
        indicatorSlowPeriod: indicatorStart?.slowPeriod ?? null,
        indicatorMultiplier: indicatorStart?.multiplier ?? null,
        divergence: indicatorStart?.divergence ?? null,
        indicatorConditionTrue: live.indicatorTrue,
        splitIndicatorSides:
          splitSides &&
          !config.shortIndicatorKind &&
          !config.shortArmTrigger,
        closes: indicatorStart
          ? resampleClosesForTimeframe(
              window,
              tapeInterval,
              indicatorStart.timeframe,
            )
          : window,
        bars: indicatorStart
          ? resampleBarsForTimeframe(
              barWindow,
              tapeInterval,
              indicatorStart.timeframe,
            )
          : barWindow,
        confirm,
        confirmCloses: confirmSeries.closes,
        confirmBars: confirmSeries.bars,
        ...dcaEntryTickExtras({
          playbook: config,
          side,
          price,
          prices: triggerPrices,
          barsByTimeframe: entryBars,
        }),
        ...dcaSideGates({
          playbook: config,
          side,
          price,
          prices: triggerPrices,
          barsByTimeframe: entryBars,
        }),
        exitIf: actionsFor(side) ? null : exitIf,
        exitHard: actionsFor(side) ? null : exit.signal,
        exitIfCloses: exitIfSeries.closes,
        exitIfBars: exitIfSeries.bars,
        ...(actionsFor(side) || exitStack.leaves.length === 0
          ? {}
          : exitStack.leaves.length > 0
          ? {
              exitJoins: exitStack.joins,
              exitLeaves: exitLeafResults({
                stack: exitStack,
                side,
                price,
                prices: triggerPrices,
                barsByTimeframe: new Map(
                  exitStackTimeframes(exitStack).map((timeframe) => {
                    const sampled = resampleBarsForTimeframe(
                      barWindow,
                      tapeInterval,
                      timeframe,
                    );
                    return [
                      timeframe,
                      sampled.map((row) => ({
                        timeMs: 0,
                        open: row.close,
                        high: row.high,
                        low: row.low,
                        close: row.close,
                      })),
                    ] as const;
                  }),
                ),
              }),
            }
          : {}),
        takeProfitOrderType: dcaClassicForSide(config, side).takeProfitOrderType,
        tpLimitResting:
          dcaClassicForSide(config, side).takeProfitOrderType === "limit" &&
          live.qty > 0,
        triggerPrices,
      });
      legs[side] = {
        ...legs[side],
        armTrue: decision.nextArmTrue,
        disarmTrue: decision.nextDisarmTrue,
        indicatorTrue: decision.nextIndicatorTrue,
      };
      const starting =
        (decision.action.kind === "arm" || decision.action.kind === "clip") &&
        live.clipsFilled === 0;
      if (starting && (closedThisBar || startedThisBar)) {
        continue;
      }
      if (decision.action.kind === "arm" || decision.action.kind === "clip") {
        const because =
          live.clipsFilled === 0 ? dcaEntryBecause(side) : undefined;
        addClip(side, bar.timeMs, price, because);
        if (starting) {
          startedThisBar = true;
        }
      } else if (decision.action.kind === "close") {
        const closeReason =
          decision.action.reason === "stop_loss"
            ? "stop"
            : decision.action.reason === "exit_if"
              ? "exit_if"
              : "take_profit";
        flatten(
          side,
          bar.timeMs,
          price,
          true,
          closeReason,
          closeReason === "exit_if"
            ? formatExitExpressionText({
                filter: exit.filter,
                signal: exit.signal,
                stack: exitStack,
                side,
              })
            : undefined,
        );
        closedThisBar = true;
      } else if (decision.action.kind === "disarm") {
        if (legs[side].qty > 0) {
          legs[side] = { ...legs[side], status: "stop_adding" };
        } else {
          legs[side] = { ...emptyLeg(), status: "idle" };
        }
      } else if (decision.action.kind === "end_cycle") {
        flatten(side, bar.timeMs, price, true, "close");
        closedThisBar = true;
      } else if (decision.action.kind === "stop_adding") {
        legs[side] = { ...legs[side], status: "stop_adding" };
      } else if (decision.action.kind === "breakeven") {
        const offset = dcaClassicForSide(config, side).breakevenOffsetPct ?? 0;
        const sl =
          side === "long"
            ? live.entry * (1 + offset / 100)
            : live.entry * (1 - offset / 100);
        legs[side] = { ...live, breakevenDone: true, slPrice: sl, slQty: null };
      }
      const book = actionsFor(side);
      const heldLeg = legs[side];
      if (book && heldLeg.qty > 0 && !closedThisBar) {
        const bars = new Map<string, CandleBar[]>();
        for (const timeframe of exitActionTimeframes(book)) {
          const sampled = resampleBarsForTimeframe(
            barWindow,
            tapeInterval,
            timeframe as DcaIndicatorTimeframe,
          );
          bars.set(
            timeframe,
            sampled.map((row) => ({
              timeMs: bar.timeMs,
              open: row.close,
              high: row.high,
              low: row.low,
              close: row.close,
            })),
          );
        }
        const seeded =
          exitLots[side].length > 0
            ? exitLots[side]
            : [{ id: "position", qty: heldLeg.qty, price: heldLeg.entry }];
        const settled = evaluateExitActions({
          actions: book,
          runtime: exitArms[side],
          lots: seeded,
          side,
          mark: price,
          last: price,
          favorable: side === "long" ? bar.high : bar.low,
          adverse: side === "long" ? bar.low : bar.high,
          entryPrice: heldLeg.entry,
          nowMs: bar.timeMs,
          barsByTimeframe: bars,
          prices: triggerPrices,
          breakevenDone: heldLeg.breakevenDone,
        });
        exitArms[side] = settled.runtime;
        exitLots[side] = settled.lots;
        if (settled.breakeven && !heldLeg.breakevenDone) {
          const offset = settled.breakeven.offsetPct;
          const sl =
            side === "long"
              ? heldLeg.entry * (1 + offset / 100)
              : heldLeg.entry * (1 - offset / 100);
          const cover = settled.breakeven.qty;
          legs[side] = {
            ...heldLeg,
            breakevenDone: true,
            slPrice: sl,
            slQty: cover != null && cover > 0 && cover + 1e-8 < heldLeg.qty ? cover : null,
          };
        }
        for (const claim of settled.claims) {
          const current = legs[side];
          const take = Math.min(current.qty, claim.qty);
          if (!(take > 0)) {
            continue;
          }
          const fee = feeUsdt(take, price, input.feeRate);
          const pnl = unrealized(side, take, current.entry, price) - fee;
          realized += pnl;
          trades += 1;
          if (pnl > 0) {
            wins += 1;
            grossWin += pnl;
          } else {
            grossLoss += Math.abs(pnl);
          }
          remember(
            {
              atMs: bar.timeMs,
              action: "flatten",
              side,
              qty: take,
              price,
              feeUsdt: fee,
              realizedUsdt: pnl,
              reason: claimFillReason(claim.kind),
            },
          );
          const left = current.qty - take;
          if (!(left > 1e-8)) {
            legs[side] = emptyLeg();
            exitLots[side] = [];
            exitArms[side] = emptyExitRuntime();
            closedThisBar = true;
            break;
          }
          legs[side] = { ...current, qty: left };
        }
      }
    }
    if (held) {
      barsIn += 1;
    }
    let mark = input.startingUsdt + realized;
    for (const side of sides) {
      const leg = legs[side];
      if (leg.qty > 0) {
        mark += unrealized(side, leg.qty, leg.entry, price);
      }
    }
    if (mark > peak) {
      peak = mark;
    }
    const drawdown = peak - mark;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  const last = input.bars[input.bars.length - 1];
  let openQty = 0;
  let openSide: FuturesSide | null = null;
  let markUsdt = 0;
  for (const side of sides) {
    const leg = legs[side];
    if (leg.qty > 0) {
      openQty += leg.qty;
      openSide = side;
      if (last) {
        markUsdt += unrealized(side, leg.qty, leg.entry, last.close);
      }
    }
  }

  function dcaEntryBecause(side: FuturesSide): string {
    const entryStack = dcaEntryStackForSide(config, side);
    if (!entryStackIsLegacy(entryStack)) {
      return formatDcaStartReasons({
        startKind: dcaStartKindForSide(config, side),
        side,
        armTrigger: dcaArmTriggerForSide(config, side),
        indicator: dcaIndicatorStartForSide(config, side),
        entryStack,
        price: closes[closes.length - 1] ?? null,
        retrace: dcaRetraceForReason(config, side),
      });
    }
    const sideKind = dcaStartKindForSide(config, side);
    if (sideKind === "immediate") {
      return "Immediate start.";
    }
    if (sideKind === "retrace") {
      const spec = dcaRetraceForReason(config, side);
      return spec ? formatRetraceLabel(spec) : "Retrace";
    }
    if (sideKind === "price") {
      const last = closes[closes.length - 1] ?? 0;
      return priceStartBecause(dcaArmTriggerForSide(config, side), last);
    }
    const indicatorStart = dcaIndicatorStartForSide(config, side);
    if (!indicatorStart) {
      return "";
    }
    const tapeInterval = backtestTapeInterval(input.recipe, 1, 2);
    const sampledCloses = resampleClosesForTimeframe(
      closes.slice(-80),
      tapeInterval,
      indicatorStart.timeframe,
    );
    const sampledBars = resampleBarsForTimeframe(
      ohlc.slice(-80),
      tapeInterval,
      indicatorStart.timeframe,
    );
    const confirm = dcaFilterForSide(config, side, "confirm");
    return [indicatorBecause({
      kind: indicatorStart.kind,
      compare: indicatorStart.compare,
      level: indicatorStart.level,
      period: indicatorStart.period,
      slowPeriod: indicatorStart.slowPeriod,
      multiplier: indicatorStart.multiplier ?? null,
      timeframe: indicatorStart.timeframe,
      side,
      closes: sampledCloses,
      bars: sampledBars,
    }), filterBecause(confirm, side, "Confirm")]
      .filter(Boolean)
      .join(" ");
  }

  return {
    orders,
    events,
    stats: finishBacktestStats({
      trades,
      wins,
      realizedUsdt: realized,
      maxDrawdownUsdt: maxDrawdown,
      profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
      timeInMarket: input.bars.length > 0 ? barsIn / input.bars.length : 0,
      openQty,
      openSide,
      markUsdt,
      lastPrice: last?.close ?? null,
      startingUsdt: input.startingUsdt,
    }),
  };
}
