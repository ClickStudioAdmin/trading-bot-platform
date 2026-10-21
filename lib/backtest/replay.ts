import { decideFuturesAutomationTick } from "@/lib/futures/automation";
import {
  futuresBreakevenDue,
  futuresBreakevenStop,
  perpsExitForSide,
} from "@/lib/futures/conditions";
import type { FuturesAction, FuturesSide } from "@/lib/futures/model";
import {
  resampleBarsForTimeframe,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import {
  formatStrategyLeafReason,
} from "@/lib/bots/condition-copy";
import { hardExitSignalFromJson } from "@/lib/dca/hard-exit";
import {
  emptyExitRuntime,
  evaluateExitActions,
  exitActionTimeframes,
  exitBookForClassic,
  reduceOpenLots,
  sideExitActions,
  type ExitActionKind,
  type ExitLot,
  type ExitRuntime,
} from "@/lib/strategy/exit-actions";
import { formatExitExpressionText } from "@/lib/dca/exit-stack";
import { protectionReading } from "@/lib/strategy/protection";
import { canBacktestPerpsRecipe } from "./eligibility";
import { backtestTapeInterval } from "./model";
import { ReplayBook } from "./replay-mask";
import {
  breakevenStopTpsl,
  paperStopLossHit,
  paperTakeProfitHit,
  resolveFuturesTpslPrices,
  tpslHasLevels,
  type FuturesTpsl,
} from "@/lib/futures/tpsl";
import {
  advanceTrailingOnBar,
  armTrailingAt,
  trailingHasStop,
  type FuturesTrailing,
} from "@/lib/futures/trailing";
import type { CandleBar } from "@/lib/market/candles";
import type { PerpsTemplateRecipe } from "@/lib/templates/recipe";
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
  yieldBacktestReplay,
} from "./model";
import { fillSentence, skippedAddSentence, skippedEntrySentence } from "./events";
import { flexAddClipIndex, flexAddIntent, freshFlexAddLatch } from "./flex-add";
import type { ReplayEvent } from "./model";
import {
  addStackGroups,
  entryStackIsLegacy,
  resolveEntryStack,
  strategyLeafTimeframe,
} from "@/lib/strategy/expr";
import { filterBecause, indicatorBecause, priceStartBecause } from "./explain";
import {
  commitPositionRetraceFire,
  formatRetraceLabel,
  positionRetraceConsumed,
  resumePositionRetrace,
} from "@/lib/strategy/retrace";
import type { PositionRetraceMemory, RetraceSpec } from "@/lib/strategy/retrace";

export { canBacktestPerpsRecipe };

export function recipeAction(recipe: PerpsTemplateRecipe): {
  action: FuturesAction;
  closeSide: FuturesSide | null;
} {
  if (recipe.formAction === "close_long") {
    return { action: "flatten", closeSide: "long" };
  }
  if (recipe.formAction === "close_short") {
    return { action: "flatten", closeSide: "short" };
  }
  return {
    action: recipe.formAction === "sell" ? "sell" : "buy",
    closeSide: null,
  };
}

function perpsLegBecause(input: {
  entrySource: PerpsTemplateRecipe["entrySource"];
  triggerBy: PerpsTemplateRecipe["triggerBy"];
  triggerCompare: PerpsTemplateRecipe["triggerCompare"];
  triggerPrice: number;
  indicator: PerpsTemplateRecipe["indicator"];
  confirm: PerpsTemplateRecipe["confirm"];
  entryStack: PerpsTemplateRecipe["entryStack"];
  retrace?: RetraceSpec | null;
  side: FuturesSide;
  price: number;
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>;
}): string {
  const stack = resolveEntryStack(input.entryStack, input.confirm);
  const stackBecause = entryStackIsLegacy(stack)
    ? ""
    : stack.leaves
        .map((leaf, index) => {
          const text = formatStrategyLeafReason(leaf, input.side);
          const join = stack.joins[index] === "or" ? "Or" : "And";
          return text ? `${join} ${text}` : "";
        })
        .filter(Boolean)
        .join(" ");
  if (input.entrySource === "retrace") {
    return [input.retrace ? formatRetraceLabel(input.retrace) : "Retrace", stackBecause]
      .filter(Boolean)
      .join(" ");
  }
  if (input.entrySource === "price") {
    return [priceStartBecause(
      {
        triggerBy: input.triggerBy,
        compare: input.triggerCompare,
        price: input.triggerPrice,
      },
      input.price,
    ), stackBecause]
      .filter(Boolean)
      .join(" ");
  }
  const start = input.indicator;
  if (!start) {
    return stackBecause;
  }
  const bars = input.barsByTimeframe.get(start.timeframe) ?? [];
  return [
    indicatorBecause({
      kind: start.kind,
      compare: start.compare,
      level: start.level,
      period: start.period,
      slowPeriod: start.slowPeriod,
      multiplier: start.multiplier ?? null,
      timeframe: start.timeframe,
      side: input.side,
      closes: bars.map((row) => row.close),
      bars,
    }),
    filterBecause(input.confirm, input.side, "Confirm"),
    stackBecause,
  ]
    .filter(Boolean)
    .join(" ");
}

function sizeAtPrice(
  recipe: PerpsTemplateRecipe,
  price: number,
  side?: FuturesSide,
): number {
  const shortOrder = side === "short" ? recipe.shortEntry : null;
  const shortSize = shortOrder?.size;
  const own = shortSize != null && shortSize > 0;
  const size = own
    ? shortSize
    : Number(String(recipe.size).replace(/,/g, "").trim());
  const unit = own
    ? shortOrder?.sizeUnit === "qty"
      ? "qty"
      : shortOrder?.sizeUnit === "usdt"
        ? "usdt"
        : recipe.sizeUnit
    : recipe.sizeUnit;
  if (!(size > 0) || !(price > 0)) {
    return 0;
  }
  return unit === "usdt" ? size / price : size;
}

type OpenSim = {
  side: FuturesSide;
  qty: number;
  entry: number;
  /** First fill. Later adds change `entry` and leave this in place. */
  initial: number;
  openedAtMs: number;
  tpsl: FuturesTpsl | null;
  trailing: FuturesTrailing | null;
  breakevenDone: boolean;
};

