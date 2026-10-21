import { dcaBreakevenPrice, dcaStopLossPrice } from "@/lib/dca/grid";
import {
  exitPriceRuleLabel,
  hardExitMet,
  hardExitParts,
  isExitPriceRule,
  type HardExitDraft,
} from "@/lib/dca/hard-exit";
import { parseDcaIndicatorTimeframe } from "@/lib/dca/indicators";
import type { FuturesSide } from "@/lib/futures/model";
import { retraceMet } from "@/lib/strategy/retrace";
import type { CandleBar } from "@/lib/market/candles";
import {
  breakevenExitClause,
  clauseHasPriceRule,
  clauseLevels,
  clauseOrGroups,
  clauseReference,
  clauseScope,
  classicExitClause,
  customExitClause,
  emptyExitClause,
  emptyRepeatLevels,
  isClassicExitKind,
  pinExitPriceRule,
  priceRuleForKind,
  priceRuleName,
  trailActivationKind,
  type ClassicExitKind,
  type TrailActivationKind,
  type ExitBuilderClause,
  type ExitOrGroup,
  type ExitReference,
  type ExitRepeatLevels,
  type ExitScope,
} from "@/lib/strategy/exit-clauses";

export type ExitActionKind = "take_profit" | "trailing_stop" | "stop_loss" | "breakeven" | "close";

export type ExitConditionGroup = {
  anchor: HardExitDraft;
  rows: HardExitDraft[];
};

/** One saved exit action. Present only when the side no longer fits the columns. */
export type SavedExitScope =
  | { kind: "all" }
  | { kind: "remainder" }
  | { kind: "percent"; pct: number }
  | { kind: "qty"; qty: number }
  | { kind: "fills"; minProfitPct: number };

export type StoredExitAction = {
  id: string;
  kind: ExitActionKind;
  scope: SavedExitScope;
  /** Absent on a card saved before Execution existed. That card stays Average. */
  reference?: ExitReference;
  groups: ExitConditionGroup[];
  takeProfitPct: number | null;
  takeProfitPrice: number | null;
  stopLossPct: number | null;
  stopLossPrice: number | null;
  trailingDistance: number | null;
  trailingActivation: number | null;
  trailingPct?: number | null;
  /** Profit percent that must be reached before a DCA trailing stop starts. */
  trailingTriggerPct?: number | null;
  /** Profit percent that moves the stop to entry. A breakeven action does not close size. */
  breakevenActivationPct?: number | null;
  breakevenOffsetPct?: number | null;
  /** Price fields for a later card. Absent on the first card of that kind. */
  levels?: ExitRepeatLevels;
};

export type ExitSidePrices = {
  takeProfitPct: number | null;
  takeProfitPrice: number | null;
  stopLossPct: number | null;
  stopLossPrice: number | null;
  trailingDistance: number | null;
  trailingActivation: number | null;
  trailingPct?: number | null;
  trailingTriggerPct?: number | null;
  breakevenActivationPct?: number | null;
  breakevenOffsetPct?: number | null;
};

function levelNumber(value: string | null | undefined): number | null {
  const number = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function exitPricesFromLevels(input: {
  takeProfit?: string | null;
  takeProfitKind?: "percent" | "price" | null;
  stopLoss?: string | null;
  stopLossKind?: "percent" | "price" | null;
  trailingDistance?: string | null;
  trailingActivation?: string | null;
  trailingActivationKind?: TrailActivationKind | null;
  trailingPct?: string | null;
  trailingTriggerPct?: string | null;
  breakevenActivationPct?: string | null;
  breakevenOffsetPct?: string | null;
}): ExitSidePrices {
  const takeProfit = levelNumber(input.takeProfit);
  const stopLoss = levelNumber(input.stopLoss);
  const takeProfitKind = input.takeProfitKind === "price" ? "price" : "percent";
  const stopLossKind = input.stopLossKind === "price" ? "price" : "percent";
  const activation = levelNumber(input.trailingActivation);
  const triggerPct = levelNumber(input.trailingTriggerPct);
  const activationKind = input.trailingActivationKind;
  return {
    takeProfitPct: takeProfitKind === "percent" ? takeProfit : null,
    takeProfitPrice: takeProfitKind === "price" ? takeProfit : null,
    stopLossPct: stopLossKind === "percent" ? stopLoss : null,
    stopLossPrice: stopLossKind === "price" ? stopLoss : null,
    trailingDistance: levelNumber(input.trailingDistance),
    trailingActivation:
      activationKind === "percent" ? null : activationKind === "price" ? (activation ?? triggerPct) : activation,
    trailingPct: levelNumber(input.trailingPct),
    trailingTriggerPct:
      activationKind === "price" ? null : activationKind === "percent" ? (triggerPct ?? activation) : triggerPct,
    breakevenActivationPct: levelNumber(input.breakevenActivationPct),
    breakevenOffsetPct: nonNegativeLevel(input.breakevenOffsetPct),
  };
}

function nonNegativeLevel(value: string | null | undefined): number | null {
  const number = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export const EMPTY_EXIT_PRICES: ExitSidePrices = {
  takeProfitPct: null,
  takeProfitPrice: null,
  stopLossPct: null,
  stopLossPrice: null,
  trailingDistance: null,
  trailingActivation: null,
  trailingPct: null,
  trailingTriggerPct: null,
  breakevenActivationPct: null,
  breakevenOffsetPct: null,
};

/** A Flex percent trail, a Flex percent gate, or a DCA price gate cannot live on the classic columns. */
export function trailFitsColumns(
  prices: ExitSidePrices,
  style?: "flex" | "dca" | null,
): boolean {
  const priceGate = prices.trailingActivation != null;
  const pctGate = prices.trailingTriggerPct != null && prices.trailingTriggerPct > 0;
  if (
    style === "flex" &&
    prices.trailingDistance == null &&
    ((prices.trailingPct != null && prices.trailingPct > 0) || pctGate)
  ) {
    return false;
  }
  if (prices.trailingDistance != null && pctGate && !priceGate) {
    return false;
  }
  if (
    (prices.trailingPct ?? null) != null &&
    priceGate &&
    !pctGate &&
    prices.trailingDistance == null
  ) {
    return false;
  }
  return true;
}

/** The first trailing card's activation, preferring the action over the columns. */
export function savedTrailActivation(input: {
  actions?: readonly StoredExitAction[] | null;
  activePrice?: number | null;
  triggerPct?: number | null;
}): { kind: TrailActivationKind; value: string } {
  const first = input.actions?.find((action) => action.kind === "trailing_stop");
  if (
    first &&
    (first.trailingTriggerPct ?? null) != null &&
    first.trailingActivation == null
  ) {
    return { kind: "percent", value: String(first.trailingTriggerPct) };
  }
  if (
    first &&
    first.trailingActivation != null &&
    (first.trailingTriggerPct ?? null) == null
  ) {
    return { kind: "price", value: String(first.trailingActivation) };
  }
  if (input.activePrice != null && input.activePrice > 0) {
    return { kind: "price", value: String(input.activePrice) };
  }
  if (input.triggerPct != null && input.triggerPct > 0) {
    return { kind: "percent", value: String(input.triggerPct) };
  }
  return { kind: "percent", value: "" };
}

/** The first trailing action must carry the gate the columns cannot store. */
export function trailingGateError(
  actions: readonly StoredExitAction[] | null | undefined,
  kind: TrailActivationKind,
): string | null {
  const first = actions?.find((action) => action.kind === "trailing_stop");
  if (kind === "percent") {
    return first?.trailingTriggerPct != null ? null : "Enter an activation percent.";
  }
  return first?.trailingActivation != null ? null : "Enter an activation price.";
}

export type ExitLot = {
  id: string;
  qty: number;
  price: number;
};

export type ExitLotArm = {
  peak: number | null;
  /** This fill has reached its breakeven activation. */
  breakeven: boolean;
};

export type ExitArmState = {
  armedAt: number | null;
  peak: number | null;
  condition: boolean;
  scopeLive: boolean;
  /** Per-lot peak and breakeven latch. Absent when the card uses Average. */
  lots?: Record<string, ExitLotArm>;
};

export type ExitRuntime = {
  arms: Record<string, ExitArmState>;
  /** Last decision tree for this position. Absent on rows saved before the book existed. */
  book?: ExitBookSnapshot | null;
};

export type ExitActionStatus =
  | "off"
  | "waiting"
  | "armed"
  | "protecting"
  | "moving"
  | "firing"
  | "done";

export type ExitLeafSnapshot = {
  trigger: string;
  label: string;
  /** Null when the leaf could not be evaluated, for example because its candles were missing. */
  met: boolean | null;
};

export type ExitGroupSnapshot = {
  met: boolean;
  leaves: ExitLeafSnapshot[];
};

/** One exit action at a single check. Later conditions and the position tree read this. */
export type ExitActionSnapshot = {
  id: string;
  kind: ExitActionKind;
  scope: SavedExitScope;
  status: ExitActionStatus;
  conditionsMet: boolean;
  priceMet: boolean | null;
  /** Trailing activation only. Null on every other kind. */
  activationMet: boolean | null;
  scopeQty: number;
  protectingQty: number;
  claimQty: number;
  groups: ExitGroupSnapshot[];
};

/**
 * Coverage of the open quantity.
 * `provenQty` is the largest single protecting action, so overlap cannot inflate it.
 * `stackedQty` adds those quantities and caps at the open quantity, which counts
 * scopes as disjoint until they pass the open size.
 */
export type ExitCoverageSnapshot = {
  openQty: number;
  provenQty: number;
  stackedQty: number;
  provenPct: number | null;
  stackedPct: number | null;
};

export type ExitBookSnapshot = {
  atMs: number;
  source: "actions" | "classic";
  openQty: number;
  actions: ExitActionSnapshot[];
  byKind: Record<ExitActionKind, ExitCoverageSnapshot>;
  /** Stop loss, trailing stop, and a latched breakeven. */
  protective: ExitCoverageSnapshot;
  /**
   * The same stops, counted only when the stop price is at or better than entry.
   * A long stop is at or above entry. A short stop is at or below entry.
   */
  noLoss: ExitCoverageSnapshot;
  /** Trailing stops that are tracking, plus a breakeven move that has latched. */
  trailingOrBreakeven: ExitCoverageSnapshot;
};

export type ExitBreakevenMove = {
  activationPct: number;
  offsetPct: number;
  /** Applies To size. Null covers the whole open position. */
  qty: number | null;
};

export type ExitClaim = {
  actionId: string;
  kind: ExitActionKind;
  qty: number;
  reason: "take_profit" | "stop_loss" | "trailing_stop" | "close";
};

const QTY_EPS = 1e-8;

export function emptyExitRuntime(): ExitRuntime {
  return { arms: {} };
}

function finiteOrNull(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveOrNull(value: unknown): number | null {
  const number = finiteOrNull(value);
  return number != null && number > 0 ? number : null;
}

function nonNegativeOrNull(value: unknown): number | null {
  const number = finiteOrNull(value);
  return number != null && number >= 0 ? number : null;
}

function draftOf(value: unknown): HardExitDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as HardExitDraft;
  if (
    row.trigger !== "price" &&
    row.trigger !== "indicator" &&
    row.trigger !== "trend" &&
    row.trigger !== "webhook" &&
    row.trigger !== "retrace" &&
    row.trigger !== "target" &&
    row.trigger !== "stop" &&
    row.trigger !== "trail" &&
    row.trigger !== "profit" &&
    row.trigger !== "unset"
  ) {
    return null;
  }
  return row;
}

function scopeFromJson(value: unknown): StoredExitAction["scope"] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as { kind?: unknown; pct?: unknown; qty?: unknown; minProfitPct?: unknown };
  if (row.kind === "all" || row.kind === "remainder") {
    return { kind: row.kind };
  }
  if (row.kind === "percent") {
    const pct = positiveOrNull(row.pct);
    return pct != null && pct < 100 ? { kind: "percent", pct } : null;
  }
  if (row.kind === "qty") {
    const qty = positiveOrNull(row.qty);
    return qty != null ? { kind: "qty", qty } : null;
  }
  if (row.kind === "fills") {
    const minProfitPct = positiveOrNull(row.minProfitPct);
    return minProfitPct != null ? { kind: "fills", minProfitPct } : null;
  }
  return null;
}

function textLevel(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function levelsFromJson(value: unknown): ExitRepeatLevels | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const row = value as Record<string, unknown>;
  const style = row.style === "flex" || row.style === "dca" ? row.style : "";
  return {
    style,
    basis: textLevel(row.basis) || "average",
    method: textLevel(row.method),
    target: textLevel(row.target),
    atrPeriod: textLevel(row.atrPeriod),
    atrMult: textLevel(row.atrMult),
    orderType: row.orderType === "limit" ? "limit" : "market",
    trigger: textLevel(row.trigger),
    trail: textLevel(row.trail),
    limitPrice: textLevel(row.limitPrice),
    breakeven: row.breakeven === true,
    breakevenActivation: textLevel(row.breakevenActivation),
    breakevenOffset: textLevel(row.breakevenOffset),
  };
}

export function exitActionsFromJson(value: unknown): StoredExitAction[] | null {
  if (value == null) {
    return null;
  }
  const rows = Array.isArray(value) ? value : null;
  if (!rows || rows.length === 0) {
    return null;
  }
  const actions: StoredExitAction[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return null;
    }
    const row = item as Record<string, unknown>;
    const kind = row.kind;
    if (
      kind !== "take_profit" &&
      kind !== "trailing_stop" &&
      kind !== "stop_loss" &&
      kind !== "breakeven" &&
      kind !== "close"
    ) {
      return null;
    }
    const scope = scopeFromJson(row.scope);
    if (!scope) {
      return null;
    }
    const groups: ExitConditionGroup[] = [];
    if (Array.isArray(row.groups)) {
      for (const group of row.groups) {
        if (!group || typeof group !== "object") {
          return null;
        }
        const anchor = draftOf((group as { anchor?: unknown }).anchor);
        if (!anchor) {
          return null;
        }
        const nested = (group as { rows?: unknown }).rows;
        const leaves: HardExitDraft[] = [];
        if (Array.isArray(nested)) {
          for (const leaf of nested) {
            const draft = draftOf(leaf);
            if (!draft) {
              return null;
            }
            leaves.push(draft);
          }
        }
        groups.push({ anchor, rows: leaves });
      }
    }
    actions.push({
      id: String(row.id ?? "").trim() || `exit-${actions.length + 1}`,
      kind,
      scope,
      ...(row.reference === "lot" ? { reference: "lot" as const } : {}),
      groups,
      takeProfitPct: positiveOrNull(row.takeProfitPct),
      takeProfitPrice: positiveOrNull(row.takeProfitPrice),
      stopLossPct: positiveOrNull(row.stopLossPct),
      stopLossPrice: positiveOrNull(row.stopLossPrice),
      trailingDistance: positiveOrNull(row.trailingDistance),
      trailingActivation: positiveOrNull(row.trailingActivation),
      trailingPct: positiveOrNull(row.trailingPct),
      trailingTriggerPct: positiveOrNull(row.trailingTriggerPct),
      breakevenActivationPct: positiveOrNull(row.breakevenActivationPct),
      breakevenOffsetPct: nonNegativeOrNull(row.breakevenOffsetPct),
      levels: levelsFromJson(row.levels),
    });
  }
  return actions;
}

