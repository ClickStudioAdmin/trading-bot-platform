import { groupBacktestOrdersIntoCycles } from "@/lib/backtest/positions";
import {
  resampleBarsForTimeframe,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import { dcaPlannedExits } from "@/lib/dca/grid";
import type { HardExitDraft } from "@/lib/dca/hard-exit";
import { futuresBreakevenStop } from "@/lib/futures/conditions";
import type { FuturesSide } from "@/lib/futures/model";
import { advanceTrailingOnBar, type FuturesTrailing } from "@/lib/futures/trailing";
import type { FuturesTpsl } from "@/lib/futures/tpsl";
import type { CandleBar } from "@/lib/market/candles";
import {
  addStackGroups,
  strategyLeafTimeframe,
  type EntryStack,
  type StrategyLeaf,
} from "@/lib/strategy/expr";
import {
  actionUsesLotReference,
  dcaClassicActions,
  sideExitActions,
  type StoredExitAction,
} from "@/lib/strategy/exit-actions";
import {
  retraceLevelPrice,
  windowRetraceSpec,
  type RetraceSpec,
} from "@/lib/strategy/retrace";
import type { PerpsTemplateRecipe } from "@/lib/templates/recipe";
import type { BacktestRecipe, SimulatedOrder } from "./model";

type ChartLot = { price: number; atMs: number };

export type ConditionOrderLevel = {
  id: string;
  price: number;
  title: string;
  side: FuturesSide;
  role: "exit" | "add";
};

export function conditionOrderTimeframes(
  recipe: BacktestRecipe,
): DcaIndicatorTimeframe[] {
  const frames = new Set<DcaIndicatorTimeframe>();
  if (recipe.kind === "flex") {
    collectStackFrames(frames, recipe.exitStack);
    collectStackFrames(frames, recipe.shortEntry?.exitStack);
    for (const action of [
      ...(recipe.exitActions ?? []),
      ...(recipe.shortEntry?.actions ?? []),
    ]) {
      for (const group of action.groups) {
        for (const draft of [group.anchor, ...group.rows]) {
          if (draft.trigger === "retrace") {
            frames.add(draft.timeframe);
          }
        }
      }
    }
  }
  if (recipe.kind === "dca") {
    collectStackFrames(frames, recipe.exitStack);
    collectStackFrames(frames, recipe.shortExitStack);
  }
  return [...frames];
}

function chartLots(orders: readonly SimulatedOrder[], side: FuturesSide): ChartLot[] {
  const entryAction = side === "long" ? "buy" : "sell";
  const lots: { qty: number; price: number; atMs: number }[] = [];
  for (const order of orders) {
    if (order.action === entryAction && order.price > 0 && order.qty > 0) {
      lots.push({ qty: order.qty, price: order.price, atMs: order.atMs });
      continue;
    }
    if (order.action !== "flatten" || !(order.qty > 0)) {
      continue;
    }
    let left = order.qty;
    for (const lot of lots) {
      if (!(left > 0)) {
        break;
      }
      const used = Math.min(lot.qty, left);
      lot.qty -= used;
      left -= used;
    }
  }
  return lots.filter((lot) => lot.qty > 0).map((lot) => ({ price: lot.price, atMs: lot.atMs }));
}

/** Horizontal prices for the open position at the replay head. */
export function conditionOrderLevels(input: {
  recipe: BacktestRecipe;
  orders: readonly SimulatedOrder[];
  candles: readonly CandleBar[];
  tape: DcaIndicatorTimeframe;
  barsByTimeframe?: ReadonlyMap<string, readonly CandleBar[]>;
}): ConditionOrderLevel[] {
  const open = groupBacktestOrdersIntoCycles([...input.orders]).open;
  if (open.length === 0 || input.candles.length === 0) {
    return [];
  }
  const levels: ConditionOrderLevel[] = [];
  for (const cycle of open) {
    if (!(cycle.qty > 0) || !(cycle.entryPrice > 0)) {
      continue;
    }
    const since = input.candles.filter((bar) => bar.timeMs >= cycle.openedAtMs);
    const recipe = input.recipe;
    const lots = chartLots(cycle.orders, cycle.side);
    if (recipe.kind === "flex") {
      flexLevels(
        levels,
        { ...input, recipe },
        cycle.side,
        cycle.entryPrice,
        since,
        lots,
      );
    } else {
      dcaLevels(
        levels,
        { ...input, recipe },
        cycle.side,
        cycle.entryPrice,
        cycle.firstFillPrice,
        since,
        lots,
      );
    }
  }
  return dedupe(levels);
}

function flexLevels(
  levels: ConditionOrderLevel[],
  input: {
    recipe: PerpsTemplateRecipe;
    candles: readonly CandleBar[];
    tape: DcaIndicatorTimeframe;
    barsByTimeframe?: ReadonlyMap<string, readonly CandleBar[]>;
  },
  side: FuturesSide,
  entry: number,
  since: readonly CandleBar[],
  lots: readonly ChartLot[],
) {
  const recipe = input.recipe;
  const actions = sideExitActions(
    recipe.exitActions,
    recipe.shortEntry?.actions,
    recipe.direction,
    side,
  );
  const classic =
    side === "short" && recipe.direction === "both" && recipe.shortEntry?.classic
      ? recipe.shortEntry.classic
      : {
          tpsl: recipe.tpsl,
          trailing: recipe.trailing,
          breakevenActivationPct: recipe.breakevenActivationPct ?? null,
          breakevenOffsetPct: recipe.breakevenOffsetPct ?? null,
        };
  if (actions && actions.length > 0) {
    for (const action of actions) {
      exitActionLevels(levels, action, side, entry, since, input, lots);
    }
  } else {
    tpslLevels(levels, classic.tpsl, side);
    trailLevels(levels, classic.trailing, side, since);
    breakevenLevel(
      levels,
      side,
      entry,
      classic.breakevenActivationPct,
      classic.breakevenOffsetPct,
      since,
      classic.tpsl?.stopLoss ?? null,
    );
  }
  const exitStack =
    side === "short" && recipe.direction === "both"
      ? recipe.shortEntry?.exitStack
      : recipe.exitStack;
  const exitHard =
    side === "short" && recipe.direction === "both"
      ? recipe.shortEntry?.exitHard
      : recipe.exitHard;
  if (exitHard && exitHard.trigger === "price" && exitHard.price > 0) {
    push(levels, side, "exit", "Exit", exitHard.price);
  }
  stackLevels(levels, exitStack, side, "exit", "Exit", input);
}

function dcaLevels(
  levels: ConditionOrderLevel[],
  input: {
    recipe: Extract<BacktestRecipe, { kind: "dca" }>;
    candles: readonly CandleBar[];
    tape: DcaIndicatorTimeframe;
    barsByTimeframe?: ReadonlyMap<string, readonly CandleBar[]>;
  },
  side: FuturesSide,
  entry: number,
  first: number,
  since: readonly CandleBar[],
  lots: readonly ChartLot[],
) {
  const recipe = input.recipe;
  const actions = dcaClassicActions(
    side === "short" && recipe.direction === "both"
      ? recipe.shortExitActions
      : recipe.exitActions,
  );
  if (actions && actions.length > 0) {
    for (const action of actions) {
      exitActionLevels(levels, action, side, entry, since, input, lots);
    }
  } else {
  const classic =
    side === "short" && recipe.direction === "both" && recipe.shortClassic
      ? recipe.shortClassic
      : recipe;
  const planned = dcaPlannedExits({
    side,
    entryPrice: entry,
    firstFillPrice: first,
    mark: since[since.length - 1]?.close ?? entry,
    takeProfitPct: classic.takeProfitPct,
    stopLossPct: classic.stopLossPct,
    takeProfitBasis: classic.takeProfitBasis,
    stopLossBasis: classic.stopLossBasis,
    trailingPct: null,
  });
  push(levels, side, "exit", "TP", planned.takeProfit);
  push(levels, side, "exit", "SL", planned.stopLoss);
  if (classic.trailingPct != null && classic.trailingPct > 0) {
    const distance = (since[since.length - 1]?.close ?? entry) * (classic.trailingPct / 100);
    const active =
      classic.trailingTriggerPct != null && classic.trailingTriggerPct > 0
        ? moved(side, entry, classic.trailingTriggerPct, "profit")
        : null;
    push(levels, side, "exit", "Trail", trailedStop(side, distance, active, since));
  }
  breakevenLevel(
    levels,
    side,
    entry,
    classic.breakevenActivationPct,
    classic.breakevenOffsetPct,
    since,
    planned.stopLoss,
  );
  }
  stackLevels(
    levels,
    side === "short" && recipe.direction === "both" ? recipe.shortExitStack : recipe.exitStack,
    side,
    "exit",
    "Exit",
    input,
  );
}

function exitActionLevels(
  levels: ConditionOrderLevel[],
  action: StoredExitAction,
  side: FuturesSide,
  entry: number,
  since: readonly CandleBar[],
  input: {
    candles: readonly CandleBar[];
    tape: DcaIndicatorTimeframe;
    barsByTimeframe?: ReadonlyMap<string, readonly CandleBar[]>;
  },
  lots: readonly ChartLot[],
) {
  const subjects =
    actionUsesLotReference(action) && lots.length > 0
      ? lots
      : [{ price: entry, atMs: since[0]?.timeMs ?? 0 }];
  for (const lot of subjects) {
    const window = since.filter((bar) => bar.timeMs >= lot.atMs);
    const bars = window.length > 0 ? window : since;
    if (action.kind === "take_profit") {
      push(
        levels,
        side,
        "exit",
        "TP",
        action.takeProfitPrice ??
          (action.takeProfitPct != null ? moved(side, entry, action.takeProfitPct, "profit") : null),
      );
    }
    if (action.kind === "stop_loss") {
      push(
        levels,
        side,
        "exit",
        "SL",
        action.stopLossPrice ??
          (action.stopLossPct != null
            ? moved(side, actionUsesLotReference(action) ? lot.price : entry, action.stopLossPct, "loss")
            : null),
      );
    }
    if (action.kind === "trailing_stop") {
      const mark = bars[bars.length - 1]?.close ?? lot.price;
      const basis = actionUsesLotReference(action) ? lot.price : entry;
      const distance =
        action.trailingDistance ??
        (action.trailingPct != null && action.trailingPct > 0
          ? mark * (action.trailingPct / 100)
          : null);
      if (distance != null && distance > 0) {
        const active =
          action.trailingActivation ??
          (action.trailingTriggerPct != null && action.trailingTriggerPct > 0
            ? moved(side, basis, action.trailingTriggerPct, "profit")
            : null);
        push(levels, side, "exit", "Trail", trailedStop(side, distance, active, bars));
      }
    }
    if (action.kind === "breakeven") {
      breakevenLevel(
        levels,
        side,
        actionUsesLotReference(action) ? lot.price : entry,
        action.breakevenActivationPct ?? null,
        action.breakevenOffsetPct ?? 0,
        bars,
        null,
      );
    }
  }
  for (const group of action.groups) {
    for (const draft of [group.anchor, ...group.rows]) {
      draftLevel(levels, draft, side, "exit", "Exit", input);
    }
  }
}

function stackLevels(
  levels: ConditionOrderLevel[],
  stack: EntryStack | null | undefined,
  side: FuturesSide,
  role: "exit" | "add",
  title: string,
  input: {
    candles: readonly CandleBar[];
    tape: DcaIndicatorTimeframe;
    barsByTimeframe?: ReadonlyMap<string, readonly CandleBar[]>;
  },
) {
  if (!stack) {
    return;
  }
  if (role !== "exit") {
    return;
  }
  addStackGroups(stack).forEach((leaves) => {
    for (const leaf of leaves) {
      leafLevel(levels, leaf, side, role, title, input);
    }
  });
}

function leafLevel(
  levels: ConditionOrderLevel[],
  leaf: StrategyLeaf,
  side: FuturesSide,
  role: "exit" | "add",
  title: string,
  input: {
    candles: readonly CandleBar[];
    tape: DcaIndicatorTimeframe;
    barsByTimeframe?: ReadonlyMap<string, readonly CandleBar[]>;
  },
) {
  if (leaf.kind === "price" && leaf.price > 0) {
    push(levels, side, role, title, leaf.price);
  }
  if (leaf.kind === "retrace") {
    const spec = windowRetraceSpec(leaf);
    if (spec) {
      push(levels, side, role, title, retracePrice(spec, input));
    }
  }
}

function draftLevel(
  levels: ConditionOrderLevel[],
  draft: HardExitDraft,
  side: FuturesSide,
  role: "exit" | "add",
  title: string,
  input: {
    candles: readonly CandleBar[];
    tape: DcaIndicatorTimeframe;
    barsByTimeframe?: ReadonlyMap<string, readonly CandleBar[]>;
  },
) {
  if (draft.trigger === "price") {
    const price = Number(String(draft.price).replace(/,/g, ""));
    push(levels, side, role, title, price);
  }
  if (draft.trigger === "retrace") {
    const pct = Number(String(draft.pct).replace(/,/g, ""));
    const lookback = Math.trunc(Number(draft.lookback));
    if (!(pct > 0) || !(lookback >= 1)) {
      return;
    }
    push(
      levels,
      side,
      role,
      title,
      retracePrice(
        {
          source: draft.source,
          from: draft.from,
          pct,
          lookback,
          timeframe: draft.timeframe,
        },
        input,
      ),
    );
  }
}

function retracePrice(
  spec: RetraceSpec,
  input: {
    candles: readonly CandleBar[];
    tape: DcaIndicatorTimeframe;
    barsByTimeframe?: ReadonlyMap<string, readonly CandleBar[]>;
  },
): number | null {
  return retraceLevelPrice({
    spec,
    bars: barsFor(spec.timeframe, input),
  });
}

function barsFor(
  timeframe: DcaIndicatorTimeframe,
  input: {
    candles: readonly CandleBar[];
    tape: DcaIndicatorTimeframe;
    barsByTimeframe?: ReadonlyMap<string, readonly CandleBar[]>;
  },
): CandleBar[] {
  const extra = input.barsByTimeframe?.get(timeframe);
  if (extra && extra.length > 0) {
    return [...extra];
  }
  if (timeframe === input.tape) {
    return [...input.candles];
  }
  const sampled = resampleBarsForTimeframe(
    input.candles.map((bar) => ({ high: bar.high, low: bar.low, close: bar.close })),
    input.tape,
    timeframe,
  );
  if (sampled.length === 0 || sampled.length === input.candles.length && timeframe !== input.tape) {
    return [...input.candles];
  }
  return sampled.map((bar, index) => ({
    timeMs: input.candles[Math.min(index, input.candles.length - 1)]?.timeMs ?? index,
    open: bar.close,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  }));
}

function tpslLevels(
  levels: ConditionOrderLevel[],
  tpsl: FuturesTpsl | null | undefined,
  side: FuturesSide,
) {
  if (!tpsl) {
    return;
  }
  push(levels, side, "exit", "TP", tpsl.takeProfit);
  push(levels, side, "exit", "SL", tpsl.stopLoss);
}

function trailLevels(
  levels: ConditionOrderLevel[],
  trailing: FuturesTrailing | null | undefined,
  side: FuturesSide,
  since: readonly CandleBar[],
) {
  if (!trailing || !(trailing.distance > 0)) {
    return;
  }
  push(
    levels,
    side,
    "exit",
    "Trail",
    trailedStop(side, trailing.distance, trailing.activePrice, since),
  );
}

function breakevenLevel(
  levels: ConditionOrderLevel[],
  side: FuturesSide,
  entry: number,
  activationPct: number | null | undefined,
  offsetPct: number | null | undefined,
  since: readonly CandleBar[],
  currentStop: number | null,
) {
  if (activationPct == null || !(activationPct > 0)) {
    return;
  }
  const mark = since[since.length - 1]?.close ?? entry;
  const movedPct = side === "long" ? ((mark - entry) / entry) * 100 : ((entry - mark) / entry) * 100;
  if (movedPct + 1e-9 < activationPct) {
    return;
  }
  const stop = futuresBreakevenStop({
    side,
    entryPrice: entry,
    currentStop,
    offsetPct: offsetPct ?? 0,
  });
  push(levels, side, "exit", "BE", stop);
}

function trailedStop(
  side: FuturesSide,
  distance: number,
  activePrice: number | null,
  candles: readonly CandleBar[],
): number | null {
  if (!(distance > 0)) {
    return null;
  }
  let peak: number | null = null;
  let stop: number | null = null;
  for (const bar of candles) {
    const step = advanceTrailingOnBar({
      side,
      trailing: { distance, activePrice, peak },
      favorable: side === "long" ? bar.high : bar.low,
      adverse: side === "long" ? bar.low : bar.high,
    });
    peak = step.peak;
    if (step.stop != null) {
      stop = step.stop;
    }
  }
  return stop;
}

function moved(
  side: FuturesSide,
  entry: number,
  pct: number,
  direction: "profit" | "loss",
): number {
  const up = side === "long" ? direction === "profit" : direction === "loss";
  return entry * (1 + ((up ? pct : -pct) / 100));
}

function push(
  levels: ConditionOrderLevel[],
  side: FuturesSide,
  role: "exit" | "add",
  title: string,
  price: number | null | undefined,
) {
  if (price == null || !(price > 0) || !Number.isFinite(price)) {
    return;
  }
  levels.push({
    id: `${side}:${role}:${title}:${price}`,
    price,
    title: conditionLevelTitle(side, title),
    side,
    role,
  });
}

export function conditionLevelTitle(side: FuturesSide, title: string): string {
  return `${side === "short" ? "Short" : "Long"} ${title}`;
}

function dedupe(levels: ConditionOrderLevel[]): ConditionOrderLevel[] {
  const seen = new Set<string>();
  const out: ConditionOrderLevel[] = [];
  for (const level of levels) {
    if (seen.has(level.id)) {
      continue;
    }
    seen.add(level.id);
    out.push(level);
  }
  return out;
}

function collectStackFrames(
  frames: Set<DcaIndicatorTimeframe>,
  stack: EntryStack | null | undefined,
) {
  for (const leaf of stack?.leaves ?? []) {
    const timeframe = strategyLeafTimeframe(leaf);
    if (timeframe) {
      frames.add(timeframe);
    }
  }
}