function mergeSimPosition(
  current: OpenSim | null,
  side: FuturesSide,
  qty: number,
  price: number,
  tpsl: FuturesTpsl | null,
  trailing: FuturesTrailing | null,
  openedAtMs: number,
): OpenSim {
  const priced =
    tpsl && tpslHasLevels(tpsl)
      ? resolveFuturesTpslPrices({
          tpsl,
          side,
          entryPrice: price,
        })
      : null;
  const nextTpsl = priced?.ok ? priced.tpsl : tpsl;
  if (current && current.side === side) {
    const nextQty = current.qty + qty;
    return {
      side,
      qty: nextQty,
      entry: (current.entry * current.qty + price * qty) / nextQty,
      initial: current.initial,
      openedAtMs: current.openedAtMs,
      tpsl: current.tpsl ?? nextTpsl,
      trailing: current.trailing ?? trailing,
      breakevenDone: current.breakevenDone,
    };
  }
  return {
    side,
    qty,
    entry: price,
    initial: price,
    openedAtMs,
    tpsl: nextTpsl,
    trailing: trailing ? armTrailingAt(trailing, price) : null,
    breakevenDone: false,
  };
}

function nextOpenRetrace(
  memory: PositionRetraceMemory | null,
  open: OpenSim | null,
  bar: CandleBar,
): PositionRetraceMemory | null {
  if (!open) {
    return null;
  }
  return resumePositionRetrace({
    stored: memory,
    positionKey: String(open.openedAtMs),
    initial: open.initial,
    quotes: { last: bar.close, mark: bar.close, index: bar.close },
    wick: { high: bar.high, low: bar.low },
    wickSources: ["last", "mark", "index"],
  });
}