export function exitActionsToJson(
  actions: readonly StoredExitAction[] | null | undefined,
): StoredExitAction[] | null {
  if (!actions || actions.length === 0) {
    return null;
  }
  return actions.map((action) => ({ ...action, groups: action.groups.map((group) => ({
    anchor: group.anchor,
    rows: group.rows,
  })) }));
}

function groupsOf(clause: ExitBuilderClause): ExitConditionGroup[] {
  const groups: ExitConditionGroup[] = [];
  if (clause.anchor.trigger !== "unset") {
    groups.push({
      anchor: clause.anchor,
      rows: clause.rows
        .map((row) => row.draft)
        .filter((draft) => draft.trigger !== "unset"),
    });
  }
  for (const group of clauseOrGroups(clause)) {
    if (group.anchor.trigger === "unset") {
      continue;
    }
    groups.push({
      anchor: group.anchor,
      rows: group.rows
        .map((row) => row.draft)
        .filter((draft) => draft.trigger !== "unset"),
    });
  }
  return groups;
}

function stackStarted(clause: ExitBuilderClause): boolean {
  if (clause.rows.length > 0 || clauseOrGroups(clause).length > 0) {
    return true;
  }
  const rule = priceRuleForKind(clause.kind);
  if (clause.anchor.trigger === "unset") {
    return false;
  }
  return !(rule != null && clause.anchor.trigger === rule);
}

function scopeComplete(scope: ExitScope): StoredExitAction["scope"] | null {
  if (scope.kind === "all" || scope.kind === "remainder") {
    return scope;
  }
  if (scope.kind === "percent") {
    return scope.pct != null && scope.pct > 0 && scope.pct < 100
      ? { kind: "percent", pct: scope.pct }
      : null;
  }
  if (scope.kind === "qty") {
    return scope.qty != null && scope.qty > 0 ? { kind: "qty", qty: scope.qty } : null;
  }
  return scope.minProfitPct != null && scope.minProfitPct > 0
    ? { kind: "fills", minProfitPct: scope.minProfitPct }
    : null;
}

/** True when this side still matches one classic of each kind plus one Close. */
export function exitSideUsesColumns(clauses: readonly ExitBuilderClause[]): boolean {
  const started = clauses.filter((clause) => clause.kind !== "");
  const seen = new Set<string>();
  let closes = 0;
  for (const clause of started) {
    if (clause.kind === "breakeven") {
      if (
        seen.has("breakeven") ||
        stackStarted(clause) ||
        clauseScope(clause).kind !== "all"
      ) {
        return false;
      }
      seen.add("breakeven");
      continue;
    }
    if (clause.kind === "custom") {
      closes += 1;
      if (closes > 1 || clauseScope(clause).kind !== "all") {
        return false;
      }
      continue;
    }
    if (!isClassicExitKind(clause.kind) || seen.has(clause.kind)) {
      return false;
    }
    seen.add(clause.kind);
    if (stackStarted(clause) || clauseScope(clause).kind !== "all") {
      return false;
    }
    if (clause.ownPct != null || clause.ownDistance != null) {
      return false;
    }
  }
  return closes <= 1;
}

function actionLabel(kind: ExitBuilderClause["kind"], index: number): string {
  const name =
    kind === "take_profit"
      ? "take profit"
      : kind === "trailing_stop"
        ? "trailing stop"
        : kind === "stop_loss"
          ? "stop loss"
          : kind === "breakeven"
            ? "breakeven stop"
            : kind === "custom"
              ? "close"
              : "action";
  return `${name} ${index}`;
}

function forEachBlock(
  clauses: readonly ExitBuilderClause[],
): string | null {
  const started = clauses.some((clause) => clause.kind !== "");
  if (!started) {
    return null;
  }
  const remainders = clauses.filter(
    (clause) => clause.kind !== "" && clauseScope(clause).kind === "remainder",
  );
  if (remainders.length > 1) {
    return "Only one action can be responsible for the remainder.";
  }
  const counts = new Map<string, number>();
  for (const [index, clause] of clauses.entries()) {
    if (clause.kind === "") {
      if (started) {
        return "Select an action.";
      }
      continue;
    }
    const label = actionLabel(clause.kind, index + 1);
    const seen = (counts.get(clause.kind) ?? 0) + 1;
    counts.set(clause.kind, seen);
    if (clause.kind === "custom" && groupsOf(clause).length === 0 && clauseScope(clause).kind !== "fills") {
      return "Close needs a condition.";
    }
    if (clause.kind === "breakeven" && seen > 1) {
      return "Only one Breakeven Stop on a side.";
    }
    const ruleName = priceRuleName(clause.kind);
    if (ruleName && !clauseHasPriceRule(clause)) {
      return `${label} needs a ${ruleName}.`;
    }
    if (seen > 1 && isClassicExitKind(clause.kind)) {
      const missing = repeatFieldBlock(clause);
      if (missing) {
        return missing;
      }
    }
    const loose =
      (clause.anchor.trigger === "unset" &&
        (clause.rows.length > 0 ||
          clauseOrGroups(clause).some((group) => group.rows.length > 0 || group.anchor.trigger !== "unset"))) ||
      clause.rows.some((row) => row.draft.trigger === "unset") ||
      clauseOrGroups(clause).some(
        (group) =>
          group.anchor.trigger === "unset" ||
          group.rows.some((row) => row.draft.trigger === "unset"),
      );
    if (loose) {
      return `${label} has a condition with no type.`;
    }
    if (!scopeComplete(clauseScope(clause))) {
      if (clauseScope(clause).kind === "percent") {
        return `Enter the percent ${label} is responsible for.`;
      }
      if (clauseScope(clause).kind === "qty") {
        return `Enter the quantity ${label} is responsible for.`;
      }
      return `Enter the profit percent ${label} is responsible for.`;
    }
  }
  return null;
}

