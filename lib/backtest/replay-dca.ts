import {
  decideDcaTick,
  dcaArmTriggerForSide,
  dcaCycleClipSize,
  dcaEnabledSides,
  dcaIndicatorStartForSide,
  dcaTickValueCapUsdt,
  IDLE_DCA_LEG,
  type DcaLegState,
} from "@/lib/dca/playbook";
import { resampleClosesForTimeframe } from "@/lib/dca/indicators";
import { dcaClipQtyAt, dcaPlannedExits, dcaTrailingDistance } from "@/lib/dca/grid";
import { dcaRecipeToConfig, type DcaTemplateRecipe } from "@/lib/templates/recipe";
import type { FuturesSide } from "@/lib/futures/model";
import {
  armTrailingAt,
  paperTrailingAdvance,
  type FuturesTrailing,
} from "@/lib/futures/trailing";
import type { CandleBar } from "@/lib/market/candles";
import {
  backtestMarginUsdt,
  emptyBacktestStats,
  finishBacktestStats,
  normalizeBacktestLeverage,
  type BacktestFillReason,
  type BacktestStats,
  type SimulatedOrder,
  backtestTapeInterval,
} from "./model";

export function canBacktestDcaRecipe(
  recipe: DcaTemplateRecipe,
): { ok: true } | { ok: false; error: string } {
  if (recipe.startKind === "webhook") {
    return {
      ok: false,
      error: "Webhook-start DCA cannot be backtested. Use price, indicator, or immediate.",
    };
  }
  const hasClip = recipe.clipSize > 0;
  const hasBudget =
    recipe.maxValue != null &&
    recipe.maxValue > 0 &&
    recipe.maxClips != null &&
    recipe.maxClips > 0;
  if (!hasClip && !hasBudget) {
    return { ok: false, error: "This DCA bot needs a clip size." };
  }
  return { ok: true };
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

type SimLeg = DcaLegState & {
  qty: number;
  entry: number;
  trailing: FuturesTrailing | null;
  slPrice: number | null;
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
    armTrue: false,
    disarmTrue: false,
    indicatorTrue: false,
    cycleClipSize: null,
  };
}