function perpsSideActions(recipe: PerpsTemplateRecipe, side: FuturesSide) {
  return sideExitActions(
    recipe.exitActions,
    recipe.shortEntry?.actions,
    recipe.direction,
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

function feeUsdt(qty: number, price: number, feeRate: number): number {
  return Math.abs(qty * price) * feeRate;
}

function moveSimBreakeven(
  open: OpenSim,
  offsetPct: number,
  appliesQty?: number | null,
): void {
  const stop = futuresBreakevenStop({
    side: open.side,
    entryPrice: open.entry,
    currentStop: open.tpsl?.stopLoss ?? null,
    offsetPct,
  });
  if (stop == null || !(stop > 0)) {
    return;
  }
  const current: FuturesTpsl = {
    takeProfit: open.tpsl?.takeProfit ?? null,
    stopLoss: open.tpsl?.stopLoss ?? null,
    tpTrigger: open.tpsl?.tpTrigger ?? "last",
    slTrigger: open.tpsl?.slTrigger ?? "last",
    mode: open.tpsl?.mode ?? "full",
    tpQty: open.tpsl?.tpQty ?? null,
    slQty: open.tpsl?.slQty ?? null,
    tpOrderType: open.tpsl?.tpOrderType ?? "market",
    slOrderType: open.tpsl?.slOrderType ?? "market",
    tpLimitPrice: open.tpsl?.tpLimitPrice ?? null,
    slLimitPrice: open.tpsl?.slLimitPrice ?? null,
  };
  open.tpsl = breakevenStopTpsl({
    current,
    stop,
    positionQty: open.qty,
    appliesQty,
  });
  open.breakevenDone = true;
}

function unrealized(
  side: FuturesSide,
  qty: number,
  entry: number,
  mark: number,
): number {
  return side === "long" ? (mark - entry) * qty : (entry - mark) * qty;
}

export function replayBarsByTimeframe(
  window: CandleBar[],
  tape: DcaIndicatorTimeframe,
  timeframes: DcaIndicatorTimeframe[],
): Map<DcaIndicatorTimeframe, CandleBar[]> {
  const map = new Map<DcaIndicatorTimeframe, CandleBar[]>();
  for (const timeframe of timeframes) {
    const resampled = resampleBarsForTimeframe(window, tape, timeframe);
    map.set(
      timeframe,
      resampled.map((row, index) => ({
        timeMs: window[Math.min(index, window.length - 1)]?.timeMs ?? index,
        open: row.close,
        high: row.high,
        low: row.low,
        close: row.close,
      })),
    );
  }
  return map;
}

export async function replayPerpsPriceCross(input: {
  bars: CandleBar[];
  recipe: PerpsTemplateRecipe;
  feeRate: number;
  startingUsdt: number;
  leverage?: number;
  onBar?: (barIndex: number) => void;
}): Promise<{ orders: SimulatedOrder[]; stats: BacktestStats; events: ReplayEvent[] }> {
  const allowed = canBacktestPerpsRecipe(input.recipe);
  if (!allowed.ok) {
    return { orders: [], stats: emptyBacktestStats(input.startingUsdt), events: [] };
  }
  if (input.recipe.direction === "both" && input.recipe.shortEntry) {
    return replayPerpsBoth(input);
  }
  const { action, closeSide } = recipeAction(input.recipe);
  const tape = backtestTapeInterval(input.recipe, 1, 2);
  const conditionTimeframes = [
    input.recipe.indicator?.timeframe,
    ...(input.recipe.entryStack?.leaves.map((leaf) =>
      strategyLeafTimeframe(leaf),
    ) ?? []),
    input.recipe.confirm?.timeframe,
    input.recipe.exitIf?.timeframe,
    ...(input.recipe.exitStack?.leaves.map((leaf) =>
      strategyLeafTimeframe(leaf),
    ) ?? []),
  ].filter((row): row is DcaIndicatorTimeframe => Boolean(row));
  const series = new ReplayBook(input.bars, tape, Date.now());
  const entrySide: FuturesSide =
    action === "sell" ? "short" : closeSide ?? "long";
  const entryMask = series.entryMask({
    side: entrySide,
    entrySource: input.recipe.entrySource,
    triggerCompare: input.recipe.triggerCompare,
    triggerPrice: Number(
      String(input.recipe.triggerPrice).replace(/,/g, "").trim(),
    ),
    indicator: input.recipe.indicator ?? null,
    confirm: input.recipe.confirm ?? null,
    entryStack: input.recipe.entryStack ?? null,
    retrace: input.recipe.retrace ?? null,
  });
  const longExitMask = series.exitMask(input.recipe, "long");
  const shortExitMask = series.exitMask(input.recipe, "short");
  let wasTrue = false;
  let open: OpenSim | null = null;
  let flexLots: ExitLot[] = [];
  let flexRuntime: ExitRuntime = emptyExitRuntime();
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

  function bookForOpen(sim: OpenSim, atMs: number, mark: number) {
    if (perpsSideActions(input.recipe, sim.side)) {
      return flexRuntime.book ?? null;
    }
    const shortClassic =
      sim.side === "short" && input.recipe.direction === "both"
        ? input.recipe.shortEntry?.classic
        : null;
    return exitBookForClassic({
      side: sim.side,
      qty: sim.qty,
      entryPrice: sim.entry,
      mark,
      last: mark,
      nowMs: atMs,
      breakevenDone: sim.breakevenDone,
      trailingPeak: sim.trailing?.peak ?? null,
      takeProfitPrice: sim.tpsl?.takeProfit ?? null,
      takeProfitQty: sim.tpsl?.tpQty ?? null,
      stopLossPrice: sim.tpsl?.stopLoss ?? null,
      stopLossQty: sim.tpsl?.slQty ?? null,
      trailingDistance: sim.trailing?.distance ?? null,
      trailingActivation: sim.trailing?.activePrice ?? null,
      breakevenActivationPct:
        shortClassic?.breakevenActivationPct ?? input.recipe.breakevenActivationPct ?? null,
      breakevenOffsetPct:
        shortClassic?.breakevenOffsetPct ?? input.recipe.breakevenOffsetPct ?? null,
    });
  }

  function remember(
    order: SimulatedOrder,
    because?: string,
    fillAt?: "close" | "limit",
  ) {
    const exitBook = open ? bookForOpen(open, order.atMs, order.price) : null;
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
        fillAt,
      }),
      ...(exitBook ? { exitBook } : {}),
    });
  }

  function flattenOpen(
    atMs: number,
    fill: number,
    reason: BacktestFillReason,
    because?: string,
  ) {
    if (!open) {
      return;
    }
    const fee = feeUsdt(open.qty, fill, input.feeRate);
    const pnl = unrealized(open.side, open.qty, open.entry, fill) - fee;
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
        side: open.side,
        qty: open.qty,
        price: fill,
        feeUsdt: fee,
        realizedUsdt: pnl,
        reason,
      },
      because,
    );
    open = null;
    flexLots = [];
    flexRuntime = emptyExitRuntime();
  }

  function reduceOpen(
    atMs: number,
    fill: number,
    qty: number,
    reason: BacktestFillReason,
  ) {
    if (!open) {
      return;
    }
    const take = Math.min(open.qty, qty);
    if (!(take > 0) || take + 1e-8 >= open.qty) {
      flattenOpen(atMs, fill, reason);
      return;
    }
    const current = open;
    const fee = feeUsdt(take, fill, input.feeRate);
    const pnl = unrealized(current.side, take, current.entry, fill) - fee;
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
        side: current.side,
        qty: take,
        price: fill,
        feeUsdt: fee,
        realizedUsdt: pnl,
        reason,
      },
    );
    open = {
      ...current,
      qty: current.qty - take,
      tpsl: current.tpsl ? { ...current.tpsl, stopLoss: null, slQty: null } : null,
    };
    flexLots = reduceOpenLots(flexLots, take);
  }

  function wipeOpen(atMs: number, fill: number) {
    flattenOpen(atMs, fill, "liquidation");
    liquidated = true;
  }

  function markEquity(price: number) {
    const mark =
      input.startingUsdt +
      realized +
      (open ? unrealized(open.side, open.qty, open.entry, price) : 0);
    if (mark > peak) {
      peak = mark;
    }
    const drawdown = peak - mark;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  const addLatch = freshFlexAddLatch();
  let addRetrace: PositionRetraceMemory | null = null;
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
      markEquity(0);
      continue;
    }
    if (open) {
      barsIn += 1;
      const adverse = open.side === "long" ? bar.low : bar.high;
      const favorable = open.side === "long" ? bar.high : bar.low;
      const quotes = {
        last: adverse,
        mark: adverse,
        index: adverse,
      };
      const actions = perpsSideActions(input.recipe, open.side);
      const resting = open.tpsl;
      const breakevenStop =
        Boolean(actions) && open.breakevenDone && resting != null && tpslHasLevels(resting);
      const sl =
        resting && tpslHasLevels(resting) && (!actions || breakevenStop)
          ? paperStopLossHit({
              side: open.side,
              tpsl: resting,
              ...quotes,
            })
          : null;
      const liq = backtestLiquidationPrice({
        side: open.side,
        entry: open.entry,
        qty: open.qty,
        cashUsdt: input.startingUsdt + realized,
        feeRate: input.feeRate,
      });
      const firstHit = firstAdverseFill(open.side, adverse, [
        sl ? { price: sl.price, reason: "stop" } : null,
        liq != null ? { price: liq, reason: "liquidation" } : null,
      ]);
      if (firstHit) {
        if (firstHit.reason === "liquidation") {
          wipeOpen(bar.timeMs, firstHit.price);
        } else if (
          breakevenStop &&
          resting?.slQty != null &&
          resting.slQty > 0 &&
          open &&
          resting.slQty + 1e-8 < open.qty
        ) {
          reduceOpen(bar.timeMs, firstHit.price, resting.slQty, firstHit.reason);
        } else {
          flattenOpen(bar.timeMs, firstHit.price, firstHit.reason);
        }
      }
      if (actions && open) {
        const frames = exitActionTimeframes(actions) as DcaIndicatorTimeframe[];
        const sampled = series.barsAt(barIndex - 1, frames);
        const bars = new Map<string, CandleBar[]>();
        for (const [key, value] of sampled) {
          bars.set(key, value);
        }
        const seeded =
          flexLots.length > 0
            ? flexLots
            : [{ id: "position", qty: open.qty, price: open.entry }];
        const settled = evaluateExitActions({
          actions,
          runtime: flexRuntime,
          lots: seeded,
          side: open.side,
          mark: price,
          last: price,
          favorable,
          adverse,
          entryPrice: open.entry,
          nowMs: bar.timeMs,
          barsByTimeframe: bars,
          breakevenDone: open.breakevenDone,
        });
        flexRuntime = settled.runtime;
        flexLots = settled.lots;
        if (settled.breakeven && !open.breakevenDone) {
          moveSimBreakeven(open, settled.breakeven.offsetPct, settled.breakeven.qty);
        }
        for (const claim of settled.claims) {
          if (!open) {
            break;
          }
          const take = Math.min(open.qty, claim.qty);
          if (!open || !(take > 0)) {
            continue;
          }
          const current: OpenSim = open;
          if (take + 1e-8 >= current.qty) {
            flattenOpen(bar.timeMs, price, claimFillReason(claim.kind));
            break;
          }
          const fee = feeUsdt(take, price, input.feeRate);
          const pnl = unrealized(current.side, take, current.entry, price) - fee;
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
              side: current.side,
              qty: take,
              price,
              feeUsdt: fee,
              realizedUsdt: pnl,
              reason: claimFillReason(claim.kind),
            },
          );
          open = { ...current, qty: current.qty - take };
        }
      } else if (open?.trailing && trailingHasStop(open.trailing)) {
        const trail = advanceTrailingOnBar({
          side: open.side,
          trailing: open.trailing,
          favorable,
          adverse,
        });
        open.trailing = { ...open.trailing, peak: trail.peak };
        if (trail.hit && trail.fillPrice != null) {
          flattenOpen(bar.timeMs, trail.fillPrice, "trailing");
        }
      }
      if (
        open &&
        !actions &&
        (open.side === "short" ? shortExitMask : longExitMask)[barIndex - 1]
      ) {
        flattenOpen(
          bar.timeMs,
          price,
          "exit_if",
          formatExitExpressionText({
            filter: input.recipe.exitIf,
            signal: hardExitSignalFromJson(input.recipe.exitHard),
            stack: input.recipe.exitStack,
            side: open.side,
          }),
        );
      }
      if (!actions && open?.tpsl && tpslHasLevels(open.tpsl)) {
        const tp = paperTakeProfitHit({
          side: open.side,
          tpsl: open.tpsl,
          last: favorable,
          mark: favorable,
          index: favorable,
        });
        if (tp) {
          flattenOpen(bar.timeMs, tp.price, "take_profit");
        }
      }
      if (
        open &&
        !actions &&
        futuresBreakevenDue({
          side: open.side,
          qty: open.qty,
          entryPrice: open.entry,
          mark: price,
          activationPct: input.recipe.breakevenActivationPct,
          done: open.breakevenDone,
        })
      ) {
        const stop = futuresBreakevenStop({
          side: open.side,
          entryPrice: open.entry,
          currentStop: open.tpsl?.stopLoss ?? null,
          offsetPct: input.recipe.breakevenOffsetPct,
        });
        if (stop != null && stop > 0) {
          open.tpsl = {
            takeProfit: open.tpsl?.takeProfit ?? null,
            stopLoss: stop,
            tpTrigger: open.tpsl?.tpTrigger ?? "last",
            slTrigger: open.tpsl?.slTrigger ?? "last",
            mode: open.tpsl?.mode ?? "full",
            tpQty: open.tpsl?.tpQty ?? null,
            slQty: open.tpsl?.slQty ?? null,
            tpOrderType: open.tpsl?.tpOrderType ?? "market",
            slOrderType: "market",
            tpLimitPrice: open.tpsl?.tpLimitPrice ?? null,
            slLimitPrice: null,
          };
          open.breakevenDone = true;
        }
      }
    }
    if (liquidated) {
      markEquity(0);
      continue;
    }
    const conditionMet = entryMask[barIndex - 1] === true;
    const hasOpenOnSide =
      action === "flatten"
        ? Boolean(open && open.side === (closeSide ?? "long"))
        : Boolean(
            open &&
              open.side === (action === "sell" ? "short" : "long"),
          );
    const decision = decideFuturesAutomationTick({
      conditionMet,
      wasTrue,
      action,
      mode: "active",
      bookReduceOnly: false,
      skipIfOpen: input.recipe.skipIfOpen,
      hasOpenOnSide,
    });
    wasTrue = decision.nextTrue;
    if (decision.fire) {
      if (action === "flatten" && open) {
        flattenOpen(bar.timeMs, price, "close");
      } else if (action === "buy" || action === "sell") {
        const side: FuturesSide = action === "sell" ? "short" : "long";
        const qty = sizeAtPrice(input.recipe, price);
        if (qty > 0) {
          const fee = feeUsdt(qty, price, input.feeRate);
          const leverage = normalizeBacktestLeverage(input.leverage);
          const locked = open
            ? backtestMarginUsdt(open.qty * open.entry, leverage)
            : 0;
          const available = input.startingUsdt + realized - locked;
          const because = perpsEntryBecause(
            side,
            price,
            series.barsAt(barIndex - 1, conditionTimeframes),
          );
          if (backtestMarginUsdt(qty * price, leverage) + fee <= available) {
            realized -= fee;
            remember(
              {
                atMs: bar.timeMs,
                action,
                side,
                qty,
                price,
                feeUsdt: fee,
                realizedUsdt: -fee,
                reason: "entry",
              },
              because,
            );
            const openingActions = perpsSideActions(input.recipe, side);
            open = mergeSimPosition(
              open,
              side,
              qty,
              price,
              openingActions ? null : input.recipe.tpsl,
              openingActions ? null : input.recipe.trailing,
              bar.timeMs,
            );
            if (openingActions) {
              flexLots.push({ id: `entry-${orders.length}`, qty, price });
            }
          } else {
            events.push({
              atMs: bar.timeMs,
              kind: "skipped",
              reason: "entry",
              orderIndex: null,
              side,
              text: skippedEntrySentence(side, because),
            });
          }
        }
      }
    }
    if (action === "buy" || action === "sell") {
      const stack = input.recipe.addStack;
      addRetrace = nextOpenRetrace(addRetrace, open, bar);
      const detail =
        open && stack && stack.leaves.length > 0 && addRetrace
          ? series.addDetail(
              stack,
              open.side,
              barIndex - 1,
              protectionReading(open.qty, bookForOpen(open, bar.timeMs, price)),
              { average: open.entry, memory: addRetrace },
            )
          : { met: false, group: null, because: "" };
      const intent = flexAddIntent({
        stack,
        detail,
        latch: addLatch,
        open: Boolean(open),
        bar,
      });
      if (intent && open) {
        const addFee = feeUsdt(intent.qty, intent.price, input.feeRate);
        const leverage = normalizeBacktestLeverage(input.leverage);
        const locked = backtestMarginUsdt(open.qty * open.entry, leverage);
        const available = input.startingUsdt + realized - locked;
        const clipIndex = flexAddClipIndex(orders, open.side);
        if (
          backtestMarginUsdt(intent.qty * intent.price, leverage) + addFee <=
          available
        ) {
          realized -= addFee;
          addLatch.limitArmed = false;
          addLatch.skipNoted = false;
          remember(
            {
              atMs: bar.timeMs,
              action: open.side === "short" ? "sell" : "buy",
              side: open.side,
              qty: intent.qty,
              price: intent.price,
              feeUsdt: addFee,
              realizedUsdt: -addFee,
              reason: "clip",
              clipIndex,
            },
            intent.because,
            intent.limit ? "limit" : "close",
          );
          const openingActions = perpsSideActions(input.recipe, open.side);
          open = mergeSimPosition(
            open,
            open.side,
            intent.qty,
            intent.price,
            openingActions ? null : input.recipe.tpsl,
            openingActions ? null : input.recipe.trailing,
            bar.timeMs,
          );
          if (openingActions) {
            flexLots.push({
              id: `add-${orders.length}`,
              qty: intent.qty,
              price: intent.price,
            });
          }
          if (addRetrace && stack && detail.group != null) {
            const leaves = addStackGroups(stack)[detail.group] ?? [];
            addRetrace = commitPositionRetraceFire(addRetrace, leaves);
            if (positionRetraceConsumed(leaves)) {
              addLatch.was = false;
            }
          }
        } else if (!addLatch.skipNoted) {
          addLatch.skipNoted = true;
          events.push({
            atMs: bar.timeMs,
            kind: "skipped",
            reason: "clip",
            orderIndex: null,
            side: open.side,
            clipIndex,
            text: skippedAddSentence(open.side, intent.because),
          });
        }
      }
    }
    markEquity(price);
  }

  const last = input.bars[input.bars.length - 1];
  const markUsdt = open && last
    ? unrealized(open.side, open.qty, open.entry, last.close)
    : 0;

  function perpsEntryBecause(
    side: FuturesSide,
    price: number,
    barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>,
  ): string {
    return perpsLegBecause({
      entrySource: input.recipe.entrySource,
      triggerBy: input.recipe.triggerBy,
      triggerCompare: input.recipe.triggerCompare,
      triggerPrice: Number(String(input.recipe.triggerPrice).replace(/,/g, "")),
      indicator: input.recipe.indicator,
      confirm: input.recipe.confirm,
      entryStack: input.recipe.entryStack,
      retrace: input.recipe.retrace,
      side,
      price,
      barsByTimeframe,
    });
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
      timeInMarket:
        input.bars.length > 0 ? barsIn / input.bars.length : 0,
      openQty: open?.qty ?? 0,
      openSide: open?.side ?? null,
      markUsdt,
      lastPrice: last?.close ?? null,
      startingUsdt: input.startingUsdt,
    }),
  };
}

