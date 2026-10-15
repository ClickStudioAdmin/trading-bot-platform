import { decideFuturesAutomationTick } from "@/lib/futures/automation";
import {
  futuresBreakevenDue,
  futuresBreakevenStop,
  futuresEntryConditionMet,
  futuresFilterMet,
} from "@/lib/futures/conditions";
import type { FuturesAction, FuturesSide } from "@/lib/futures/model";
import {
  resampleBarsForTimeframe,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import {
  formatStrategyLeafReason,
} from "@/lib/bots/condition-copy";
import { hardExitMet, hardExitSignalFromJson } from "@/lib/dca/hard-exit";
import { exitExpressionMet, formatExitExpressionText } from "@/lib/dca/exit-stack";
import { canBacktestPerpsRecipe } from "./eligibility";
import { backtestTapeInterval } from "./model";
import {
  paperStopLossHit,
  paperTakeProfitHit,
  resolveFuturesTpslPrices,
  tpslHasLevels,
  type FuturesTpsl,
} from "@/lib/futures/tpsl";
import {
  armTrailingAt,
  paperTrailingAdvance,
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
import { fillSentence, skippedEntrySentence } from "./events";
import type { ReplayEvent } from "./model";
import {
  entryStackIsLegacy,
  resolveEntryStack,
  strategyLeafTimeframe,
} from "@/lib/strategy/expr";
import { filterBecause, indicatorBecause, priceStartBecause } from "./explain";

export { canBacktestPerpsRecipe };

function perpsHardExitMet(
  recipe: PerpsTemplateRecipe,
  side: FuturesSide,
  price: number,
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>,
): boolean {
  const signal = hardExitSignalFromJson(recipe.exitHard);
  return exitExpressionMet({
    first: signal
      ? hardExitMet({
          signal,
          side,
          prices: { last: price, mark: price, index: price },
        })
      : Boolean(recipe.exitIf) &&
        futuresFilterMet({
          spec: recipe.exitIf,
          side,
          barsByTimeframe,
        }),
    stack: recipe.exitStack,
    side,
    price,
    prices: { last: price, mark: price, index: price },
    barsByTimeframe,
    firedWebhookId: null,
  });
}

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

function sizeAtPrice(recipe: PerpsTemplateRecipe, price: number): number {
  const size = Number(String(recipe.size).replace(/,/g, "").trim());
  if (!(size > 0) || !(price > 0)) {
    return 0;
  }
  return recipe.sizeUnit === "usdt" ? size / price : size;
}

type OpenSim = {
  side: FuturesSide;
  qty: number;
  entry: number;
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
      tpsl: current.tpsl ?? nextTpsl,
      trailing: current.trailing ?? trailing,
      breakevenDone: current.breakevenDone,
    };
  }
  return {
    side,
    qty,
    entry: price,
    tpsl: nextTpsl,
    trailing: trailing ? armTrailingAt(trailing, price) : null,
    breakevenDone: false,
  };
}

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