export function replayDcaPlaybook(input: {
  bars: CandleBar[];
  recipe: DcaTemplateRecipe;
  feeRate: number;
  startingUsdt: number;
  leverage?: number;
}): { orders: SimulatedOrder[]; stats: BacktestStats } {
  const allowed = canBacktestDcaRecipe(input.recipe);
  if (!allowed.ok) {
    return { orders: [], stats: emptyBacktestStats(input.startingUsdt) };
  }
  const built = dcaRecipeToConfig(input.recipe, { venue: "bybit" });
  if (!built.ok) {
    return { orders: [], stats: emptyBacktestStats(input.startingUsdt) };
  }
  const config = built.config;
  const sides = dcaEnabledSides(config.direction);
  const splitSides = config.direction === "both";
  const legs: Record<FuturesSide, SimLeg> = {
    long: emptyLeg(),
    short: emptyLeg(),
  };
  const orders: SimulatedOrder[] = [];
  let realized = 0;
  let wins = 0;
  let trades = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let peak = input.startingUsdt;
  let maxDrawdown = 0;
  let barsIn = 0;
  const closes: number[] = [];

  function flatten(
    side: FuturesSide,
    atMs: number,
    fill: number,
    rearm: boolean,
    reason: BacktestFillReason,
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
    orders.push({
      atMs,
      action: "flatten",
      side,
      qty: leg.qty,
      price: fill,
      feeUsdt: fee,
      realizedUsdt: pnl,
      reason,
    });
    legs[side] = rearm ? emptyLeg() : { ...emptyLeg(), status: "idle" };
  }

  function addClip(side: FuturesSide, atMs: number, price: number) {
    const leg = legs[side];
    const firstClip = leg.clipsFilled === 0;
    const sized = firstClip
      ? dcaCycleClipSize({
          kind: config.maxValueKind,
          maxValue: config.maxValue,
          maxClips: config.maxClips,
          clipSize: config.clipSize,
          sizeMultiplier: config.sizeMultiplier,
          sizeUnit: config.sizeUnit,
          bookUsdt: input.startingUsdt + realized,
          mark: price,
        })
      : {
          clipSize: leg.cycleClipSize ?? config.clipSize,
          cycleMaxValue: leg.cycleMaxValue,
        };
    const qty = dcaClipQtyAt(
      leg.clipsFilled,
      sized.clipSize,
      config.sizeMultiplier,
      config.sizeUnit,
      price,
    );
    if (!(qty > 0)) {
      return;
    }
    const fee = feeUsdt(qty, price, input.feeRate);
    const leverage = normalizeBacktestLeverage(input.leverage);
    const locked = Object.values(legs).reduce(
      (sum, row) => sum + backtestMarginUsdt(row.qty * row.entry, leverage),
      0,
    );
    const available = input.startingUsdt + realized - locked;
    if (backtestMarginUsdt(qty * price, leverage) + fee > available) {
      return;
    }
    realized -= fee;
    const action = side === "short" ? "sell" : "buy";
    const clipIndex = leg.clipsFilled + 1;
    orders.push({
      atMs,
      action,
      side,
      qty,
      price,
      feeUsdt: fee,
      realizedUsdt: -fee,
      reason: firstClip ? "entry" : "clip",
      clipIndex,
    });
    const nextQty = leg.qty + qty;
    const entry =
      nextQty > 0 ? (leg.entry * leg.qty + price * qty) / nextQty : price;
    let trailing = leg.trailing;
    if (config.trailingPct != null && config.trailingPct > 0) {
      const distance = dcaTrailingDistance(price, config.trailingPct);
      trailing = armTrailingAt(
        {
          distance,
          activePrice:
            config.trailingTriggerPct == null
              ? null
              : side === "long"
                ? price * (1 + config.trailingTriggerPct / 100)
                : price * (1 - config.trailingTriggerPct / 100),
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

  for (const bar of input.bars) {
    const price = bar.close;
    if (!(price > 0)) {
      continue;
    }
    closes.push(price);
    const window = closes.slice(-80);
    const triggerPrices = { last: price, mark: price, index: price };
    let held = false;
    for (const side of sides) {
      const leg = legs[side];
      if (leg.qty > 0) {
        held = true;
        const adverse = side === "long" ? bar.low : bar.high;
        if (leg.slPrice != null) {
          const hit =
            side === "long" ? adverse <= leg.slPrice : adverse >= leg.slPrice;
          if (hit) {
            flatten(side, bar.timeMs, leg.slPrice, true, "stop");
            continue;
          }
        }
        if (leg.trailing) {
          const trail = paperTrailingAdvance({
            side,
            trailing: leg.trailing,
            last: adverse,
          });
          legs[side] = { ...leg, trailing: { ...leg.trailing, peak: trail.peak } };
          if (trail.hit && trail.fillPrice != null) {
            flatten(side, bar.timeMs, trail.fillPrice, true, "trailing");
            continue;
          }
        }
        if (config.stopLossPct != null && config.stopLossPct > 0) {
          const planned = dcaPlannedExits({
            side,
            entryPrice: leg.entry,
            firstFillPrice: leg.firstFillPrice,
            mark: price,
            takeProfitPct: config.takeProfitPct,
            stopLossPct: config.stopLossPct,
            takeProfitBasis: config.takeProfitBasis,
            stopLossBasis: config.stopLossBasis,
            trailingPct: config.trailingPct,
          });
          if (planned.stopLoss != null) {
            const hit =
              side === "long"
                ? adverse <= planned.stopLoss
                : adverse >= planned.stopLoss;
            if (hit) {
              flatten(side, bar.timeMs, planned.stopLoss, true, "stop");
              continue;
            }
          }
        }
      }
      const live = legs[side];
      const indicatorStart = dcaIndicatorStartForSide(config, side);
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
        startKind: config.startKind,
        dcaMode: config.dcaMode,
        dipPct: config.dipPct,
        intervalMinutes: config.intervalMinutes,
        deviationMultiplier: config.deviationMultiplier,
        clipsFilled: live.clipsFilled,
        maxClips: config.maxClips,
        maxValue: dcaTickValueCapUsdt({
          kind: config.maxValueKind,
          maxValue: config.maxValue,
          cycleMaxValue: live.cycleMaxValue,
          bookUsdt: input.startingUsdt + realized,
        }),
        positionQty: live.qty > 0 ? live.qty : null,
        entryPrice: live.qty > 0 ? live.entry : null,
        takeProfitPct: config.takeProfitPct,
        stopLossPct: config.stopLossPct,
        takeProfitBasis: config.takeProfitBasis,
        stopLossBasis: config.stopLossBasis,
        breakevenActivationPct: config.breakevenActivationPct,
        breakevenDone: live.breakevenDone,
        armTrigger: dcaArmTriggerForSide(config, side),
        armConditionTrue: live.armTrue,
        disarmTrigger: config.disarmTrigger,
        disarmConditionTrue: live.disarmTrue,
        indicatorKind: indicatorStart?.kind ?? null,
        indicatorCompare: indicatorStart?.compare ?? null,
        indicatorLevel: indicatorStart?.level ?? null,
        indicatorConditionTrue: live.indicatorTrue,
        splitIndicatorSides:
          splitSides &&
          !config.shortIndicatorKind &&
          !config.shortArmTrigger,
        closes: indicatorStart
          ? resampleClosesForTimeframe(
              window,
              backtestTapeInterval(input.recipe, 1, 2),
              indicatorStart.timeframe,
            )
          : window,
        takeProfitOrderType: config.takeProfitOrderType,
        tpLimitResting: false,
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
      if (
        starting &&
        splitSides &&
        legs[side === "long" ? "short" : "long"].qty > 0
      ) {
        continue;
      }
      if (decision.action.kind === "arm" || decision.action.kind === "clip") {
        addClip(side, bar.timeMs, price);
      } else if (decision.action.kind === "close") {
        flatten(
          side,
          bar.timeMs,
          price,
          true,
          decision.action.reason === "stop_loss" ? "stop" : "take_profit",
        );
      } else if (decision.action.kind === "disarm") {
        if (legs[side].qty > 0) {
          legs[side] = { ...legs[side], status: "stop_adding" };
        } else {
          legs[side] = { ...emptyLeg(), status: "idle" };
        }
      } else if (decision.action.kind === "end_cycle") {
        flatten(side, bar.timeMs, price, true, "close");
      } else if (decision.action.kind === "stop_adding") {
        legs[side] = { ...legs[side], status: "stop_adding" };
      } else if (decision.action.kind === "breakeven") {
        const offset = config.breakevenOffsetPct ?? 0;
        const sl =
          side === "long"
            ? live.entry * (1 + offset / 100)
            : live.entry * (1 - offset / 100);
        legs[side] = { ...live, breakevenDone: true, slPrice: sl };
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

  return {
    orders,
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
      startingUsdt: input.startingUsdt,
    }),
  };
}