async function replayPerpsBoth(input: {
  bars: CandleBar[];
  recipe: PerpsTemplateRecipe;
  feeRate: number;
  startingUsdt: number;
  leverage?: number;
  onBar?: (barIndex: number) => void;
}): Promise<{ orders: SimulatedOrder[]; stats: BacktestStats; events: ReplayEvent[] }> {
  const short = input.recipe.shortEntry;
  if (!short) {
    return {
      orders: [],
      stats: emptyBacktestStats(input.startingUsdt),
      events: [],
    };
  }
  const tape = backtestTapeInterval(input.recipe, 1, 2);
  const conditionTimeframes = [
    input.recipe.indicator?.timeframe,
    ...(input.recipe.entryStack?.leaves.map((leaf) => strategyLeafTimeframe(leaf)) ??
      []),
    input.recipe.confirm?.timeframe,
    short.indicator?.timeframe,
    ...(short.entryStack?.leaves.map((leaf) => strategyLeafTimeframe(leaf)) ?? []),
    short.confirm?.timeframe,
    input.recipe.exitIf?.timeframe,
    ...(input.recipe.exitStack?.leaves.map((leaf) =>
      strategyLeafTimeframe(leaf),
    ) ?? []),
    short.exitIf?.timeframe,
    ...(short.exitStack?.leaves.map((leaf) => strategyLeafTimeframe(leaf)) ??
      []),
  ].filter((row): row is DcaIndicatorTimeframe => Boolean(row));
  const series = new ReplayBook(input.bars, tape, Date.now());
  const longEntryMask = series.entryMask({
    side: "long",
    entrySource: input.recipe.entrySource,
    triggerCompare: input.recipe.triggerCompare,
    triggerPrice: Number(String(input.recipe.triggerPrice).replace(/,/g, "")),
    indicator: input.recipe.indicator ?? null,
    confirm: input.recipe.confirm ?? null,
    entryStack: input.recipe.entryStack ?? null,
    retrace: input.recipe.retrace ?? null,
  });
  const shortEntryMask = series.entryMask({
    side: "short",
    entrySource: short.entrySource,
    triggerCompare: short.triggerCompare,
    triggerPrice: short.triggerPrice,
    indicator: short.indicator ?? null,
    confirm: short.confirm ?? null,
    entryStack: short.entryStack ?? null,
    retrace: short.retrace ?? null,
  });
  const longExitMask = series.exitMask(input.recipe, "long");
  const shortExitMask = series.exitMask(input.recipe, "short");
  const legs: Array<{
    side: FuturesSide;
    wasTrue: boolean;
    entrySource: PerpsTemplateRecipe["entrySource"];
    triggerBy: PerpsTemplateRecipe["triggerBy"];
    triggerCompare: PerpsTemplateRecipe["triggerCompare"];
    triggerPrice: number;
    skipIfOpen: boolean;
    indicator: PerpsTemplateRecipe["indicator"];
    confirm: PerpsTemplateRecipe["confirm"];
    entryStack: PerpsTemplateRecipe["entryStack"];
  }> = [
    {
      side: "long",
      wasTrue: false,
      entrySource: input.recipe.entrySource,
      triggerBy: input.recipe.triggerBy,
      triggerCompare: input.recipe.triggerCompare,
      triggerPrice: Number(String(input.recipe.triggerPrice).replace(/,/g, "")),
      skipIfOpen: input.recipe.skipIfOpen,
      indicator: input.recipe.indicator,
      confirm: input.recipe.confirm,
      entryStack: input.recipe.entryStack,
    },
    {
      side: "short",
      wasTrue: false,
      entrySource: short.entrySource,
      triggerBy: short.triggerBy,
      triggerCompare: short.triggerCompare,
      triggerPrice: short.triggerPrice,
      skipIfOpen: short.skipIfOpen,
      indicator: short.indicator,
      confirm: short.confirm,
      entryStack: short.entryStack,
    },
  ];
  const book: Record<FuturesSide, OpenSim | null> = { long: null, short: null };
  const bookLots: Record<FuturesSide, ExitLot[]> = { long: [], short: [] };
  const bookArms: Record<FuturesSide, ExitRuntime> = {
    long: emptyExitRuntime(),
    short: emptyExitRuntime(),
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

  function bookForSide(sim: OpenSim, atMs: number, mark: number) {
    if (perpsSideActions(input.recipe, sim.side)) {
      return bookArms[sim.side].book ?? null;
    }
    const shortClassic =
      sim.side === "short" && input.recipe.direction === "both"
        ? input.recipe.shortEntry?.classic
        : null;
    return exitBookForClassic({
      side: sim.side,
      qty: sim.qty,
      entryPrice: sim.entry,
      mark,
      last: mark,
      nowMs: atMs,
      breakevenDone: sim.breakevenDone,
      trailingPeak: sim.trailing?.peak ?? null,
      takeProfitPrice: sim.tpsl?.takeProfit ?? null,
      takeProfitQty: sim.tpsl?.tpQty ?? null,
      stopLossPrice: sim.tpsl?.stopLoss ?? null,
      stopLossQty: sim.tpsl?.slQty ?? null,
      trailingDistance: sim.trailing?.distance ?? null,
      trailingActivation: sim.trailing?.activePrice ?? null,
      breakevenActivationPct:
        shortClassic?.breakevenActivationPct ?? input.recipe.breakevenActivationPct ?? null,
      breakevenOffsetPct:
        shortClassic?.breakevenOffsetPct ?? input.recipe.breakevenOffsetPct ?? null,
    });
  }

  function remember(
    order: SimulatedOrder,
    because?: string,
    fillAt?: "close" | "limit",
  ) {
    const sim = book[order.side];
    const exitBook = sim ? bookForSide(sim, order.atMs, order.price) : null;
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
        fillAt,
      }),
      ...(exitBook ? { exitBook } : {}),
    });
  }

  function flattenSide(
    side: FuturesSide,
    atMs: number,
    fill: number,
    reason: BacktestFillReason,
    because?: string,
  ) {
    const open = book[side];
    if (!open) {
      return;
    }
    const fee = feeUsdt(open.qty, fill, input.feeRate);
    const pnl = unrealized(open.side, open.qty, open.entry, fill) - fee;
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
        side: open.side,
        qty: open.qty,
        price: fill,
        feeUsdt: fee,
        realizedUsdt: pnl,
        reason,
      },
      because,
    );
    book[side] = null;
    clearBookExit(side);
  }

  function reduceSide(
    side: FuturesSide,
    atMs: number,
    fill: number,
    qty: number,
    reason: BacktestFillReason,
  ) {
    const open = book[side];
    if (!open) {
      return;
    }
    const take = Math.min(open.qty, qty);
    if (!(take > 0) || take + 1e-8 >= open.qty) {
      flattenSide(side, atMs, fill, reason);
      return;
    }
    const fee = feeUsdt(take, fill, input.feeRate);
    const pnl = unrealized(side, take, open.entry, fill) - fee;
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
    book[side] = {
      ...open,
      qty: open.qty - take,
      tpsl: open.tpsl ? { ...open.tpsl, stopLoss: null, slQty: null } : null,
    };
    bookLots[side] = reduceOpenLots(bookLots[side], take);
  }

  function clearBookExit(side: FuturesSide) {
    bookLots[side] = [];
    bookArms[side] = emptyExitRuntime();
  }

  function markEquity(price: number) {
    const marked =
      input.startingUsdt +
      realized +
      (book.long
        ? unrealized(book.long.side, book.long.qty, book.long.entry, price)
        : 0) +
      (book.short
        ? unrealized(book.short.side, book.short.qty, book.short.entry, price)
        : 0);
    if (marked > peak) {
      peak = marked;
    }
    const drawdown = peak - marked;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  const addLatches = {
    long: freshFlexAddLatch(),
    short: freshFlexAddLatch(),
  };
  const addRetrace: Record<FuturesSide, PositionRetraceMemory | null> = {
    long: null,
    short: null,
  };
  let barIndex = 0;
  for (const bar of input.bars) {
    barIndex += 1;
    await yieldBacktestReplay(barIndex);
    input.onBar?.(barIndex);
    const price = bar.close;
    if (!(price > 0) || liquidated) {
      if (liquidated) {
        markEquity(0);
      }
      continue;
    }
    if (book.long || book.short) {
      barsIn += 1;
    }
    for (const side of ["long", "short"] as const) {
      const open = book[side];
      if (!open) {
        continue;
      }
      const adverse = open.side === "long" ? bar.low : bar.high;
      const favorable = open.side === "long" ? bar.high : bar.low;
      const quotes = { last: adverse, mark: adverse, index: adverse };
      const actions = perpsSideActions(input.recipe, side);
      const resting = open.tpsl;
      const breakevenStop =
        Boolean(actions) && open.breakevenDone && resting != null && tpslHasLevels(resting);
      const sl =
        resting && tpslHasLevels(resting) && (!actions || breakevenStop)
          ? paperStopLossHit({ side: open.side, tpsl: resting, ...quotes })
          : null;
      const liq = backtestLiquidationPrice({
        side: open.side,
        entry: open.entry,
        qty: open.qty,
        cashUsdt: input.startingUsdt + realized,
        feeRate: input.feeRate,
      });
      const firstHit = firstAdverseFill(open.side, adverse, [
        sl ? { price: sl.price, reason: "stop" } : null,
        liq != null ? { price: liq, reason: "liquidation" } : null,
      ]);
      if (firstHit) {
        if (
          firstHit.reason !== "liquidation" &&
          breakevenStop &&
          resting?.slQty != null &&
          resting.slQty > 0 &&
          resting.slQty + 1e-8 < open.qty
        ) {
          reduceSide(side, bar.timeMs, firstHit.price, resting.slQty, firstHit.reason);
        } else {
          flattenSide(side, bar.timeMs, firstHit.price, firstHit.reason);
        }
        if (firstHit.reason === "liquidation") {
          liquidated = true;
        }
        continue;
      }
      if (actions) {
        const row = book[side];
        if (row) {
          const frames = exitActionTimeframes(actions) as DcaIndicatorTimeframe[];
          const sampled = series.barsAt(barIndex - 1, frames);
          const bars = new Map<string, CandleBar[]>();
          for (const [key, value] of sampled) {
            bars.set(key, value);
          }
          const seeded =
            bookLots[side].length > 0
              ? bookLots[side]
              : [{ id: "position", qty: row.qty, price: row.entry }];
          const settled = evaluateExitActions({
            actions,
            runtime: bookArms[side],
            lots: seeded,
            side,
            mark: price,
            last: price,
            favorable,
            adverse,
            entryPrice: row.entry,
            nowMs: bar.timeMs,
            barsByTimeframe: bars,
            breakevenDone: row.breakevenDone,
          });
          bookArms[side] = settled.runtime;
          bookLots[side] = settled.lots;
          if (settled.breakeven && !row.breakevenDone) {
            moveSimBreakeven(row, settled.breakeven.offsetPct, settled.breakeven.qty);
          }
          for (const claim of settled.claims) {
            const current = book[side];
            if (!current) {
              break;
            }
            const take = Math.min(current.qty, claim.qty);
            if (!(take > 0)) {
              continue;
            }
            if (take + 1e-8 >= current.qty) {
              flattenSide(side, bar.timeMs, price, claimFillReason(claim.kind));
              break;
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
            book[side] = { ...current, qty: current.qty - take };
          }
        }
        continue;
      }
      if (open.trailing && trailingHasStop(open.trailing)) {
        const trail = advanceTrailingOnBar({
          side: open.side,
          trailing: open.trailing,
          favorable,
          adverse,
        });
        open.trailing = { ...open.trailing, peak: trail.peak };
        if (trail.hit && trail.fillPrice != null) {
          flattenSide(side, bar.timeMs, trail.fillPrice, "trailing");
          continue;
        }
      }
      if (
        !liquidated &&
        book[side] &&
        (side === "short" ? shortExitMask : longExitMask)[barIndex - 1]
      ) {
        const exit = perpsExitForSide(
          {
            ...input.recipe,
            exitIf: input.recipe.exitIf ?? null,
            exitHard: hardExitSignalFromJson(input.recipe.exitHard),
          },
          side,
        );
        flattenSide(
          side,
          bar.timeMs,
          price,
          "exit_if",
          formatExitExpressionText({
            filter: exit.exitIf,
            signal: exit.exitHard,
            stack: exit.exitStack,
            side,
          }),
        );
        continue;
      }
      if (open.tpsl && tpslHasLevels(open.tpsl)) {
        const tp = paperTakeProfitHit({
          side: open.side,
          tpsl: open.tpsl,
          last: favorable,
          mark: favorable,
          index: favorable,
        });
        if (tp) {
          flattenSide(side, bar.timeMs, tp.price, "take_profit");
          continue;
        }
      }
    }
    if (liquidated) {
      markEquity(0);
      continue;
    }
    for (const leg of legs) {
      const open = book[leg.side];
      const sideClassic =
        leg.side === "short" && input.recipe.shortEntry?.classic
          ? input.recipe.shortEntry.classic
          : null;
      const breakevenActivationPct = sideClassic
        ? sideClassic.breakevenActivationPct
        : input.recipe.breakevenActivationPct;
      const breakevenOffsetPct = sideClassic
        ? sideClassic.breakevenOffsetPct
        : input.recipe.breakevenOffsetPct;
      const sideActions = perpsSideActions(input.recipe, leg.side);
      if (
        open &&
        !sideActions &&
        futuresBreakevenDue({
          side: leg.side,
          qty: open.qty,
          entryPrice: open.entry,
          mark: price,
          activationPct: breakevenActivationPct,
          done: open.breakevenDone,
        })
      ) {
        const stop = futuresBreakevenStop({
          side: leg.side,
          entryPrice: open.entry,
          currentStop: open.tpsl?.stopLoss ?? null,
          offsetPct: breakevenOffsetPct,
        });
        if (stop != null && stop > 0) {
          open.tpsl = {
            takeProfit: open.tpsl?.takeProfit ?? null,
            stopLoss: stop,
            tpTrigger: open.tpsl?.tpTrigger ?? "last",
            slTrigger: open.tpsl?.slTrigger ?? "last",
            mode: open.tpsl?.mode ?? "full",
            tpQty: open.tpsl?.tpQty ?? null,
            slQty: open.tpsl?.slQty ?? null,
            tpOrderType: open.tpsl?.tpOrderType ?? "market",
            slOrderType: "market",
            tpLimitPrice: open.tpsl?.tpLimitPrice ?? null,
            slLimitPrice: null,
          };
          open.breakevenDone = true;
        }
      }
      const conditionMet =
        (leg.side === "short" ? shortEntryMask : longEntryMask)[barIndex - 1] ===
        true;
      const decision = decideFuturesAutomationTick({
        conditionMet,
        wasTrue: leg.wasTrue,
        action: leg.side === "short" ? "sell" : "buy",
        mode: "active",
        bookReduceOnly: false,
        skipIfOpen: leg.skipIfOpen,
        hasOpenOnSide: Boolean(book[leg.side]),
      });
      leg.wasTrue = decision.nextTrue;
      if (!decision.fire) {
        continue;
      }
      const qty = sizeAtPrice(input.recipe, price, leg.side);
      if (!(qty > 0)) {
        continue;
      }
      const fee = feeUsdt(qty, price, input.feeRate);
      const leverage = normalizeBacktestLeverage(input.leverage);
      const locked =
        (book.long ? backtestMarginUsdt(book.long.qty * book.long.entry, leverage) : 0) +
        (book.short
          ? backtestMarginUsdt(book.short.qty * book.short.entry, leverage)
          : 0);
      const available = input.startingUsdt + realized - locked;
      const because = perpsLegBecause({
        entrySource: leg.entrySource,
        triggerBy: leg.triggerBy,
        triggerCompare: leg.triggerCompare,
        triggerPrice: leg.triggerPrice,
        indicator: leg.indicator,
        confirm: leg.confirm,
        entryStack: leg.entryStack,
        retrace: leg.side === "short" ? short.retrace : input.recipe.retrace,
        side: leg.side,
        price,
        barsByTimeframe: series.barsAt(barIndex - 1, conditionTimeframes),
      });
      if (backtestMarginUsdt(qty * price, leverage) + fee > available) {
        events.push({
          atMs: bar.timeMs,
          kind: "skipped",
          reason: "entry",
          orderIndex: null,
          side: leg.side,
          text: skippedEntrySentence(leg.side, because),
        });
        continue;
      }
      realized -= fee;
      remember(
        {
          atMs: bar.timeMs,
          action: leg.side === "short" ? "sell" : "buy",
          side: leg.side,
          qty,
          price,
          feeUsdt: fee,
          realizedUsdt: -fee,
          reason: "entry",
        },
        because,
      );
      const openingActions = perpsSideActions(input.recipe, leg.side);
      book[leg.side] = mergeSimPosition(
        book[leg.side],
        leg.side,
        qty,
        price,
        openingActions ? null : sideClassic ? sideClassic.tpsl : input.recipe.tpsl,
        openingActions
          ? null
          : sideClassic
            ? sideClassic.trailing
            : input.recipe.trailing,
        bar.timeMs,
      );
      if (openingActions) {
        bookLots[leg.side].push({ id: `entry-${orders.length}`, qty, price });
      }
    }
    for (const side of ["long", "short"] as const) {
      const positioned = book[side];
      const stack = side === "short" ? short.addStack : input.recipe.addStack;
      const latch = addLatches[side];
      addRetrace[side] = nextOpenRetrace(addRetrace[side], positioned, bar);
      const detail =
        positioned && stack && stack.leaves.length > 0 && addRetrace[side]
          ? series.addDetail(
              stack,
              side,
              barIndex - 1,
              protectionReading(
                positioned.qty,
                bookForSide(positioned, bar.timeMs, price),
              ),
              { average: positioned.entry, memory: addRetrace[side] },
            )
          : { met: false, group: null, because: "" };
      const intent = flexAddIntent({
        stack,
        detail,
        latch,
        open: Boolean(positioned),
        bar,
      });
      if (!intent || !positioned) {
        continue;
      }
      const addFee = feeUsdt(intent.qty, intent.price, input.feeRate);
      const leverage = normalizeBacktestLeverage(input.leverage);
      const locked =
        (book.long
          ? backtestMarginUsdt(book.long.qty * book.long.entry, leverage)
          : 0) +
        (book.short
          ? backtestMarginUsdt(book.short.qty * book.short.entry, leverage)
          : 0);
      const available = input.startingUsdt + realized - locked;
      const clipIndex = flexAddClipIndex(orders, side);
      if (
        backtestMarginUsdt(intent.qty * intent.price, leverage) + addFee <=
        available
      ) {
        realized -= addFee;
        latch.limitArmed = false;
        latch.skipNoted = false;
        remember(
          {
            atMs: bar.timeMs,
            action: side === "short" ? "sell" : "buy",
            side,
            qty: intent.qty,
            price: intent.price,
            feeUsdt: addFee,
            realizedUsdt: -addFee,
            reason: "clip",
            clipIndex,
          },
          intent.because,
          intent.limit ? "limit" : "close",
        );
        const openingActions = perpsSideActions(input.recipe, side);
        const sideClassic =
          side === "short" ? input.recipe.shortEntry?.classic : null;
        book[side] = mergeSimPosition(
          positioned,
          side,
          intent.qty,
          intent.price,
          openingActions ? null : sideClassic ? sideClassic.tpsl : input.recipe.tpsl,
          openingActions
            ? null
            : sideClassic
              ? sideClassic.trailing
              : input.recipe.trailing,
          bar.timeMs,
        );
        if (openingActions) {
          bookLots[side].push({
            id: `add-${orders.length}`,
            qty: intent.qty,
            price: intent.price,
          });
        }
        if (addRetrace[side] && stack && detail.group != null) {
          const leaves = addStackGroups(stack)[detail.group] ?? [];
          addRetrace[side] = commitPositionRetraceFire(addRetrace[side], leaves);
          if (positionRetraceConsumed(leaves)) {
            latch.was = false;
          }
        }
      } else if (!latch.skipNoted) {
        latch.skipNoted = true;
        events.push({
          atMs: bar.timeMs,
          kind: "skipped",
          reason: "clip",
          orderIndex: null,
          side,
          clipIndex,
          text: skippedAddSentence(side, intent.because),
        });
      }
    }
    markEquity(price);
  }

  const last = input.bars[input.bars.length - 1];
  const markUsdt =
    last == null
      ? 0
      : (book.long
          ? unrealized(book.long.side, book.long.qty, book.long.entry, last.close)
          : 0) +
        (book.short
          ? unrealized(
              book.short.side,
              book.short.qty,
              book.short.entry,
              last.close,
            )
          : 0);
  const open = book.long ?? book.short;
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
      openQty: (book.long?.qty ?? 0) + (book.short?.qty ?? 0),
      openSide: book.long && book.short ? "long" : (open?.side ?? null),
      markUsdt,
      lastPrice: last?.close ?? null,
      startingUsdt: input.startingUsdt,
    }),
  };
}
