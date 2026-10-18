import {
  hardExitMet,
  hardExitParts,
  isExitPriceRule,
  type HardExitDraft,
} from "@/lib/dca/hard-exit";
import type { FuturesSide } from "@/lib/futures/model";
import type { CandleBar } from "@/lib/market/candles";
import {
  clauseHasPriceRule,
  clauseLevels,
  clauseOrGroups,
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
  type ExitRepeatLevels,
  type ExitScope,
} from "@/lib/strategy/exit-clauses";

export type ExitActionKind = "take_profit" | "trailing_stop" | "stop_loss" | "close";

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
  };
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
};

/** A Flex percent gate or a DCA price gate cannot live on the classic columns. */
export function trailFitsColumns(prices: ExitSidePrices): boolean {
  const priceGate = prices.trailingActivation != null;
  const pctGate = prices.trailingTriggerPct != null && prices.trailingTriggerPct > 0;
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

export type ExitArmState = {
  armedAt: number | null;
  peak: number | null;
  condition: boolean;
  scopeLive: boolean;
};

export type ExitRuntime = {
  arms: Record<string, ExitArmState>;
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
    row.trigger !== "target" &&
    row.trigger !== "stop" &&
    row.trigger !== "trail" &&
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
      groups,
      takeProfitPct: positiveOrNull(row.takeProfitPct),
      takeProfitPrice: positiveOrNull(row.takeProfitPrice),
      stopLossPct: positiveOrNull(row.stopLossPct),
      stopLossPrice: positiveOrNull(row.stopLossPrice),
      trailingDistance: positiveOrNull(row.trailingDistance),
      trailingActivation: positiveOrNull(row.trailingActivation),
      trailingPct: positiveOrNull(row.trailingPct),
      trailingTriggerPct: positiveOrNull(row.trailingTriggerPct),
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
  };
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
        : { ...blank, trailingDistance: trail, trailingTriggerPct: trigger };
    }
    return activationPrice
      ? { ...blank, trailingPct: trail, trailingActivation: trigger }
      : { ...blank, trailingPct: trail, trailingTriggerPct: trigger };
  }
  return blank;
}

