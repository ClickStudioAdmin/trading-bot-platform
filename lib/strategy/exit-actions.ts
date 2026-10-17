import { hardExitMet, hardExitParts, type HardExitDraft } from "@/lib/dca/hard-exit";
import type { FuturesSide } from "@/lib/futures/model";
import type { CandleBar } from "@/lib/market/candles";
import {
  clauseOrGroups,
  clauseScope,
  classicExitClause,
  customExitClause,
  emptyExitClause,
  isClassicExitKind,
  type ClassicExitKind,
  type ExitBuilderClause,
  type ExitOrGroup,
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
};

export type ExitSidePrices = {
  takeProfitPct: number | null;
  takeProfitPrice: number | null;
  stopLossPct: number | null;
  stopLossPrice: number | null;
  trailingDistance: number | null;
  trailingActivation: number | null;
  trailingPct?: number | null;
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
  trailingPct?: string | null;
}): ExitSidePrices {
  const takeProfit = levelNumber(input.takeProfit);
  const stopLoss = levelNumber(input.stopLoss);
  const takeProfitKind = input.takeProfitKind === "price" ? "price" : "percent";
  const stopLossKind = input.stopLossKind === "price" ? "price" : "percent";
  return {
    takeProfitPct: takeProfitKind === "percent" ? takeProfit : null,
    takeProfitPrice: takeProfitKind === "price" ? takeProfit : null,
    stopLossPct: stopLossKind === "percent" ? stopLoss : null,
    stopLossPrice: stopLossKind === "price" ? stopLoss : null,
    trailingDistance: levelNumber(input.trailingDistance),
    trailingActivation: levelNumber(input.trailingActivation),
    trailingPct: levelNumber(input.trailingPct),
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
};

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
  return (
    clause.anchor.trigger !== "unset" ||
    clause.rows.length > 0 ||
    clauseOrGroups(clause).length > 0
  );
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
    if (seen > 1 && clause.kind === "trailing_stop" && !(clause.ownDistance != null && clause.ownDistance > 0)) {
      return "Enter a distance for the extra trailing stop.";
    }
    if (
      seen > 1 &&
      (clause.kind === "take_profit" || clause.kind === "stop_loss") &&
      !(clause.ownPct != null && clause.ownPct > 0)
    ) {
      return `Enter a target for the extra ${clause.kind === "take_profit" ? "take profit" : "stop loss"}.`;
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
> {
  const blank = {
    takeProfitPct: null,
    takeProfitPrice: null,
    stopLossPct: null,
    stopLossPrice: null,
    trailingDistance: null,
    trailingActivation: null,
    trailingPct: null,
  };
  if (clause.kind === "take_profit") {
    if (kindCount > 1) {
      return { ...blank, takeProfitPct: clause.ownPct };
    }
    return {
      ...blank,
      takeProfitPct: prices.takeProfitPct,
      takeProfitPrice: prices.takeProfitPrice,
    };
  }
  if (clause.kind === "stop_loss") {
    if (kindCount > 1) {
      return { ...blank, stopLossPct: clause.ownPct };
    }
    return {
      ...blank,
      stopLossPct: prices.stopLossPct,
      stopLossPrice: prices.stopLossPrice,
    };
  }
  if (clause.kind === "trailing_stop") {
    if (kindCount > 1) {
      return { ...blank, trailingDistance: clause.ownDistance };
    }
    return {
      ...blank,
      trailingDistance: prices.trailingDistance,
      trailingActivation: prices.trailingActivation,
      trailingPct: prices.trailingPct ?? null,
    };
  }
  return blank;
}

/** Null when the side still belongs on the classic columns. */
export function exitActionsForSave(
  clauses: readonly ExitBuilderClause[],
  prices: ExitSidePrices,
): StoredExitAction[] | null {
  if (exitSideUsesColumns(clauses)) {
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
    actions.push({
      id: clause.key,
      kind,
      scope,
      groups: groupsOf(clause),
      ...pricesFor(clause, seenCount, prices),
    });
  }
  return actions.length > 0 ? actions : null;
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
    return {
      ...base,
      anchor: first?.anchor ?? { trigger: "unset" },
      rows,
      orGroups,
      scope: action.scope,
      ownPct:
        seenCount > 1
          ? action.kind === "take_profit"
            ? action.takeProfitPct
            : action.kind === "stop_loss"
              ? action.stopLossPct
              : null
          : null,
      ownDistance:
        seenCount > 1 && action.kind === "trailing_stop"
          ? action.trailingDistance
          : null,
    };
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
  for (const action of input.actions) {
    conditionTrue[action.id] = exitActionStackTrue({
      action,
      side: input.side,
      prices,
      barsByTimeframe: input.barsByTimeframe,
      firedWebhookId: input.firedWebhookId,
    });
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
    stepQty: input.stepQty,
  });
}

export function exitActionStackTrue(input: {
  action: StoredExitAction;
  side: FuturesSide;
  prices: { last: number | null; mark: number | null; index: number | null } | null;
  barsByTimeframe: Map<string, CandleBar[]>;
  firedWebhookId?: string | null;
}): boolean {
  if (input.action.groups.length === 0) {
    return false;
  }
  return input.action.groups.some((group) => {
    const leaves = [group.anchor, ...group.rows];
    return leaves.every((draft) => {
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
    });
  });
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
    const armed = alwaysArmed || previous.armedAt != null || condition;
    const justArmed = previous.armedAt == null && armed && !alwaysArmed;
    const next: ExitArmState = {
      armedAt: armed ? (previous.armedAt ?? input.nowMs) : null,
      peak: previous.peak,
      condition,
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
      if (hit.fire) {
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
    return "All";
  }
  if (scope.kind === "remainder") {
    return "Remainder";
  }
  if (scope.kind === "percent") {
    return scope.pct == null ? "Percent" : `${scope.pct}% of open size`;
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