export function exitCardsBlockReason(
  clauses: readonly ExitBuilderClause[],
): string | null {
  return forEachBlock(clauses);
}

function repeatFieldBlock(clause: ExitBuilderClause): string | null {
  const levels = clauseLevels(clause);
  const flex =
    levels.style === "flex" ||
    levels.trigger === "last" ||
    levels.trigger === "mark" ||
    levels.trigger === "index";
  if (clause.kind === "take_profit") {
    if (levels.method === "atr") {
      if (levelNumber(levels.atrPeriod) == null) {
        return "Enter an ATR period for the extra take profit.";
      }
      if (levelNumber(levels.atrMult) == null) {
        return "Enter a take profit ATR multiple.";
      }
    } else if (levelNumber(levels.target) == null && !(clause.ownPct != null && clause.ownPct > 0)) {
      return "Enter a target for the extra take profit.";
    }
    if (flex && levels.orderType === "limit" && levelNumber(levels.limitPrice) == null) {
      return "Enter a limit price for the extra take profit.";
    }
    return null;
  }
  if (clause.kind === "stop_loss") {
    if (levelNumber(levels.target) == null && !(clause.ownPct != null && clause.ownPct > 0)) {
      return "Enter a stop loss for the extra stop.";
    }
    if (levels.breakeven && levelNumber(levels.breakevenActivation) == null) {
      return "Enter a breakeven activation percent.";
    }
    if (flex && levels.orderType === "limit" && levelNumber(levels.limitPrice) == null) {
      return "Enter a limit price for the extra stop loss.";
    }
    return null;
  }
  if (clause.kind === "trailing_stop") {
    const trail = levelNumber(levels.trail) ?? (clause.ownDistance != null && clause.ownDistance > 0 ? clause.ownDistance : null);
    if (levelNumber(levels.trigger) == null || trail == null) {
      return "Enter a trailing stop.";
    }
  }
  return null;
}

function pricesFor(
  clause: ExitBuilderClause,
  kindCount: number,
  prices: ExitSidePrices,
): Pick<
  StoredExitAction,
  | "takeProfitPct"
  | "takeProfitPrice"
  | "stopLossPct"
  | "stopLossPrice"
  | "trailingDistance"
  | "trailingActivation"
  | "trailingPct"
  | "trailingTriggerPct"
  | "breakevenActivationPct"
  | "breakevenOffsetPct"
> {
  const blank = {
    takeProfitPct: null,
    takeProfitPrice: null,
    stopLossPct: null,
    stopLossPrice: null,
    trailingDistance: null,
    trailingActivation: null,
    trailingPct: null,
    trailingTriggerPct: null,
    breakevenActivationPct: null,
    breakevenOffsetPct: null,
  };
  if (clause.kind === "breakeven") {
    return {
      ...blank,
      breakevenActivationPct: prices.breakevenActivationPct ?? null,
      breakevenOffsetPct: prices.breakevenOffsetPct ?? 0,
    };
  }
  if (!clauseHasPriceRule(clause)) {
    return blank;
  }
  if (kindCount > 1) {
    return repeatPrices(clause);
  }
  if (clause.kind === "take_profit") {
    return {
      ...blank,
      takeProfitPct: prices.takeProfitPct,
      takeProfitPrice: prices.takeProfitPrice,
    };
  }
  if (clause.kind === "stop_loss") {
    return {
      ...blank,
      stopLossPct: prices.stopLossPct,
      stopLossPrice: prices.stopLossPrice,
    };
  }
  if (clause.kind === "trailing_stop") {
    return {
      ...blank,
      trailingDistance: prices.trailingDistance,
      trailingActivation: prices.trailingActivation,
      trailingPct: prices.trailingPct ?? null,
      trailingTriggerPct: prices.trailingTriggerPct ?? null,
    };
  }
  return blank;
}

function repeatPrices(
  clause: ExitBuilderClause,
): Pick<
  StoredExitAction,
  | "takeProfitPct"
  | "takeProfitPrice"
  | "stopLossPct"
  | "stopLossPrice"
  | "trailingDistance"
  | "trailingActivation"
  | "trailingPct"
  | "trailingTriggerPct"
  | "breakevenActivationPct"
  | "breakevenOffsetPct"
> {
  const blank = {
    takeProfitPct: null,
    takeProfitPrice: null,
    stopLossPct: null,
    stopLossPrice: null,
    trailingDistance: null,
    trailingActivation: null,
    trailingPct: null,
    trailingTriggerPct: null,
    breakevenActivationPct: null,
    breakevenOffsetPct: null,
  };
  const levels = clauseLevels(clause);
  const flex = levels.style === "flex";
  const target = levelNumber(levels.target) ?? (clause.ownPct != null && clause.ownPct > 0 ? clause.ownPct : null);
  const priceMode = levels.method === "price" || (levels.method === "" && flex);
  if (clause.kind === "take_profit") {
    if (levels.method === "atr" || !clauseHasPriceRule(clause)) {
      return blank;
    }
    return priceMode
      ? { ...blank, takeProfitPrice: target }
      : { ...blank, takeProfitPct: target };
  }
  if (clause.kind === "stop_loss") {
    if (!clauseHasPriceRule(clause)) {
      return blank;
    }
    return priceMode
      ? { ...blank, stopLossPrice: target }
      : { ...blank, stopLossPct: target };
  }
  if (clause.kind === "trailing_stop") {
    if (!clauseHasPriceRule(clause)) {
      return blank;
    }
    const trail =
      levelNumber(levels.trail) ??
      (clause.ownDistance != null && clause.ownDistance > 0 ? clause.ownDistance : null);
    const trigger = levelNumber(levels.trigger);
    const activationPrice =
      trailActivationKind({
        method: levels.method,
        style: levels.style,
        trigger: levels.trigger,
      }) === "price";
    if (flex) {
      return activationPrice
        ? { ...blank, trailingDistance: trail, trailingActivation: trigger }
        : { ...blank, trailingPct: trail, trailingTriggerPct: trigger };
    }
    return activationPrice
      ? { ...blank, trailingPct: trail, trailingActivation: trigger }
      : { ...blank, trailingPct: trail, trailingTriggerPct: trigger };
  }
  return blank;
}

function clauseSavesLotReference(
  clause: ExitBuilderClause,
  priced: { stopLossPct: number | null; stopLossPrice: number | null },
): boolean {
  if (clauseReference(clause) !== "lot") {
    return false;
  }
  if (clause.kind === "trailing_stop" || clause.kind === "breakeven") {
    return true;
  }
  if (clause.kind !== "stop_loss") {
    return false;
  }
  return priced.stopLossPrice == null && priced.stopLossPct != null;
}

/** Null when the side still belongs on the classic columns. */
export function exitActionsForSave(
  clauses: readonly ExitBuilderClause[],
  prices: ExitSidePrices,
  style?: "flex" | "dca" | null,
): StoredExitAction[] | null {
  const trailingCard = clauses.some((clause) => clause.kind === "trailing_stop");
  const lotReference = clauses.some((clause, index) => {
    if (clause.kind === "") {
      return false;
    }
    const seenCount = clauses
      .slice(0, index + 1)
      .filter((item) => item.kind === clause.kind).length;
    return clauseSavesLotReference(clause, pricesFor(clause, seenCount, prices));
  });
  if (
    exitSideUsesColumns(clauses) &&
    !lotReference &&
    (!trailingCard || trailFitsColumns(prices, style))
  ) {
    return null;
  }
  const seen = new Map<string, number>();
  const actions: StoredExitAction[] = [];
  for (const clause of clauses) {
    if (clause.kind === "") {
      continue;
    }
    const seenCount = (seen.get(clause.kind) ?? 0) + 1;
    seen.set(clause.kind, seenCount);
    const scope = scopeComplete(clauseScope(clause));
    if (!scope) {
      continue;
    }
    const kind: ExitActionKind = clause.kind === "custom" ? "close" : clause.kind;
    const levels = seenCount > 1 && isClassicExitKind(clause.kind) ? clauseLevels(clause) : undefined;
    const priced = pricesFor(clause, seenCount, prices);
    actions.push({
      id: clause.key,
      kind,
      scope,
      ...(clauseSavesLotReference(clause, priced) ? { reference: "lot" as const } : {}),
      groups: groupsOf(clause),
      ...priced,
      ...(levels ? { levels } : {}),
    });
  }
  return actions.length > 0 ? actions : null;
}

function levelsForAction(action: StoredExitAction): ExitRepeatLevels {
  const stored = action.levels
    ? { ...emptyRepeatLevels(), ...action.levels }
    : emptyRepeatLevels();
  if (action.kind === "take_profit" && !stored.target) {
    if (action.takeProfitPrice != null) {
      stored.target = String(action.takeProfitPrice);
      if (!stored.method) {
        stored.method = "price";
      }
    } else if (action.takeProfitPct != null) {
      stored.target = String(action.takeProfitPct);
    }
  }
  if (action.kind === "stop_loss" && !stored.target) {
    if (action.stopLossPrice != null) {
      stored.target = String(action.stopLossPrice);
      if (!stored.method) {
        stored.method = "price";
      }
    } else if (action.stopLossPct != null) {
      stored.target = String(action.stopLossPct);
    }
  }
  if (action.kind === "trailing_stop") {
    if (!stored.trail) {
      stored.trail =
        action.trailingPct != null
          ? String(action.trailingPct)
          : action.trailingDistance != null
            ? String(action.trailingDistance)
            : "";
    }
    if (!stored.trigger) {
      stored.trigger =
        action.trailingTriggerPct != null
          ? String(action.trailingTriggerPct)
          : action.trailingActivation != null
            ? String(action.trailingActivation)
            : "";
    }
    if (!stored.method) {
      stored.method = trailActivationKind({
        style: stored.style,
        trigger: stored.trigger,
        trailingActivation: action.trailingActivation,
        trailingTriggerPct: action.trailingTriggerPct ?? null,
      });
    }
  }
  return stored;
}