function replayBarsByTimeframe(
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
  let wasTrue = false;
  let open: OpenSim | null = null;
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

  function remember(order: SimulatedOrder, because?: string) {
    const orderIndex = orders.length;
    orders.push(order);
    events.push({
      atMs: order.atMs,
      kind: "fill",
      reason: order.reason ?? "close",
      orderIndex,
      side: order.side,
      text: fillSentence({
        reason: order.reason ?? "close",
        side: order.side,
        price: order.price,
        because,
      }),
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

  let barIndex = 0;
  for (const bar of input.bars) {
    barIndex += 1;
    await yieldBacktestReplay(barIndex);
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
      const sl =
        open.tpsl && tpslHasLevels(open.tpsl)
          ? paperStopLossHit({
              side: open.side,
              tpsl: open.tpsl,
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
        } else {
          flattenOpen(bar.timeMs, firstHit.price, firstHit.reason);
        }
      }
      if (open?.trailing && trailingHasStop(open.trailing)) {
        const trail = paperTrailingAdvance({
          side: open.side,
          trailing: open.trailing,
          last: adverse,
        });
        open.trailing = { ...open.trailing, peak: trail.peak };
        if (trail.hit && trail.fillPrice != null) {
          flattenOpen(bar.timeMs, trail.fillPrice, "trailing");
        }
      }
      const barsByTimeframe = replayBarsByTimeframe(
        input.bars.slice(0, input.bars.indexOf(bar) + 1),
        tape,
        conditionTimeframes,
      );
      if (
        open &&
        perpsHardExitMet(input.recipe, open.side, price, barsByTimeframe)
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
      if (open?.tpsl && tpslHasLevels(open.tpsl)) {
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
    const barsByTimeframe = replayBarsByTimeframe(
      input.bars.slice(0, input.bars.indexOf(bar) + 1),
      tape,
      conditionTimeframes,
    );
    const side: FuturesSide =
      action === "flatten"
        ? (closeSide ?? "long")
        : action === "sell"
          ? "short"
          : "long";
    const conditionMet = futuresEntryConditionMet({
      rule: {
        entrySource: input.recipe.entrySource,
        indicator: input.recipe.indicator,
        confirm: input.recipe.confirm,
        entryStack: input.recipe.entryStack,
        triggerCompare: input.recipe.triggerCompare,
        triggerPrice: Number(
          String(input.recipe.triggerPrice).replace(/,/g, "").trim(),
        ),
      },
      side,
      price,
      barsByTimeframe,
    });
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
          const because = perpsEntryBecause(side, price, barsByTimeframe);
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
            open = mergeSimPosition(
              open,
              side,
              qty,
              price,
              input.recipe.tpsl,
              input.recipe.trailing,
            );
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
    const stack = resolveEntryStack(
      input.recipe.entryStack,
      input.recipe.confirm,
    );
    const stackBecause = entryStackIsLegacy(stack)
      ? ""
      : stack.leaves
          .map((leaf, index) => {
            const text = formatStrategyLeafReason(leaf, side);
            const join = stack.joins[index] === "or" ? "Or" : "And";
            return text ? `${join} ${text}` : "";
          })
          .filter(Boolean)
          .join(" ");
    if (input.recipe.entrySource === "price") {
      const level = Number(String(input.recipe.triggerPrice).replace(/,/g, ""));
      return [
        priceStartBecause(
          {
            triggerBy: input.recipe.triggerBy,
            compare: input.recipe.triggerCompare,
            price: level,
          },
          price,
        ),
        stackBecause,
      ]
        .filter(Boolean)
        .join(" ");
    }
    const start = input.recipe.indicator;
    if (!start) {
      return stackBecause;
    }
    const bars = barsByTimeframe.get(start.timeframe) ?? [];
    return [
      indicatorBecause({
        kind: start.kind,
        compare: start.compare,
        level: start.level,
        period: start.period,
        slowPeriod: start.slowPeriod,
        multiplier: start.multiplier ?? null,
        timeframe: start.timeframe,
        side,
        closes: bars.map((row) => row.close),
        bars,
      }),
      filterBecause(input.recipe.confirm, side, "Confirm"),
      stackBecause,
    ]
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
  ].filter((row): row is DcaIndicatorTimeframe => Boolean(row));
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

  function remember(order: SimulatedOrder) {
    const orderIndex = orders.length;
    orders.push(order);
    events.push({
      atMs: order.atMs,
      kind: "fill",
      reason: order.reason ?? "close",
      orderIndex,
      side: order.side,
      text: fillSentence({
        reason: order.reason ?? "close",
        side: order.side,
        price: order.price,
      }),
    });
  }

  function flattenSide(
    side: FuturesSide,
    atMs: number,
    fill: number,
    reason: BacktestFillReason,
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
    remember({
      atMs,
      action: "flatten",
      side: open.side,
      qty: open.qty,
      price: fill,
      feeUsdt: fee,
      realizedUsdt: pnl,
      reason,
    });
    book[side] = null;
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

  let barIndex = 0;
  for (const bar of input.bars) {
    barIndex += 1;
    await yieldBacktestReplay(barIndex);
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
    const barsByTimeframe = replayBarsByTimeframe(
      input.bars.slice(0, input.bars.indexOf(bar) + 1),
      tape,
      conditionTimeframes,
    );
    for (const side of ["long", "short"] as const) {
      const open = book[side];
      if (!open) {
        continue;
      }
      const adverse = open.side === "long" ? bar.low : bar.high;
      const favorable = open.side === "long" ? bar.high : bar.low;
      const quotes = { last: adverse, mark: adverse, index: adverse };
      const sl =
        open.tpsl && tpslHasLevels(open.tpsl)
          ? paperStopLossHit({ side: open.side, tpsl: open.tpsl, ...quotes })
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
        flattenSide(side, bar.timeMs, firstHit.price, firstHit.reason);
        if (firstHit.reason === "liquidation") {
          liquidated = true;
        }
        continue;
      }
      if (open.trailing && trailingHasStop(open.trailing)) {
        const trail = paperTrailingAdvance({
          side: open.side,
          trailing: open.trailing,
          last: adverse,
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
        perpsHardExitMet(input.recipe, side, price, barsByTimeframe)
      ) {
        flattenSide(side, bar.timeMs, price, "exit_if");
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
      if (
        open &&
        futuresBreakevenDue({
          side: leg.side,
          qty: open.qty,
          entryPrice: open.entry,
          mark: price,
          activationPct: input.recipe.breakevenActivationPct,
          done: open.breakevenDone,
        })
      ) {
        const stop = futuresBreakevenStop({
          side: leg.side,
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
      const conditionMet = futuresEntryConditionMet({
        rule: {
          entrySource: leg.entrySource,
          indicator: leg.indicator,
          confirm: leg.confirm,
          entryStack: leg.entryStack,
          triggerCompare: leg.triggerCompare,
          triggerPrice: leg.triggerPrice,
        },
        side: leg.side,
        price,
        barsByTimeframe,
      });
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
      const qty = sizeAtPrice(input.recipe, price);
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
      if (backtestMarginUsdt(qty * price, leverage) + fee > available) {
        events.push({
          atMs: bar.timeMs,
          kind: "skipped",
          reason: "entry",
          orderIndex: null,
          side: leg.side,
          text: skippedEntrySentence(leg.side),
        });
        continue;
      }
      realized -= fee;
      remember({
        atMs: bar.timeMs,
        action: leg.side === "short" ? "sell" : "buy",
        side: leg.side,
        qty,
        price,
        feeUsdt: fee,
        realizedUsdt: -fee,
        reason: "entry",
      });
      book[leg.side] = mergeSimPosition(
        book[leg.side],
        leg.side,
        qty,
        price,
        input.recipe.tpsl,
        input.recipe.trailing,
      );
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
