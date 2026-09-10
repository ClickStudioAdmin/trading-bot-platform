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
import { backtestTapeInterval } from "./model";
import {
  paperStopLossHit,
  paperTakeProfitHit,
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
} from "./model";

export function canBacktestPerpsRecipe(
  recipe: PerpsTemplateRecipe,
): { ok: true } | { ok: false; error: string } {
  if (recipe.entrySource === "webhook") {
    return {
      ok: false,
      error: "Webhook-entry bots cannot be backtested. Use a price When.",
    };
  }
  const size = Number(String(recipe.size).replace(/,/g, "").trim());
  if (!(size > 0)) {
    return { ok: false, error: "This bot needs a size before it can replay." };
  }
  if (recipe.entrySource === "indicator" || recipe.entrySource === "trend") {
    if (!recipe.indicator?.kind || !recipe.indicator.timeframe) {
      return { ok: false, error: "This bot needs Indicator or Trend settings." };
    }
    return { ok: true };
  }
  const trigger = Number(String(recipe.triggerPrice).replace(/,/g, "").trim());
  if (!(trigger > 0)) {
    return { ok: false, error: "This bot needs a When price." };
  }
  return { ok: true };
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
  if (current && current.side === side) {
    const nextQty = current.qty + qty;
    return {
      side,
      qty: nextQty,
      entry: (current.entry * current.qty + price * qty) / nextQty,
      tpsl: current.tpsl ?? tpsl,
      trailing: current.trailing ?? trailing,
      breakevenDone: current.breakevenDone,
    };
  }
  return {
    side,
    qty,
    entry: price,
    tpsl,
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

export function replayPerpsPriceCross(input: {
  bars: CandleBar[];
  recipe: PerpsTemplateRecipe;
  feeRate: number;
  startingUsdt: number;
  leverage?: number;
}): { orders: SimulatedOrder[]; stats: BacktestStats } {
  const allowed = canBacktestPerpsRecipe(input.recipe);
  if (!allowed.ok) {
    return { orders: [], stats: emptyBacktestStats(input.startingUsdt) };
  }
  const { action, closeSide } = recipeAction(input.recipe);
  const tape = backtestTapeInterval(input.recipe, 1, 2);
  const conditionTimeframes = [
    input.recipe.indicator?.timeframe,
    input.recipe.confirm?.timeframe,
    input.recipe.exitIf?.timeframe,
  ].filter((row): row is DcaIndicatorTimeframe => Boolean(row));
  let wasTrue = false;
  let open: OpenSim | null = null;
  const orders: SimulatedOrder[] = [];
  let realized = 0;
  let wins = 0;
  let trades = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let peak = input.startingUsdt;
  let maxDrawdown = 0;
  let barsIn = 0;
  let liquidated = false;

  function flattenOpen(atMs: number, fill: number, reason: BacktestFillReason) {
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
    orders.push({
      atMs,
      action: "flatten",
      side: open.side,
      qty: open.qty,
      price: fill,
      feeUsdt: fee,
      realizedUsdt: pnl,
      reason,
    });
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

  for (const bar of input.bars) {
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
      const barsByTimeframe = replayBarsByTimeframe(
        input.bars.slice(0, input.bars.indexOf(bar) + 1),
        tape,
        conditionTimeframes,
      );
      if (
        open &&
        input.recipe.exitIf &&
        futuresFilterMet({
          spec: input.recipe.exitIf,
          side: open.side,
          barsByTimeframe,
        })
      ) {
        flattenOpen(bar.timeMs, price, "exit_if");
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
          if (backtestMarginUsdt(qty * price, leverage) + fee <= available) {
            realized -= fee;
            orders.push({
              atMs: bar.timeMs,
              action,
              side,
              qty,
              price,
              feeUsdt: fee,
              realizedUsdt: -fee,
              reason: "entry",
            });
            open = mergeSimPosition(
              open,
              side,
              qty,
              price,
              input.recipe.tpsl,
              input.recipe.trailing,
            );
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

  return {
    orders,
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