export function clausesFromExitActions(
  actions: readonly StoredExitAction[] | null | undefined,
): ExitBuilderClause[] | null {
  if (!actions || actions.length === 0) {
    return null;
  }
  const seen = new Map<string, number>();
  const clauses = actions.map((action) => {
    const seenCount = (seen.get(action.kind) ?? 0) + 1;
    seen.set(action.kind, seenCount);
    const [first, ...rest] = action.groups;
    const kind = action.kind === "close" ? "custom" : action.kind;
    const base =
      kind === "breakeven"
        ? { ...breakevenExitClause(), key: action.id }
        : kind === "custom"
          ? customExitClause(first?.anchor ?? { trigger: "unset" }, [], action.id)
          : { ...classicExitClause(kind), key: action.id };
    const rows =
      first?.rows.map((draft, index) => ({
        key: `${action.id}-and-${index}`,
        join: "and" as const,
        draft,
      })) ?? [];
    const orGroups: ExitOrGroup[] = rest.map((group, index) => ({
      key: `${action.id}-or-${index}`,
      anchor: group.anchor,
      rows: group.rows.map((draft, rowIndex) => ({
        key: `${action.id}-or-${index}-${rowIndex}`,
        join: "and" as const,
        draft,
      })),
    }));
    const levels = seenCount > 1 ? levelsForAction(action) : undefined;
    if (levels?.breakeven) {
      levels.breakeven = false;
      levels.breakevenActivation = "";
      levels.breakevenOffset = "";
    }
    return pinExitPriceRule({
      ...base,
      anchor: first?.anchor ?? { trigger: "unset" },
      rows,
      orGroups,
      scope: action.scope,
      reference: action.reference === "lot" ? "lot" : "average",
      ownPct: null,
      ownDistance: null,
      levels,
    });
  });
  const nested = actions.some(
    (action) => action.kind === "stop_loss" && action.levels?.breakeven === true,
  );
  if (nested && !clauses.some((clause) => clause.kind === "breakeven")) {
    clauses.push(breakevenExitClause());
  }
  return clauses;
}

export function savedBreakevenNumbers(
  actions: readonly StoredExitAction[] | null | undefined,
): { activation: string; offset: string } | null {
  const card = actions?.find((action) => action.kind === "breakeven");
  if (card?.breakevenActivationPct != null) {
    return {
      activation: String(card.breakevenActivationPct),
      offset:
        card.breakevenOffsetPct == null ? "" : String(card.breakevenOffsetPct),
    };
  }
  const nested = actions?.find(
    (action) => action.kind === "stop_loss" && action.levels?.breakeven === true,
  );
  if (nested?.levels?.breakevenActivation) {
    return {
      activation: nested.levels.breakevenActivation,
      offset: nested.levels.breakevenOffset,
    };
  }
  return null;
}

export function parseExitActionsField(
  form: FormData,
  name: string,
): { ok: true; actions: StoredExitAction[] | null } | { ok: false; error: string } {
  const raw = String(form.get(name) ?? "").trim();
  if (raw === "") {
    return { ok: true, actions: null };
  }
  try {
    const parsed = exitActionsFromJson(JSON.parse(raw));
    if (raw !== "" && parsed == null) {
      return { ok: false, error: "Exit actions could not be read." };
    }
    return { ok: true, actions: parsed };
  } catch {
    return { ok: false, error: "Exit actions could not be read." };
  }
}

function actionHasNumbers(action: StoredExitAction): boolean {
  if (action.kind === "take_profit") {
    return action.takeProfitPct != null || action.takeProfitPrice != null;
  }
  if (action.kind === "stop_loss") {
    return action.stopLossPct != null || action.stopLossPrice != null;
  }
  if (action.kind === "trailing_stop") {
    return trailConfigured(action);
  }
  if (action.kind === "breakeven") {
    return action.breakevenActivationPct != null && action.breakevenActivationPct > 0;
  }
  return false;
}


function pnlPct(side: FuturesSide, entry: number, mark: number): number | null {
  if (!(entry > 0) || !(mark > 0)) {
    return null;
  }
  const raw = ((mark - entry) / entry) * 100;
  return side === "long" ? raw : -raw;
}

/** A percent stop, breakeven, or trailing stop that prices each fill on its own. */
export function actionUsesLotReference(action: StoredExitAction): boolean {
  if (action.reference !== "lot") {
    return false;
  }
  if (action.kind === "trailing_stop" || action.kind === "breakeven") {
    return true;
  }
  if (action.kind !== "stop_loss") {
    return false;
  }
  if (action.stopLossPrice != null || action.levels?.method === "price") {
    return false;
  }
  return action.stopLossPct != null || action.levels?.method === "percent";
}

/** Parameter-list label. Null when this card has no Execution choice. */
export function executionLabel(action: StoredExitAction): string | null {
  if (action.kind === "trailing_stop" || action.kind === "breakeven") {
    return action.reference === "lot" ? "Per lot" : "Average";
  }
  if (action.kind !== "stop_loss") {
    return null;
  }
  if (action.stopLossPrice != null && action.stopLossPct == null) {
    return null;
  }
  if (action.levels?.method === "price") {
    return null;
  }
  if (action.stopLossPct == null && action.levels?.method !== "percent") {
    return null;
  }
  return action.reference === "lot" ? "Per lot" : "Average";
}

function armOf(runtime: ExitRuntime, id: string): ExitArmState {
  return (
    runtime.arms[id] ?? {
      armedAt: null,
      peak: null,
      condition: false,
      scopeLive: false,
    }
  );
}

export function sideExitActions(
  actions: readonly StoredExitAction[] | null | undefined,
  shortActions: readonly StoredExitAction[] | null | undefined,
  direction: string | null | undefined,
  side: FuturesSide,
): StoredExitAction[] | null {
  const list = side === "short" && direction === "both" ? shortActions : actions;
  return list && list.length > 0 ? [...list] : null;
}

export function exitClaimsCover(claims: readonly ExitClaim[], qty: number): boolean {
  let sum = 0;
  for (const claim of claims) {
    sum += claim.qty;
  }
  return qty > QTY_EPS && sum + QTY_EPS >= qty;
}

export function exitActionTimeframes(
  actions: readonly StoredExitAction[] | null | undefined,
): string[] {
  const frames = new Set<string>();
  for (const action of actions ?? []) {
    for (const group of action.groups) {
      for (const draft of [group.anchor, ...group.rows]) {
        if (draft.trigger === "retrace") {
          frames.add(draft.timeframe);
          continue;
        }
        if (draft.trigger !== "indicator" && draft.trigger !== "trend") {
          continue;
        }
        const timeframe = draft.spec?.timeframe;
        if (timeframe) {
          frames.add(timeframe);
        }
      }
    }
  }
  return [...frames];
}

/** Price the action list once. Desk, backtest, and replay share this decider. */
export function evaluateExitActions(input: {
  actions: readonly StoredExitAction[];
  runtime: ExitRuntime;
  lots: readonly ExitLot[];
  side: FuturesSide;
  mark: number;
  last: number;
  favorable?: number;
  adverse?: number;
  entryPrice: number | null;
  nowMs: number;
  barsByTimeframe: Map<string, CandleBar[]>;
  firedWebhookId?: string | null;
  stepQty?: number;
  breakevenDone?: boolean;
  prices?: { last: number | null; mark: number | null; index: number | null } | null;
}): {
  claims: ExitClaim[];
  runtime: ExitRuntime;
  lots: ExitLot[];
  breakeven: ExitBreakevenMove | null;
  book: ExitBookSnapshot;
} {
  const prices = input.prices ?? {
    last: input.last,
    mark: input.mark,
    index: null,
  };
  const conditionTrue: Record<string, boolean> = {};
  const needsPrice: Record<string, boolean> = {};
  for (const action of input.actions) {
    const gate = exitActionGate({
      action,
      side: input.side,
      prices,
      barsByTimeframe: input.barsByTimeframe,
      firedWebhookId: input.firedWebhookId,
    });
    conditionTrue[action.id] = gate.confirm;
    needsPrice[action.id] = gate.needsPrice;
  }
  const settled = planExitClaims({
    actions: input.actions,
    runtime: input.runtime,
    lots: input.lots,
    side: input.side,
    mark: input.mark,
    last: input.last,
    favorable: input.favorable,
    adverse: input.adverse,
    entryPrice: input.entryPrice,
    nowMs: input.nowMs,
    conditionTrue,
    needsPrice,
    stepQty: input.stepQty,
    breakevenDone: input.breakevenDone,
  });
  const book = describeExitBook({
    source: "actions",
    actions: input.actions,
    runtime: settled.runtime,
    lots: input.lots,
    side: input.side,
    mark: input.mark,
    last: input.last,
    favorable: input.favorable,
    adverse: input.adverse,
    entryPrice: input.entryPrice,
    nowMs: input.nowMs,
    claims: settled.claims,
    breakevenDone: input.breakevenDone,
    breakeven: settled.breakeven,
    barsByTimeframe: input.barsByTimeframe,
    firedWebhookId: input.firedWebhookId,
    prices,
  });
  const runtime: ExitRuntime = { ...settled.runtime, book };
  return { ...settled, runtime, book };
}

function leafMet(
  draft: HardExitDraft,
  input: {
    side: FuturesSide;
    prices: { last: number | null; mark: number | null; index: number | null } | null;
    barsByTimeframe: Map<string, CandleBar[]>;
    firedWebhookId?: string | null;
  },
): boolean {
  if (isExitPriceRule(draft.trigger)) {
    return true;
  }
  if (draft.trigger === "retrace") {
    const pct = Number(draft.pct.replace(/,/g, "").trim());
    const lookback = Math.trunc(Number(draft.lookback));
    const timeframe = parseDcaIndicatorTimeframe(draft.timeframe);
    if (!(pct > 0) || !(lookback >= 1) || !timeframe) {
      return false;
    }
    const quoted = input.prices?.[draft.source] ?? null;
    const bars = input.barsByTimeframe.get(timeframe) ?? [];
    return retraceMet({
      spec: {
        source: draft.source,
        from: draft.from,
        pct,
        lookback,
        timeframe,
      },
      price: quoted,
      bars,
    });
  }
  const parts = hardExitParts(draft);
  const timeframe =
    draft.trigger === "indicator" || draft.trigger === "trend"
      ? draft.spec?.timeframe ?? null
      : null;
  const bars = timeframe ? (input.barsByTimeframe.get(timeframe) ?? []) : [];
  return hardExitMet({
    filter: parts.filter,
    signal: parts.signal,
    side: input.side,
    closes: bars.map((row) => row.close),
    bars,
    prices: input.prices,
    firedWebhookId: input.firedWebhookId,
  });
}

