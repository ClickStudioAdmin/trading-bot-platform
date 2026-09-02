import { decideFuturesAutomationTick } from "@/lib/futures/automation";
import { triggerConditionMet } from "@/lib/futures/automation";
import type { FuturesAction, FuturesSide } from "@/lib/futures/model";
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
  backtestMarginUsdt,
  emptyBacktestStats,
  finishBacktestStats,
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
    };
  }
  return {
    side,
    qty,
    entry: price,
    tpsl,
    trailing: trailing ? armTrailingAt(trailing, price) : null,
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
  const trigger = Number(
    String(input.recipe.triggerPrice).replace(/,/g, "").trim(),
  );
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
    if (open) {
      barsIn += 1;
      const adverse = open.side === "long" ? bar.low : bar.high;
      const favorable = open.side === "long" ? bar.high : bar.low;
      const quotes = {
        last: adverse,
        mark: adverse,
        index: adverse,
      };
      if (open.tpsl && tpslHasLevels(open.tpsl)) {
        const sl = paperStopLossHit({
          side: open.side,
          tpsl: open.tpsl,
          ...quotes,
        });
        if (sl) {
          flattenOpen(bar.timeMs, sl.price, "stop");
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
    }
    const conditionMet = triggerConditionMet(
      price,
      input.recipe.triggerCompare,
      trigger,
    );
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
      startingUsdt: input.startingUsdt,
    }),
  };
}