/** Null when the side still belongs on the classic columns. */
export function exitActionsForSave(
  clauses: readonly ExitBuilderClause[],
  prices: ExitSidePrices,
): StoredExitAction[] | null {
  const trailingCard = clauses.some((clause) => clause.kind === "trailing_stop");
  if (exitSideUsesColumns(clauses) && (!trailingCard || trailFitsColumns(prices))) {
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
    actions.push({
      id: clause.key,
      kind,
      scope,
      groups: groupsOf(clause),
      ...pricesFor(clause, seenCount, prices),
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
  return actions.map((action) => {
    const seenCount = (seen.get(action.kind) ?? 0) + 1;
    seen.set(action.kind, seenCount);
    const [first, ...rest] = action.groups;
    const kind = action.kind === "close" ? "custom" : action.kind;
    const base =
      kind === "custom"
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
    return pinExitPriceRule({
      ...base,
      anchor: first?.anchor ?? { trigger: "unset" },
      rows,
      orGroups,
      scope: action.scope,
      ownPct: null,
      ownDistance: null,
      levels: seenCount > 1 ? levelsForAction(action) : undefined,
    });
  });
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
    return (
      action.trailingDistance != null ||
      action.trailingActivation != null ||
      (action.trailingPct != null && action.trailingPct > 0) ||
      (action.trailingTriggerPct != null && action.trailingTriggerPct > 0)
    );
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
  entryPrice: number | null;
  nowMs: number;
  barsByTimeframe: Map<string, CandleBar[]>;
  firedWebhookId?: string | null;
  stepQty?: number;
  prices?: { last: number | null; mark: number | null; index: number | null } | null;
}): { claims: ExitClaim[]; runtime: ExitRuntime; lots: ExitLot[] } {
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
  return planExitClaims({
    actions: input.actions,
    runtime: input.runtime,
    lots: input.lots,
    side: input.side,
    mark: input.mark,
    last: input.last,
    entryPrice: input.entryPrice,
    nowMs: input.nowMs,
    conditionTrue,
    needsPrice,
    stepQty: input.stepQty,
  });
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

function priceFires(input: {
  action: StoredExitAction;
  side: FuturesSide;
  mark: number;
  last: number;
  entryPrice: number | null;
  arm: ExitArmState;
  justArmed: boolean;
}): { fire: boolean; peak: number | null } {
  const { action, side, arm } = input;
  if (action.kind === "close") {
    return { fire: false, peak: arm.peak };
  }
  if (action.kind === "take_profit") {
    if (action.takeProfitPrice != null) {
      const fire =
        side === "long" ? input.mark >= action.takeProfitPrice : input.mark <= action.takeProfitPrice;
      return { fire, peak: arm.peak };
    }
    const entry = input.entryPrice;
    const pct = action.takeProfitPct;
    const pnl = entry != null && pct != null ? pnlPct(side, entry, input.mark) : null;
    return { fire: pnl != null && pnl >= pct!, peak: arm.peak };
  }
  if (action.kind === "stop_loss") {
    if (action.stopLossPrice != null) {
      const fire =
        side === "long" ? input.mark <= action.stopLossPrice : input.mark >= action.stopLossPrice;
      return { fire, peak: arm.peak };
    }
    const entry = input.entryPrice;
    const pct = action.stopLossPct;
    const pnl = entry != null && pct != null ? pnlPct(side, entry, input.mark) : null;
    return { fire: pnl != null && pnl <= -pct!, peak: arm.peak };
  }
  if (action.trailingTriggerPct != null && action.trailingTriggerPct > 0) {
    const entry = input.entryPrice;
    const moved = entry != null ? pnlPct(side, entry, input.last) : null;
    if (moved == null || moved < action.trailingTriggerPct) {
      return { fire: false, peak: arm.peak };
    }
  }
  const distance =
    action.trailingDistance ??
    (action.trailingPct != null && input.last > 0
      ? (input.last * action.trailingPct) / 100
      : null);
  if (distance == null) {
    return { fire: false, peak: arm.peak };
  }
  const ref = input.last;
  if (!(ref > 0)) {
    return { fire: false, peak: arm.peak };
  }
  const activation = action.trailingActivation;
  if (activation != null) {
    const reached = side === "long" ? ref >= activation : ref <= activation;
    if (!reached) {
      return { fire: false, peak: arm.peak };
    }
  }
  const peak = arm.peak == null || input.justArmed
    ? ref
    : side === "long"
      ? Math.max(arm.peak, ref)
      : Math.min(arm.peak, ref);
  if (arm.peak == null || input.justArmed) {
    return { fire: false, peak };
  }
  const stop = side === "long" ? peak - distance : peak + distance;
  const fire = side === "long" ? ref <= stop : ref >= stop;
  return { fire, peak };
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
  entryPrice: number | null;
  nowMs: number;
  conditionTrue: Readonly<Record<string, boolean>>;
  /** When false, a matched group can fire without the price level. Defaults from the stored prices. */
  needsPrice?: Readonly<Record<string, boolean>>;
  stepQty?: number;
}): { claims: ExitClaim[]; runtime: ExitRuntime; lots: ExitLot[] } {
  const stepQty = input.stepQty ?? 0;
  const book = input.lots
    .map((lot) => ({ ...lot }))
    .filter((lot) => lot.qty > QTY_EPS);
  const runtime: ExitRuntime = {
    arms: { ...input.runtime.arms },
  };
  const openQty = lotQty(book);
  if (!(openQty > QTY_EPS) || !(input.mark > 0)) {
    return { claims: [], runtime, lots: book };
  }

  const firing = new Map<string, { peak: number | null; edge: boolean }>();
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
        firing.set(action.id, { peak: null, edge: true });
      }
    } else if (!needsPrice) {
      if (confirm && !previous.condition) {
        firing.set(action.id, { peak: null, edge: true });
      }
    } else if (armed) {
      const hit = priceFires({
        action,
        side: input.side,
        mark: input.mark,
        last: input.last,
        entryPrice: input.entryPrice,
        arm: { ...previous, peak: justArmed ? null : previous.peak },
        justArmed,
      });
      next.peak = hit.peak;
      if (hit.fire && confirm) {
        firing.set(action.id, { peak: hit.peak, edge: false });
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
    const eligible = eligibleLots(action, book, input.side, input.mark);
    for (const lot of eligible) {
      reserved.add(lot.id);
    }
  }

  const claims: ExitClaim[] = [];
  const ordered = [
    ...input.actions.filter((action) => action.scope.kind !== "remainder"),
    ...input.actions.filter((action) => action.scope.kind === "remainder"),
  ];
  for (const action of ordered) {
    if (!firing.has(action.id)) {
      continue;
    }
    const remaining = book.filter((lot) => lot.qty > QTY_EPS);
    const eligible = eligibleLots(action, remaining, input.side, input.mark).filter(
      (lot) => action.kind === "stop_loss" || !reserved.has(lot.id),
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
      reason: action.kind === "close" ? "close" : action.kind,
    });
  }
  return {
    claims,
    runtime,
    lots: book.filter((lot) => lot.qty > QTY_EPS),
  };
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

export function exitRuntimeFromJson(value: unknown): ExitRuntime {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyExitRuntime();
  }
  const row = value as { arms?: unknown };
  if (!row.arms || typeof row.arms !== "object" || Array.isArray(row.arms)) {
    return emptyExitRuntime();
  }
  const arms: ExitRuntime["arms"] = {};
  for (const [id, arm] of Object.entries(row.arms as Record<string, unknown>)) {
    if (!arm || typeof arm !== "object") {
      continue;
    }
    const item = arm as Partial<ExitArmState>;
    arms[id] = {
      armedAt: finiteOrNull(item.armedAt),
      peak: positiveOrNull(item.peak),
      condition: item.condition === true,
      scopeLive: item.scopeLive === true,
    };
  }
  return { arms };
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