/**
 * A take profit, stop, or trailing stop confirms only when a group containing
 * its price rule is met. Close confirms on its own conditions.
 */
export function exitActionGate(input: {
  action: StoredExitAction;
  side: FuturesSide;
  prices: { last: number | null; mark: number | null; index: number | null } | null;
  barsByTimeframe: Map<string, CandleBar[]>;
  firedWebhookId?: string | null;
}): { confirm: boolean; needsPrice: boolean } {
  if (input.action.groups.length === 0) {
    return {
      confirm: false,
      needsPrice: input.action.kind !== "close",
    };
  }
  let priced = false;
  let open = false;
  for (const group of input.action.groups) {
    const leaves = [group.anchor, ...group.rows];
    if (!leaves.every((draft) => leafMet(draft, input))) {
      continue;
    }
    if (leaves.some((draft) => isExitPriceRule(draft.trigger))) {
      priced = true;
    } else if (input.action.kind === "close") {
      open = true;
    }
  }
  if (input.action.kind === "close") {
    return { confirm: open || priced, needsPrice: false };
  }
  return { confirm: priced, needsPrice: true };
}

export function exitActionStackTrue(input: {
  action: StoredExitAction;
  side: FuturesSide;
  prices: { last: number | null; mark: number | null; index: number | null } | null;
  barsByTimeframe: Map<string, CandleBar[]>;
  firedWebhookId?: string | null;
}): boolean {
  return exitActionGate(input).confirm;
}

function lotQty(lots: readonly ExitLot[]): number {
  return lots.reduce((sum, lot) => sum + Math.max(0, lot.qty), 0);
}

function floorToStep(qty: number, stepQty: number): number {
  if (!(qty > QTY_EPS)) {
    return 0;
  }
  if (!(stepQty > QTY_EPS)) {
    return qty;
  }
  const steps = Math.floor((qty + QTY_EPS) / stepQty);
  return steps * stepQty;
}

function eligibleLots(
  action: StoredExitAction,
  lots: readonly ExitLot[],
  side: FuturesSide,
  mark: number,
): ExitLot[] {
  if (action.scope.kind !== "fills") {
    return lots.filter((lot) => lot.qty > QTY_EPS);
  }
  const minProfitPct = action.scope.minProfitPct;
  return lots.filter((lot) => {
    const pnl = pnlPct(side, lot.price, mark);
    return lot.qty > QTY_EPS && pnl != null && pnl >= minProfitPct;
  });
}

function scopeQty(
  action: StoredExitAction,
  eligible: readonly ExitLot[],
  unclaimedQty: number,
): number {
  if (action.scope.kind === "all" || action.scope.kind === "remainder") {
    return unclaimedQty;
  }
  if (action.scope.kind === "percent") {
    return (action.scope.pct / 100) * unclaimedQty;
  }
  if (action.scope.kind === "qty") {
    return Math.min(action.scope.qty, unclaimedQty);
  }
  return Math.min(lotQty(eligible), unclaimedQty);
}

function trailConfigured(action: StoredExitAction): boolean {
  return (
    action.trailingDistance != null ||
    action.trailingActivation != null ||
    (action.trailingPct != null && action.trailingPct > 0) ||
    (action.trailingTriggerPct != null && action.trailingTriggerPct > 0)
  );
}

function trailDistance(action: StoredExitAction, last: number): number | null {
  if (action.trailingDistance != null) {
    return action.trailingDistance;
  }
  if (action.trailingPct != null && last > 0) {
    return (last * action.trailingPct) / 100;
  }
  return null;
}

/** Activation percent or activation price has been reached, and a distance exists. */
function trailReady(input: {
  action: StoredExitAction;
  side: FuturesSide;
  last: number;
  entryPrice: number | null;
}): boolean {
  if (input.action.trailingTriggerPct != null && input.action.trailingTriggerPct > 0) {
    const entry = input.entryPrice;
    const moved = entry != null ? pnlPct(input.side, entry, input.last) : null;
    if (moved == null || moved < input.action.trailingTriggerPct) {
      return false;
    }
  }
  if (trailDistance(input.action, input.last) == null || !(input.last > 0)) {
    return false;
  }
  const activation = input.action.trailingActivation;
  if (activation == null) {
    return true;
  }
  return input.side === "long" ? input.last >= activation : input.last <= activation;
}

type PriceFire = {
  fire: boolean;
  peak: number | null;
  /** Fills whose own level fired. Null means every eligible fill. */
  lotIds: string[] | null;
  lots: Record<string, ExitLotArm> | null;
};

function lotReferenceFires(input: {
  action: StoredExitAction;
  side: FuturesSide;
  mark: number;
  last: number;
  favorable?: number;
  adverse?: number;
  lots: readonly ExitLot[];
  arm: ExitArmState;
}): PriceFire {
  const { action, side } = input;
  const favorable = input.favorable ?? input.last;
  const adverse = input.adverse ?? input.mark;
  const trailAdverse = input.adverse ?? input.last;
  const open = input.lots.filter((lot) => lot.qty > QTY_EPS);
  const previous = input.arm.lots ?? {};
  const next: Record<string, ExitLotArm> = {};
  const hit: string[] = [];
  if (action.kind === "stop_loss") {
    const pct = action.stopLossPct;
    for (const lot of open) {
      const pnl = pct != null ? pnlPct(side, lot.price, input.mark) : null;
      if (pnl != null && pnl <= -pct!) {
        hit.push(lot.id);
      }
    }
    return { fire: hit.length > 0, peak: input.arm.peak, lotIds: hit, lots: null };
  }
  if (action.kind === "breakeven") {
    const pct = action.breakevenActivationPct;
    const offset = action.breakevenOffsetPct ?? 0;
    for (const lot of open) {
      const prior = previous[lot.id] ?? { peak: null, breakeven: false };
      let latched = prior.breakeven;
      if (!latched && pct != null && pct > 0) {
        const pnl = pnlPct(side, lot.price, input.mark);
        if (pnl != null && pnl >= pct) {
          latched = true;
        }
      }
      next[lot.id] = { peak: null, breakeven: latched };
      if (!prior.breakeven || !latched) {
        continue;
      }
      const stop = dcaBreakevenPrice({ side, basisPrice: lot.price, offsetPct: offset });
      const fired = side === "long" ? adverse <= stop : adverse >= stop;
      if (fired) {
        hit.push(lot.id);
      }
    }
    return { fire: hit.length > 0, peak: input.arm.peak, lotIds: hit, lots: next };
  }
  if (action.kind !== "trailing_stop") {
    return { fire: false, peak: input.arm.peak, lotIds: null, lots: null };
  }
  let best: number | null = null;
  for (const lot of open) {
    const prior = previous[lot.id] ?? { peak: null, breakeven: false };
    if (!trailReady({ action, side, last: favorable, entryPrice: lot.price })) {
      next[lot.id] = prior;
      continue;
    }
    const distance = trailDistance(action, input.last);
    if (distance == null) {
      next[lot.id] = prior;
      continue;
    }
    const fresh = prior.peak == null;
    const peak = fresh
      ? favorable
      : side === "long"
        ? Math.max(prior.peak ?? favorable, favorable)
        : Math.min(prior.peak ?? favorable, favorable);
    next[lot.id] = { peak, breakeven: false };
    best = best == null ? peak : side === "long" ? Math.max(best, peak) : Math.min(best, peak);
    if (fresh) {
      continue;
    }
    const stop = side === "long" ? peak - distance : peak + distance;
    const fired = side === "long" ? trailAdverse <= stop : trailAdverse >= stop;
    if (fired) {
      hit.push(lot.id);
    }
  }
  return { fire: hit.length > 0, peak: best ?? input.arm.peak, lotIds: hit, lots: next };
}

function priceFires(input: {
  action: StoredExitAction;
  side: FuturesSide;
  mark: number;
  last: number;
  /** Best price on the bar. Arms a trail and tracks its peak. Defaults to last. */
  favorable?: number;
  /** Worst price on the bar. Tests whether the trail filled. Defaults to last. */
  adverse?: number;
  entryPrice: number | null;
  lots?: readonly ExitLot[];
  arm: ExitArmState;
  justArmed: boolean;
}): PriceFire {
  if (actionUsesLotReference(input.action)) {
    return lotReferenceFires({
      action: input.action,
      side: input.side,
      mark: input.mark,
      last: input.last,
      favorable: input.favorable,
      adverse: input.adverse,
      lots: input.lots ?? [],
      arm: input.arm,
    });
  }
  const { action, side, arm } = input;
  const average = (fire: boolean, peak: number | null): PriceFire => ({
    fire,
    peak,
    lotIds: null,
    lots: null,
  });
  if (action.kind === "close") {
    return average(false, arm.peak);
  }
  if (action.kind === "take_profit") {
    if (action.takeProfitPrice != null) {
      const fire =
        side === "long" ? input.mark >= action.takeProfitPrice : input.mark <= action.takeProfitPrice;
      return average(fire, arm.peak);
    }
    const entry = input.entryPrice;
    const pct = action.takeProfitPct;
    const pnl = entry != null && pct != null ? pnlPct(side, entry, input.mark) : null;
    return average(pnl != null && pnl >= pct!, arm.peak);
  }
  if (action.kind === "breakeven") {
    const pct = action.breakevenActivationPct;
    const entry = input.entryPrice;
    const pnl = entry != null && pct != null ? pnlPct(side, entry, input.mark) : null;
    return average(pnl != null && pct != null && pnl >= pct, arm.peak);
  }
  if (action.kind === "stop_loss") {
    if (action.stopLossPrice != null) {
      const fire =
        side === "long" ? input.mark <= action.stopLossPrice : input.mark >= action.stopLossPrice;
      return average(fire, arm.peak);
    }
    const entry = input.entryPrice;
    const pct = action.stopLossPct;
    const pnl = entry != null && pct != null ? pnlPct(side, entry, input.mark) : null;
    return average(pnl != null && pnl <= -pct!, arm.peak);
  }
  const peakRef = input.favorable ?? input.last;
  const hitRef = input.adverse ?? input.last;
  if (!trailReady({ action, side, last: peakRef, entryPrice: input.entryPrice })) {
    return average(false, arm.peak);
  }
  const distance = trailDistance(action, input.last);
  if (distance == null) {
    return average(false, arm.peak);
  }
  const peak = arm.peak == null || input.justArmed
    ? peakRef
    : side === "long"
      ? Math.max(arm.peak, peakRef)
      : Math.min(arm.peak, peakRef);
  if (arm.peak == null || input.justArmed) {
    return average(false, peak);
  }
  const stop = side === "long" ? peak - distance : peak + distance;
  const fire = side === "long" ? hitRef <= stop : hitRef >= stop;
  return average(fire, peak);
}

function takeQty(lots: ExitLot[], ids: Set<string>, qty: number): number {
  let left = qty;
  for (const lot of lots) {
    if (left <= QTY_EPS) {
      break;
    }
    if (!ids.has(lot.id) || lot.qty <= QTY_EPS) {
      continue;
    }
    const used = Math.min(lot.qty, left);
    lot.qty -= used;
    left -= used;
  }
  return qty - left;
}

function claimReason(kind: ExitActionKind): ExitClaim["reason"] {
  if (kind === "close") {
    return "close";
  }
  if (kind === "trailing_stop") {
    return "trailing_stop";
  }
  if (kind === "take_profit") {
    return "take_profit";
  }
  return "stop_loss";
}

/**
 * Decide which actions reduce the open position on this check.
 * Remainder runs last. A stop with scope All or a fill filter reserves those
 * lots before an earlier take profit can take them.
 */
export function planExitClaims(input: {
  actions: readonly StoredExitAction[];
  runtime: ExitRuntime;
  lots: readonly ExitLot[];
  side: FuturesSide;
  mark: number;
  last: number;
  favorable?: number;
  adverse?: number;
  entryPrice: number | null;
  nowMs: number;
  conditionTrue: Readonly<Record<string, boolean>>;
  /** When false, a matched group can fire without the price level. Defaults from the stored prices. */
  needsPrice?: Readonly<Record<string, boolean>>;
  stepQty?: number;
  breakevenDone?: boolean;
}): { claims: ExitClaim[]; runtime: ExitRuntime; lots: ExitLot[]; breakeven: ExitBreakevenMove | null } {
  const stepQty = input.stepQty ?? 0;
  const book = input.lots
    .map((lot) => ({ ...lot }))
    .filter((lot) => lot.qty > QTY_EPS);
  const runtime: ExitRuntime = {
    arms: { ...input.runtime.arms },
  };
  const openQty = lotQty(book);
  if (!(openQty > QTY_EPS) || !(input.mark > 0)) {
    return { claims: [], runtime, lots: book, breakeven: null };
  }

  const firing = new Map<string, { peak: number | null; edge: boolean; lotIds: string[] | null }>();
  for (const action of input.actions) {
    const previous = armOf(input.runtime, action.id);
    const condition = input.conditionTrue[action.id] === true;
    const alwaysArmed = action.groups.length === 0 && action.kind !== "close";
    const confirm = alwaysArmed || condition;
    const needsPrice = input.needsPrice?.[action.id] ?? actionHasNumbers(action);
    const armed = alwaysArmed || previous.armedAt != null || (confirm && needsPrice);
    const justArmed = previous.armedAt == null && armed && !alwaysArmed;
    const next: ExitArmState = {
      armedAt: armed ? (previous.armedAt ?? input.nowMs) : null,
      peak: previous.peak,
      condition: confirm,
      scopeLive: previous.scopeLive,
      ...(previous.lots ? { lots: previous.lots } : {}),
    };
    if (action.kind === "close") {
      const eligible = eligibleLots(action, book, input.side, input.mark);
      const live = lotQty(eligible) > QTY_EPS;
      const edge =
        action.groups.length === 0
          ? action.scope.kind === "fills" && live && !previous.scopeLive
          : condition && !previous.condition;
      next.scopeLive = live;
      if (edge) {
        firing.set(action.id, { peak: null, edge: true, lotIds: null });
      }
    } else if (!needsPrice) {
      if (confirm && !previous.condition) {
        firing.set(action.id, { peak: null, edge: true, lotIds: null });
      }
    } else if (armed) {
      const hit = priceFires({
        action,
        side: input.side,
        mark: input.mark,
        last: input.last,
        favorable: input.favorable,
        adverse: input.adverse,
        entryPrice: input.entryPrice,
        lots: book,
        arm: {
          ...previous,
          peak: justArmed ? null : previous.peak,
          lots: justArmed ? {} : previous.lots,
        },
        justArmed,
      });
      next.peak = hit.peak;
      if (hit.lots) {
        const live = new Set(book.map((lot) => lot.id));
        const profitIds =
          action.kind === "breakeven" && action.scope.kind === "fills"
            ? new Set(
                eligibleLots(
                  action,
                  book,
                  input.side,
                  input.favorable ?? input.mark,
                ).map((lot) => lot.id),
              )
            : null;
        const kept: Record<string, ExitLotArm> = {};
        for (const [id, state] of Object.entries(hit.lots)) {
          if (!live.has(id)) {
            continue;
          }
          const wasLatched = previous.lots?.[id]?.breakeven === true;
          kept[id] =
            profitIds && state.breakeven && !wasLatched && !profitIds.has(id)
              ? { ...state, breakeven: false }
              : state;
        }
        next.lots = kept;
      }
      const lotIds =
        hit.lotIds == null
          ? null
          : hit.lotIds.filter((id) => next.lots?.[id]?.breakeven !== false || action.kind !== "breakeven");
      if (hit.fire && confirm && (lotIds == null || lotIds.length > 0)) {
        firing.set(action.id, { peak: hit.peak, edge: false, lotIds });
      }
    }
    runtime.arms[action.id] = next;
  }

  const reserved = new Set<string>();
  for (const action of input.actions) {
    if (!firing.has(action.id) || action.kind !== "stop_loss") {
      continue;
    }
    if (action.scope.kind !== "all" && action.scope.kind !== "fills") {
      continue;
    }
    const allowed = firing.get(action.id)?.lotIds;
    const eligible = eligibleLots(action, book, input.side, input.mark).filter(
      (lot) => allowed == null || allowed.includes(lot.id),
    );
    for (const lot of eligible) {
      reserved.add(lot.id);
    }
  }

  let breakeven: ExitBreakevenMove | null = null;
  const claims: ExitClaim[] = [];
  const ordered = [
    ...input.actions.filter((action) => action.scope.kind !== "remainder"),
    ...input.actions.filter((action) => action.scope.kind === "remainder"),
  ];
  for (const action of ordered) {
    if (!firing.has(action.id)) {
      continue;
    }
    if (action.kind === "breakeven" && !actionUsesLotReference(action)) {
      if (
        !input.breakevenDone &&
        breakeven == null &&
        action.breakevenActivationPct != null &&
        action.breakevenActivationPct > 0
      ) {
        const remaining = book.filter((lot) => lot.qty > QTY_EPS);
        const eligible = eligibleLots(action, remaining, input.side, input.mark);
        const basis =
          action.scope.kind === "fills" ? lotQty(eligible) : lotQty(remaining);
        const wanted = floorToStep(scopeQty(action, eligible, basis), stepQty);
        if (action.scope.kind === "all" || wanted > QTY_EPS) {
          breakeven = {
            activationPct: action.breakevenActivationPct,
            offsetPct: action.breakevenOffsetPct ?? 0,
            qty: action.scope.kind === "all" ? null : wanted,
          };
        }
      }
      continue;
    }
    const remaining = book.filter((lot) => lot.qty > QTY_EPS);
    const lotIds = firing.get(action.id)?.lotIds ?? null;
    const perLotBreakeven = action.kind === "breakeven" && actionUsesLotReference(action);
    const eligible = (
      perLotBreakeven
        ? remaining
        : eligibleLots(action, remaining, input.side, input.mark)
    ).filter(
      (lot) =>
        (lotIds == null || lotIds.includes(lot.id)) &&
        (action.kind === "stop_loss" || perLotBreakeven || !reserved.has(lot.id)),
    );
    const unclaimed = lotQty(eligible);
    const wanted = floorToStep(scopeQty(action, eligible, unclaimed), stepQty);
    if (!(wanted > QTY_EPS)) {
      continue;
    }
    const taken = takeQty(
      book,
      new Set(eligible.map((lot) => lot.id)),
      wanted,
    );
    const qty = floorToStep(taken, stepQty);
    if (!(qty > QTY_EPS)) {
      continue;
    }
    claims.push({
      actionId: action.id,
      kind: action.kind,
      qty,
      reason: claimReason(action.kind),
    });
  }
  return {
    claims,
    runtime,
    lots: book.filter((lot) => lot.qty > QTY_EPS),
    breakeven,
  };
}

const EXIT_KINDS: ExitActionKind[] = [
  "take_profit",
  "trailing_stop",
  "stop_loss",
  "breakeven",
  "close",
];

function coverageOf(openQty: number, qtys: readonly number[]): ExitCoverageSnapshot {
  const positive = qtys.filter((qty) => qty > QTY_EPS);
  const provenQty = positive.length === 0 ? 0 : Math.min(openQty, Math.max(...positive));
  const stackedQty = Math.min(
    openQty,
    positive.reduce((sum, qty) => sum + qty, 0),
  );
  const pct = (qty: number) => (openQty > QTY_EPS ? (qty / openQty) * 100 : null);
  return {
    openQty,
    provenQty,
    stackedQty,
    provenPct: pct(provenQty),
    stackedPct: pct(stackedQty),
  };
}

function emptyCoverage(openQty: number): ExitCoverageSnapshot {
  return coverageOf(openQty, []);
}

function leafLabel(draft: HardExitDraft): string {
  if (isExitPriceRule(draft.trigger)) {
    return exitPriceRuleLabel(draft.trigger);
  }
  if (draft.trigger === "indicator") {
    return "Indicator";
  }
  if (draft.trigger === "trend") {
    return "Trend";
  }
  if (draft.trigger === "webhook") {
    return "Signal webhook";
  }
  if (draft.trigger === "price") {
    return "Price cross";
  }
  if (draft.trigger === "retrace") {
    return "Retrace";
  }
  return "Condition";
}

function leafSnapshot(
  draft: HardExitDraft,
  input: {
    side: FuturesSide;
    prices: { last: number | null; mark: number | null; index: number | null } | null;
    barsByTimeframe: Map<string, CandleBar[]>;
    firedWebhookId?: string | null;
    priceMet: boolean | null;
  },
): ExitLeafSnapshot {
  if (isExitPriceRule(draft.trigger)) {
    return { trigger: draft.trigger, label: leafLabel(draft), met: input.priceMet };
  }
  if (draft.trigger === "indicator" || draft.trigger === "trend") {
    const timeframe = draft.spec?.timeframe ?? null;
    const bars = timeframe ? (input.barsByTimeframe.get(timeframe) ?? []) : [];
    if (bars.length === 0) {
      return { trigger: draft.trigger, label: leafLabel(draft), met: null };
    }
  }
  return {
    trigger: draft.trigger,
    label: leafLabel(draft),
    met: leafMet(draft, input),
  };
}

/** Resting stop, tracking trail, or latched breakeven price. Null when that stop is not on. */
function protectiveStopPrice(input: {
  action: StoredExitAction;
  side: FuturesSide;
  entryPrice: number | null;
  last: number;
  peak: number | null;
}): number | null {
  const { action, side, entryPrice } = input;
  if (action.kind === "stop_loss") {
    if (action.stopLossPrice != null && action.stopLossPrice > 0) {
      return action.stopLossPrice;
    }
    if (entryPrice == null) {
      return null;
    }
    return dcaStopLossPrice({
      side,
      firstPrice: entryPrice,
      averagePrice: entryPrice,
      stopLossPct: action.stopLossPct,
      stopLossBasis: "average",
    });
  }
  if (action.kind === "trailing_stop") {
    const distance = trailDistance(action, input.last);
    if (input.peak == null || distance == null || !(distance > 0)) {
      return null;
    }
    const stop = side === "long" ? input.peak - distance : input.peak + distance;
    return stop > 0 ? stop : null;
  }
  if (action.kind === "breakeven" && entryPrice != null && entryPrice > 0) {
    const price = dcaBreakevenPrice({
      side,
      basisPrice: entryPrice,
      offsetPct: action.breakevenOffsetPct ?? 0,
    });
    return price > 0 ? price : null;
  }
  return null;
}

/** Long: stop at or above entry. Short: stop at or below entry. Equal is not a loss. */
function stopAvoidsLoss(
  side: FuturesSide,
  entryPrice: number | null,
  stop: number | null,
): boolean {
  if (entryPrice == null || !(entryPrice > 0) || stop == null || !(stop > 0)) {
    return false;
  }
  return side === "long" ? stop + 1e-9 >= entryPrice : stop <= entryPrice + 1e-9;
}

/** Read-only picture of every exit action and the coverage they share. */
export function describeExitBook(input: {
  source: ExitBookSnapshot["source"];
  actions: readonly StoredExitAction[];
  runtime: ExitRuntime;
  lots: readonly ExitLot[];
  side: FuturesSide;
  mark: number;
  last: number;
  favorable?: number;
  adverse?: number;
  entryPrice: number | null;
  nowMs: number;
  claims: readonly ExitClaim[];
  breakevenDone?: boolean;
  breakeven?: ExitBreakevenMove | null;
  barsByTimeframe?: Map<string, CandleBar[]>;
  firedWebhookId?: string | null;
  prices?: { last: number | null; mark: number | null; index: number | null } | null;
}): ExitBookSnapshot {
  const openQty = lotQty(input.lots);
  const barsByTimeframe = input.barsByTimeframe ?? new Map<string, CandleBar[]>();
  const prices = input.prices ?? {
    last: input.last,
    mark: input.mark,
    index: null,
  };
  const noLossQtys: number[] = [];
  const actions = input.actions.map((action) => {
    const arm = armOf(input.runtime, action.id);
    const claimQty = input.claims
      .filter((claim) => claim.actionId === action.id)
      .reduce((sum, claim) => sum + claim.qty, 0);
    const eligible = eligibleLots(action, input.lots, input.side, input.mark);
    const appliesQty =
      action.scope.kind === "remainder"
        ? 0
        : scopeQty(action, eligible, action.scope.kind === "fills" ? lotQty(eligible) : openQty);
    const hit = priceFires({
      action,
      side: input.side,
      mark: input.mark,
      last: input.last,
      favorable: input.favorable,
      adverse: input.adverse,
      entryPrice: input.entryPrice,
      lots: input.lots,
      arm,
      justArmed: false,
    });
    const activationMet =
      action.kind === "trailing_stop"
        ? actionUsesLotReference(action)
          ? Object.values(arm.lots ?? {}).some((lot) => lot.peak != null)
          : trailReady({
              action,
              side: input.side,
              last: input.last,
              entryPrice: input.entryPrice,
            })
        : null;
    const priceMet = action.kind === "close" ? null : hit.fire;
    const groups = action.groups.map((group) => {
      const leaves = [group.anchor, ...group.rows].map((draft) =>
        leafSnapshot(draft, {
          side: input.side,
          prices,
          barsByTimeframe,
          firedWebhookId: input.firedWebhookId,
          priceMet,
        }),
      );
      return { met: leaves.length > 0 && leaves.every((leaf) => leaf.met === true), leaves };
    });
    const conditionsMet = groups.some((group) => group.met);
    const configured = action.kind === "close" || actionHasNumbers(action) || action.groups.length > 0;
    let status: ExitActionStatus = configured ? "waiting" : "off";
    let protectingQty = 0;
    if (action.kind === "breakeven" && input.breakevenDone) {
      status = "done";
      protectingQty = appliesQty;
    } else if (
      action.kind === "breakeven" &&
      input.breakeven != null &&
      input.breakeven.activationPct === action.breakevenActivationPct
    ) {
      status = "moving";
    } else if (claimQty > QTY_EPS) {
      status = "firing";
      if (action.kind === "stop_loss" || action.kind === "trailing_stop") {
        protectingQty = appliesQty > QTY_EPS ? appliesQty : claimQty;
      }
    } else if (
      action.kind === "stop_loss" &&
      actionHasNumbers(action) &&
      action.scope.kind !== "remainder"
    ) {
      status = "protecting";
      protectingQty = appliesQty;
    } else if (action.kind === "trailing_stop" && arm.peak != null && activationMet === true) {
      status = "protecting";
      protectingQty = appliesQty;
    } else if (action.kind === "trailing_stop" && arm.armedAt != null) {
      status = "armed";
    }
    if (action.kind === "breakeven" && actionUsesLotReference(action) && claimQty <= QTY_EPS) {
      const latchedQty = input.lots.reduce((sum, lot) => {
        return arm.lots?.[lot.id]?.breakeven ? sum + Math.max(0, lot.qty) : sum;
      }, 0);
      if (latchedQty > QTY_EPS) {
        status = "protecting";
        protectingQty = latchedQty;
      }
    }
    if (
      protectingQty > QTY_EPS &&
      stopAvoidsLoss(
        input.side,
        input.entryPrice,
        protectiveStopPrice({
          action,
          side: input.side,
          entryPrice: input.entryPrice,
          last: input.last,
          peak: arm.peak,
        }),
      )
    ) {
      noLossQtys.push(protectingQty);
    }
    return {
      id: action.id,
      kind: action.kind,
      scope: action.scope,
      status,
      conditionsMet,
      priceMet,
      activationMet,
      scopeQty: action.scope.kind === "remainder" ? openQty : appliesQty,
      protectingQty,
      claimQty,
      groups,
    };
  });
  const protecting = (kinds: readonly ExitActionKind[]) =>
    coverageOf(
      openQty,
      actions.filter((action) => kinds.includes(action.kind)).map((action) => action.protectingQty),
    );
  const byKind = Object.fromEntries(
    EXIT_KINDS.map((kind) => [kind, protecting([kind])]),
  ) as Record<ExitActionKind, ExitCoverageSnapshot>;
  return {
    atMs: input.nowMs,
    source: input.source,
    openQty,
    actions,
    byKind,
    protective: protecting(["stop_loss", "trailing_stop", "breakeven"]),
    noLoss: coverageOf(openQty, noLossQtys),
    trailingOrBreakeven: protecting(["trailing_stop", "breakeven"]),
  };
}

const CLASSIC_EXIT_IDS = {
  take_profit: "classic:take_profit",
  stop_loss: "classic:stop_loss",
  trailing_stop: "classic:trailing_stop",
  breakeven: "classic:breakeven",
} as const;

function classicScope(qty: number | null | undefined): SavedExitScope {
  return qty != null && qty > 0 ? { kind: "qty", qty } : { kind: "all" };
}

function classicAction(
  kind: Exclude<ExitActionKind, "close">,
  scope: SavedExitScope,
  prices: Partial<ExitSidePrices>,
): StoredExitAction {
  const trigger =
    kind === "take_profit" ? "target" : kind === "stop_loss" ? "stop" : kind === "trailing_stop" ? "trail" : "profit";
  return {
    id: CLASSIC_EXIT_IDS[kind],
    kind,
    scope,
    groups: [{ anchor: { trigger }, rows: [] }],
    takeProfitPct: null,
    takeProfitPrice: null,
    stopLossPct: null,
    stopLossPrice: null,
    trailingDistance: null,
    trailingActivation: null,
    ...prices,
  };
}

/** Column exits use the same book as an action list, with one card per column that is set. */
export function exitBookForClassic(input: {
  side: FuturesSide;
  qty: number;
  entryPrice: number | null;
  mark: number;
  last: number;
  nowMs: number;
  breakevenDone?: boolean;
  trailingPeak?: number | null;
  takeProfitPct?: number | null;
  takeProfitPrice?: number | null;
  takeProfitQty?: number | null;
  stopLossPct?: number | null;
  stopLossPrice?: number | null;
  stopLossQty?: number | null;
  trailingDistance?: number | null;
  trailingPct?: number | null;
  trailingActivation?: number | null;
  trailingTriggerPct?: number | null;
  breakevenActivationPct?: number | null;
  breakevenOffsetPct?: number | null;
  /** Set on the check that is about to move the stop. Coverage stays at zero until the move latches. */
  breakeven?: ExitBreakevenMove | null;
}): ExitBookSnapshot {
  const actions: StoredExitAction[] = [];
  if (input.takeProfitPrice != null || input.takeProfitPct != null) {
    actions.push(
      classicAction("take_profit", classicScope(input.takeProfitQty), {
        takeProfitPrice: input.takeProfitPrice ?? null,
        takeProfitPct: input.takeProfitPrice != null ? null : (input.takeProfitPct ?? null),
      }),
    );
  }
  if (input.stopLossPrice != null || input.stopLossPct != null) {
    actions.push(
      classicAction("stop_loss", classicScope(input.stopLossQty), {
        stopLossPrice: input.stopLossPrice ?? null,
        stopLossPct: input.stopLossPrice != null ? null : (input.stopLossPct ?? null),
      }),
    );
  }
  if (
    input.trailingDistance != null ||
    (input.trailingPct != null && input.trailingPct > 0) ||
    input.trailingActivation != null ||
    (input.trailingTriggerPct != null && input.trailingTriggerPct > 0)
  ) {
    actions.push(
      classicAction("trailing_stop", { kind: "all" }, {
        trailingDistance: input.trailingDistance ?? null,
        trailingPct: input.trailingPct ?? null,
        trailingActivation: input.trailingActivation ?? null,
        trailingTriggerPct: input.trailingTriggerPct ?? null,
      }),
    );
  }
  if (input.breakevenActivationPct != null || input.breakevenDone) {
    actions.push(
      classicAction("breakeven", { kind: "all" }, {
        breakevenActivationPct: input.breakevenActivationPct ?? null,
        breakevenOffsetPct: input.breakevenOffsetPct ?? 0,
      }),
    );
  }
  const runtime = emptyExitRuntime();
  if (input.trailingPeak != null && input.trailingPeak > 0) {
    runtime.arms[CLASSIC_EXIT_IDS.trailing_stop] = {
      armedAt: input.nowMs,
      peak: input.trailingPeak,
      condition: true,
      scopeLive: true,
    };
  }
  const lots =
    input.qty > QTY_EPS && input.entryPrice != null && input.entryPrice > 0
      ? [{ id: "position", qty: input.qty, price: input.entryPrice }]
      : [];
  return describeExitBook({
    source: "classic",
    actions,
    runtime,
    lots,
    side: input.side,
    mark: input.mark,
    last: input.last,
    entryPrice: input.entryPrice,
    nowMs: input.nowMs,
    claims: [],
    breakevenDone: input.breakevenDone,
    breakeven: input.breakeven,
  });
}

/** Drop closed coins from the oldest fills. */
export function reduceOpenLots(lots: readonly ExitLot[], qty: number): ExitLot[] {
  let left = qty;
  const next = lots.map((lot) => ({ ...lot }));
  for (const lot of next) {
    if (left <= QTY_EPS) {
      break;
    }
    const used = Math.min(lot.qty, left);
    lot.qty -= used;
    left -= used;
  }
  return next.filter((lot) => lot.qty > QTY_EPS);
}

/** Rebuild open lots from entry fills minus later flatten orders. */
export function openLotsFromFills(
  fills: readonly { id: string; action: string; qty: number; price: number | null }[],
  side: FuturesSide,
): ExitLot[] {
  const entryAction = side === "long" ? "buy" : "sell";
  const lots: ExitLot[] = [];
  for (const fill of fills) {
    if (
      fill.action === entryAction &&
      fill.price != null &&
      fill.price > 0 &&
      fill.qty > 0
    ) {
      lots.push({ id: fill.id, qty: fill.qty, price: fill.price });
      continue;
    }
    if (fill.action !== "flatten" || !(fill.qty > 0)) {
      continue;
    }
    let left = fill.qty;
    for (const lot of lots) {
      if (left <= QTY_EPS) {
        break;
      }
      const used = Math.min(lot.qty, left);
      lot.qty -= used;
      left -= used;
    }
  }
  return lots.filter((lot) => lot.qty > QTY_EPS);
}

export function mergeEntryLots(
  existing: readonly ExitLot[],
  fills: readonly { id: string; action: string; qty: number; price: number | null }[],
  side: FuturesSide,
): ExitLot[] {
  const entryAction = side === "long" ? "buy" : "sell";
  const known = new Set(existing.map((lot) => lot.id));
  const next = existing.map((lot) => ({ ...lot }));
  for (const fill of fills) {
    if (fill.action !== entryAction || known.has(fill.id) || !(fill.qty > 0) || !(fill.price != null && fill.price > 0)) {
      continue;
    }
    next.push({ id: fill.id, qty: fill.qty, price: fill.price });
    known.add(fill.id);
  }
  return next;
}

function coverageFromJson(value: unknown, openQty: number): ExitCoverageSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Partial<ExitCoverageSnapshot>;
  const provenQty = finiteOrNull(row.provenQty);
  const stackedQty = finiteOrNull(row.stackedQty);
  if (provenQty == null || stackedQty == null) {
    return null;
  }
  return {
    openQty,
    provenQty,
    stackedQty,
    provenPct: finiteOrNull(row.provenPct),
    stackedPct: finiteOrNull(row.stackedPct),
  };
}

export function exitBookFromJson(value: unknown): ExitBookSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Partial<ExitBookSnapshot> & { actions?: unknown; byKind?: unknown };
  if (row.source !== "actions" && row.source !== "classic") {
    return null;
  }
  if (!Array.isArray(row.actions)) {
    return null;
  }
  const openQty = finiteOrNull(row.openQty) ?? 0;
  const actions: ExitActionSnapshot[] = [];
  for (const item of row.actions) {
    if (!item || typeof item !== "object") {
      return null;
    }
    const action = item as Partial<ExitActionSnapshot>;
    if (typeof action.id !== "string" || !EXIT_KINDS.includes(action.kind as ExitActionKind)) {
      return null;
    }
    const scope = scopeFromJson(action.scope);
    if (!scope) {
      return null;
    }
    actions.push({
      id: action.id,
      kind: action.kind as ExitActionKind,
      scope,
      status:
        action.status === "off" ||
        action.status === "waiting" ||
        action.status === "armed" ||
        action.status === "protecting" ||
        action.status === "moving" ||
        action.status === "firing" ||
        action.status === "done"
          ? action.status
          : "waiting",
      conditionsMet: action.conditionsMet === true,
      priceMet: action.priceMet == null ? null : action.priceMet === true,
      activationMet: action.activationMet == null ? null : action.activationMet === true,
      scopeQty: finiteOrNull(action.scopeQty) ?? 0,
      protectingQty: finiteOrNull(action.protectingQty) ?? 0,
      claimQty: finiteOrNull(action.claimQty) ?? 0,
      groups: Array.isArray(action.groups)
        ? action.groups.flatMap((group) => {
            if (!group || typeof group !== "object") {
              return [];
            }
            const leaves = Array.isArray(group.leaves)
              ? group.leaves.flatMap((leaf) => {
                  if (!leaf || typeof leaf !== "object" || typeof leaf.trigger !== "string") {
                    return [];
                  }
                  return [
                    {
                      trigger: leaf.trigger,
                      label: typeof leaf.label === "string" ? leaf.label : leaf.trigger,
                      met: leaf.met == null ? null : leaf.met === true,
                    },
                  ];
                })
              : [];
            return [{ met: group.met === true, leaves }];
          })
        : [],
    });
  }
  const byKind = {} as Record<ExitActionKind, ExitCoverageSnapshot>;
  const rawKinds =
    row.byKind && typeof row.byKind === "object" ? (row.byKind as Record<string, unknown>) : {};
  for (const kind of EXIT_KINDS) {
    byKind[kind] = coverageFromJson(rawKinds[kind], openQty) ?? emptyCoverage(openQty);
  }
  return {
    atMs: finiteOrNull(row.atMs) ?? 0,
    source: row.source,
    openQty,
    actions,
    byKind,
    protective: coverageFromJson(row.protective, openQty) ?? emptyCoverage(openQty),
    noLoss: coverageFromJson(row.noLoss, openQty) ?? emptyCoverage(openQty),
    trailingOrBreakeven:
      coverageFromJson(row.trailingOrBreakeven, openQty) ?? emptyCoverage(openQty),
  };
}

function lotArmsFromJson(value: unknown): Record<string, ExitLotArm> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const lots: Record<string, ExitLotArm> = {};
  for (const [id, arm] of Object.entries(value as Record<string, unknown>)) {
    if (!arm || typeof arm !== "object" || Array.isArray(arm)) {
      continue;
    }
    const row = arm as { peak?: unknown; breakeven?: unknown };
    lots[id] = {
      peak: positiveOrNull(row.peak),
      breakeven: row.breakeven === true,
    };
  }
  return Object.keys(lots).length > 0 ? lots : null;
}

export function exitRuntimeFromJson(value: unknown): ExitRuntime {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyExitRuntime();
  }
  const row = value as { arms?: unknown; book?: unknown };
  if (!row.arms || typeof row.arms !== "object" || Array.isArray(row.arms)) {
    return emptyExitRuntime();
  }
  const arms: ExitRuntime["arms"] = {};
  for (const [id, arm] of Object.entries(row.arms as Record<string, unknown>)) {
    if (!arm || typeof arm !== "object") {
      continue;
    }
    const item = arm as Partial<ExitArmState>;
    const lots = lotArmsFromJson((item as { lots?: unknown }).lots);
    arms[id] = {
      armedAt: finiteOrNull(item.armedAt),
      peak: positiveOrNull(item.peak),
      condition: item.condition === true,
      scopeLive: item.scopeLive === true,
      ...(lots ? { lots } : {}),
    };
  }
  const book = exitBookFromJson(row.book);
  return book ? { arms, book } : { arms };
}

export function actionKindLabel(kind: ExitActionKind | ClassicExitKind | "custom"): string {
  if (kind === "take_profit") {
    return "Take profit";
  }
  if (kind === "trailing_stop") {
    return "Trailing stop";
  }
  if (kind === "stop_loss") {
    return "Stop loss";
  }
  if (kind === "breakeven") {
    return "Breakeven Stop";
  }
  return "Close";
}

export function scopeLabel(scope: ExitScope | StoredExitAction["scope"]): string {
  if (scope.kind === "all") {
    return "Entire Position";
  }
  if (scope.kind === "remainder") {
    return "Remainder";
  }
  if (scope.kind === "percent") {
    return scope.pct == null ? "Percentage of Position" : `${scope.pct}% of position`;
  }
  if (scope.kind === "qty") {
    return scope.qty == null ? "Quantity" : `Quantity ${scope.qty}`;
  }
  return scope.minProfitPct == null
    ? "Fills in profit"
    : `Fills at least ${scope.minProfitPct}% in profit`;
}

export function blankClause(): ExitBuilderClause {
  return emptyExitClause();
}
