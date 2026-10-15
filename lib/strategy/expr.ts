import {
  parseDcaFilterSpec,
  type DcaFilterSpec,
} from "@/lib/dca/filters";
import {
  parseDcaIndicatorCompare,
  parseDcaIndicatorMultiplier,
  parseDcaIndicatorPeriod,
  parseDcaIndicatorTimeframe,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import type { DcaIndicatorStart } from "@/lib/dca/playbook";
import type { FuturesTrigger } from "@/lib/futures/model";
import {
  claimsConflict,
  indicatorClaim,
  priceClaim,
  SERIES_CONFLICT_MESSAGE,
  type ConflictClaim,
} from "@/lib/strategy/conflicts";

export { SERIES_CONFLICT_MESSAGE, type ConflictClaim };

/** Entry, add, and exit stacks share this cap. The initial trigger counts as one. */
export const STRATEGY_CONDITION_CAP = 12;
export const STRATEGY_TIMEFRAME_CAP = 4;

export type StrategyJoin = "and" | "or";

/** Saved Secondary Entry. New rows use a trigger leaf instead. */
export type StrategyFilterLeaf = {
  kind: "filter";
  spec: DcaFilterSpec;
};

export type StrategyPriceLeaf = {
  kind: "price";
  triggerBy: FuturesTrigger;
  compare: "gte" | "lte";
  price: number;
};

export type StrategyIndicatorLeaf = {
  kind: "indicator" | "trend";
  start: DcaIndicatorStart;
};

export type StrategyWebhookLeaf = {
  kind: "webhook";
  webhookId: string;
};

export type StrategyLeaf =
  | StrategyFilterLeaf
  | StrategyPriceLeaf
  | StrategyIndicatorLeaf
  | StrategyWebhookLeaf;

export type StrategyTriggerKind = "price" | "indicator" | "trend" | "webhook";

/** One slot in the entry expression. Index 0 is the initial trigger. */
export type EntryConflictSlot = {
  kind: StrategyTriggerKind | "filter";
  join: StrategyJoin;
  webhookId?: string | null;
  /** Series test used to disable an And that cannot be true. */
  claim?: ConflictClaim | null;
};

/**
 * Conditions after the initial order trigger.
 * `joins[i]` is how `leaves[i]` attaches: And stays in the current group,
 * Or starts a new group. Groups are OR'd. Leaves inside a group are AND'd.
 */
export type EntryStack = {
  leaves: StrategyLeaf[];
  joins: StrategyJoin[];
};

export function emptyEntryStack(): EntryStack {
  return { leaves: [], joins: [] };
}

export function legacyEntryStack(
  confirm: DcaFilterSpec | null | undefined,
): EntryStack {
  if (!confirm) {
    return emptyEntryStack();
  }
  return {
    leaves: [{ kind: "filter", spec: confirm }],
    joins: ["and"],
  };
}

/** A stored stack wins, including an explicit empty stack. Null falls back to confirm. */
export function resolveEntryStack(
  stack: EntryStack | null | undefined,
  confirm: DcaFilterSpec | null | undefined,
): EntryStack {
  if (stack) {
    return stack;
  }
  return legacyEntryStack(confirm);
}

/** One And filter still fits the confirm column. Anything richer does not. */
export function confirmFromEntryStack(stack: EntryStack): DcaFilterSpec | null {
  const leaf = stack.leaves[0];
  if (
    stack.leaves.length === 1 &&
    stack.joins[0] === "and" &&
    leaf?.kind === "filter"
  ) {
    return leaf.spec;
  }
  return null;
}

export function entryStackIsLegacy(stack: EntryStack): boolean {
  return confirmFromEntryStack(stack) != null || stack.leaves.length === 0;
}

export function entryStackMet(input: {
  trigger: boolean;
  leaves: boolean[];
  joins: StrategyJoin[];
}): boolean {
  const groups: boolean[][] = [[input.trigger]];
  const count = Math.min(input.leaves.length, input.joins.length);
  for (let index = 0; index < count; index += 1) {
    const met = input.leaves[index] === true;
    if (input.joins[index] === "or") {
      groups.push([met]);
    } else {
      groups[groups.length - 1]?.push(met);
    }
  }
  return groups.some((group) => group.every(Boolean));
}

export function strategyLeafTimeframe(
  leaf: StrategyLeaf,
): DcaIndicatorTimeframe | null {
  if (leaf.kind === "filter") {
    return leaf.spec.timeframe;
  }
  if (leaf.kind === "indicator" || leaf.kind === "trend") {
    return leaf.start.timeframe;
  }
  return null;
}

/** Group index of a slot. The initial trigger is always group 0. */
export function entryGroupOf(
  slots: readonly { join: StrategyJoin }[],
  index: number,
): number {
  let group = 0;
  const last = Math.min(index, slots.length - 1);
  for (let cursor = 1; cursor <= last; cursor += 1) {
    if (slots[cursor]?.join === "or") {
      group += 1;
    }
  }
  return group;
}

function slotsWithJoin(
  slots: readonly EntryConflictSlot[],
  index: number,
  join: StrategyJoin | null,
): EntryConflictSlot[] {
  if (join == null) {
    return [...slots];
  }
  return slots.map((slot, cursor) =>
    cursor === index ? { ...slot, join } : slot,
  );
}

/**
 * Two webhooks in one And group cannot both fire on one tick.
 * The same webhook id cannot be selected twice.
 * When every listed webhook id is already used, Signal webhook is disabled.
 * Indicator, Trend, and Price Cross stay available. Their When choices are
 * disabled when that choice cannot be true beside an And peer.
 */
export function entryKindDisabled(input: {
  slots: readonly EntryConflictSlot[];
  index: number;
  kind: StrategyTriggerKind;
  webhookIds?: readonly string[];
}): boolean {
  if (input.kind === "indicator" || input.kind === "trend" || input.kind === "price") {
    return false;
  }
  const slots = slotsWithJoin(input.slots, input.index, null);
  const group = entryGroupOf(slots, input.index);
  const peers = slots.filter(
    (slot, cursor) => cursor !== input.index && entryGroupOf(slots, cursor) === group,
  );
  if (peers.some((slot) => slot.kind === "webhook")) {
    return true;
  }
  const catalog = (input.webhookIds ?? []).filter((id) => id.trim() !== "");
  if (catalog.length === 0) {
    return false;
  }
  const used = new Set(
    slots
      .filter(
        (slot, cursor) =>
          cursor !== input.index &&
          slot.kind === "webhook" &&
          slot.webhookId,
      )
      .map((slot) => slot.webhookId as string),
  );
  return catalog.every((id) => used.has(id));
}

export function entryWebhookIdDisabled(input: {
  slots: readonly EntryConflictSlot[];
  index: number;
  webhookId: string;
}): boolean {
  if (!input.webhookId) {
    return false;
  }
  return input.slots.some(
    (slot, cursor) =>
      cursor !== input.index &&
      slot.kind === "webhook" &&
      slot.webhookId === input.webhookId,
  );
}

/** True when this claim cannot sit in the slot's current And group. */
export function claimConflictsAt(
  slots: readonly EntryConflictSlot[],
  index: number,
  claim: ConflictClaim | null | undefined,
): boolean {
  if (!claim) {
    return false;
  }
  const group = entryGroupOf(slots, index);
  return slots.some((slot, cursor) => {
    if (cursor === index || entryGroupOf(slots, cursor) !== group) {
      return false;
    }
    return claimsConflict(slot.claim, claim);
  });
}

/** A dropdown choice stays available when it is already selected. */
export function choiceConflicts(
  slots: readonly EntryConflictSlot[] | undefined,
  index: number | undefined,
  claim: ConflictClaim | null | undefined,
  selected: boolean,
): boolean {
  if (selected || slots == null || index == null) {
    return false;
  }
  return claimConflictsAt(slots, index, claim);
}

/** Price source or compare that cannot be true beside an And peer. */
export function priceChoiceConflicts(
  slots: readonly EntryConflictSlot[] | undefined,
  index: number | undefined,
  current: { source: string; compare: string; price: string },
  next: { source?: string; compare?: string },
): boolean {
  const source = next.source ?? current.source;
  const compare = next.compare ?? current.compare;
  return choiceConflicts(
    slots,
    index,
    priceClaim({ source, compare, price: current.price }),
    source === current.source && compare === current.compare,
  );
}

/** Kind is allowed, and its series test can sit in this And group. */
export function entrySlotAllowed(input: {
  slots: readonly EntryConflictSlot[];
  index: number;
  kind: StrategyTriggerKind;
  webhookIds?: readonly string[];
}): boolean {
  if (entryKindDisabled(input)) {
    return false;
  }
  return !claimConflictsAt(
    input.slots,
    input.index,
    input.slots[input.index]?.claim,
  );
}

/** And is disabled when that join would put this row in a conflicting group. */
export function entryJoinDisabled(input: {
  slots: readonly EntryConflictSlot[];
  index: number;
  join: StrategyJoin;
}): boolean {
  if (input.join !== "and" || input.index <= 0) {
    return false;
  }
  const slot = input.slots[input.index];
  if (!slot) {
    return false;
  }
  const slots = slotsWithJoin(input.slots, input.index, "and");
  if (
    slot.kind === "webhook" &&
    entryKindDisabled({
      slots,
      index: input.index,
      kind: slot.kind,
    })
  ) {
    return true;
  }
  return claimConflictsAt(slots, input.index, slots[input.index]?.claim);
}

export function claimFromLeaf(leaf: StrategyLeaf): ConflictClaim | null {
  if (leaf.kind === "price") {
    return priceClaim({
      source: leaf.triggerBy,
      compare: leaf.compare,
      price: leaf.price,
    });
  }
  if (leaf.kind === "webhook") {
    return null;
  }
  if (leaf.kind === "filter") {
    return indicatorClaim({
      surface: "filter",
      kind: leaf.spec.kind,
      timeframe: leaf.spec.timeframe,
      compare: leaf.spec.compare,
      level: leaf.spec.level,
      levelTo: leaf.spec.levelTo,
      period: leaf.spec.period,
      slowPeriod: leaf.spec.slowPeriod,
      multiplier: leaf.spec.multiplier,
    });
  }
  return indicatorClaim({
    surface: "entry",
    kind: leaf.start.kind,
    timeframe: leaf.start.timeframe,
    compare: leaf.start.compare,
    level: leaf.start.level,
    period: leaf.start.period,
    slowPeriod: leaf.start.slowPeriod,
    multiplier: leaf.start.multiplier,
  });
}

export function entryStackConflictMessage(input: {
  trigger: EntryConflictSlot;
  stack: EntryStack;
}): string | null {
  const slots: EntryConflictSlot[] = [
    input.trigger,
    ...input.stack.leaves.map((leaf, index) => ({
      kind: leaf.kind,
      join: input.stack.joins[index] ?? "and",
      webhookId: leaf.kind === "webhook" ? leaf.webhookId : null,
      claim: claimFromLeaf(leaf),
    })),
  ];
  const seen = new Set<string>();
  for (const slot of slots) {
    if (slot.kind !== "webhook" || !slot.webhookId) {
      continue;
    }
    if (seen.has(slot.webhookId)) {
      return "The same webhook cannot be used twice.";
    }
    seen.add(slot.webhookId);
  }
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    if (!slot) {
      continue;
    }
    if (
      slot.kind === "webhook" &&
      entryKindDisabled({
        slots,
        index,
        kind: slot.kind,
      })
    ) {
      return "Two webhooks cannot be joined with And.";
    }
    if (claimConflictsAt(slots, index, slot.claim)) {
      return SERIES_CONFLICT_MESSAGE;
    }
  }
  return null;
}

/** A webhook trigger still needs the price tick when an Or group can pass without it. */
export function entryStackListensOnPriceTick(
  entrySource: StrategyTriggerKind,
  stack: EntryStack,
): boolean {
  if (entrySource !== "webhook") {
    return true;
  }
  return stack.joins.includes("or");
}

export function entryStackMatchesWebhook(
  entrySource: StrategyTriggerKind,
  webhookId: string | null | undefined,
  stack: EntryStack,
  firedId: string,
): boolean {
  if (entrySource === "webhook" && webhookId === firedId) {
    return true;
  }
  return stack.leaves.some(
    (leaf) => leaf.kind === "webhook" && leaf.webhookId === firedId,
  );
}

export function entryStackTimeframes(stack: EntryStack): DcaIndicatorTimeframe[] {
  const rows: DcaIndicatorTimeframe[] = [];
  for (const leaf of stack.leaves) {
    const timeframe = strategyLeafTimeframe(leaf);
    if (timeframe && !rows.includes(timeframe)) {
      rows.push(timeframe);
    }
  }
  return rows;
}

export function entryStackError(input: {
  stack: EntryStack;
  triggerTimeframe?: DcaIndicatorTimeframe | null;
}): string | null {
  if (input.stack.joins.length !== input.stack.leaves.length) {
    return "Entry conditions are incomplete.";
  }
  if (1 + input.stack.leaves.length > STRATEGY_CONDITION_CAP) {
    return "Use at most 12 entry conditions.";
  }
  const timeframes = new Set<string>();
  if (input.triggerTimeframe) {
    timeframes.add(input.triggerTimeframe);
  }
  for (const leaf of input.stack.leaves) {
    const timeframe = strategyLeafTimeframe(leaf);
    if (timeframe) {
      timeframes.add(timeframe);
    }
  }
  if (timeframes.size > STRATEGY_TIMEFRAME_CAP) {
    return "Use at most 4 timeframes.";
  }
  return null;
}

export function entryStackToJson(stack: EntryStack): {
  leaves: StrategyLeaf[];
  joins: StrategyJoin[];
} {
  return {
    leaves: stack.leaves.map((leaf) => {
      if (leaf.kind === "filter") {
        return { kind: "filter", spec: leaf.spec };
      }
      if (leaf.kind === "price") {
        return {
          kind: "price",
          triggerBy: leaf.triggerBy,
          compare: leaf.compare,
          price: leaf.price,
        };
      }
      if (leaf.kind === "webhook") {
        return { kind: "webhook", webhookId: leaf.webhookId };
      }
      return {
        kind: leaf.kind,
        start: leaf.start,
      };
    }),
    joins: [...stack.joins],
  };
}

const LEAF_INDICATOR_KINDS = [
  "rsi",
  "macd",
  "ema_cross",
  "ema",
  "sma",
  "sma_cross",
  "bb",
  "atr_band",
  "supertrend",
] as const;

function parseLeafIndicatorKind(value: unknown): DcaIndicatorKind | null {
  const raw = String(value ?? "").trim();
  return (LEAF_INDICATOR_KINDS as readonly string[]).includes(raw)
    ? (raw as DcaIndicatorKind)
    : null;
}

function indicatorLeafFromRaw(
  kind: "indicator" | "trend",
  raw: unknown,
): StrategyIndicatorLeaf | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const indicatorKind = parseLeafIndicatorKind(row.kind);
  const timeframe = parseDcaIndicatorTimeframe(row.timeframe);
  if (!indicatorKind || !timeframe) {
    return null;
  }
  if (kind === "trend" && indicatorKind !== "supertrend") {
    return null;
  }
  if (kind === "indicator" && indicatorKind === "supertrend") {
    return null;
  }
  const compareRaw = row.compare;
  const compare =
    compareRaw == null || String(compareRaw).trim() === ""
      ? null
      : parseDcaIndicatorCompare(compareRaw);
  if (compareRaw != null && String(compareRaw).trim() !== "" && !compare) {
    return null;
  }
  const level =
    row.level == null || row.level === "" ? null : Number(row.level);
  if (level != null && !Number.isFinite(level)) {
    return null;
  }
  const period = row.period == null ? null : parseDcaIndicatorPeriod(row.period);
  const slowPeriod =
    row.slowPeriod == null ? null : parseDcaIndicatorPeriod(row.slowPeriod);
  const multiplier =
    row.multiplier == null ? null : parseDcaIndicatorMultiplier(row.multiplier);
  if (row.period != null && period == null) {
    return null;
  }
  if (row.slowPeriod != null && slowPeriod == null) {
    return null;
  }
  if (row.multiplier != null && multiplier == null) {
    return null;
  }
  return {
    kind,
    start: {
      kind: indicatorKind,
      timeframe,
      compare,
      level,
      period,
      slowPeriod,
      multiplier,
    },
  };
}

function priceLeafFromRaw(raw: Record<string, unknown>): StrategyPriceLeaf | null {
  const triggerBy = raw.triggerBy;
  const compare = raw.compare;
  const price = Number(raw.price);
  if (triggerBy !== "last" && triggerBy !== "mark" && triggerBy !== "index") {
    return null;
  }
  if (compare !== "gte" && compare !== "lte") {
    return null;
  }
  if (!(price > 0)) {
    return null;
  }
  return { kind: "price", triggerBy, compare, price };
}

export function entryStackFromJson(raw: unknown): EntryStack | null {
  if (raw == null) {
    return null;
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as { leaves?: unknown; joins?: unknown };
  if (!Array.isArray(row.leaves) || !Array.isArray(row.joins)) {
    return null;
  }
  if (row.leaves.length !== row.joins.length) {
    return null;
  }
  if (row.leaves.length > STRATEGY_CONDITION_CAP - 1) {
    return null;
  }
  const leaves: StrategyLeaf[] = [];
  const joins: StrategyJoin[] = [];
  for (let index = 0; index < row.leaves.length; index += 1) {
    const leaf = row.leaves[index];
    const join = row.joins[index];
    if (!leaf || typeof leaf !== "object" || Array.isArray(leaf)) {
      return null;
    }
    if (join !== "and" && join !== "or") {
      return null;
    }
    const kind = (leaf as { kind?: unknown }).kind;
    const record = leaf as Record<string, unknown>;
    let parsed: StrategyLeaf | null = null;
    if (kind === "filter") {
      const specRaw = record.spec;
      if (!specRaw || typeof specRaw !== "object" || Array.isArray(specRaw)) {
        return null;
      }
      const specRow = specRaw as Record<string, unknown>;
      const spec = parseDcaFilterSpec({
        kind: specRow.kind,
        timeframe: specRow.timeframe,
        compare: specRow.compare,
        level: specRow.level,
        levelTo: specRow.levelTo,
        period: specRow.period,
        slowPeriod: specRow.slowPeriod,
        multiplier: specRow.multiplier,
      });
      parsed = spec ? { kind: "filter", spec } : null;
    } else if (kind === "price") {
      parsed = priceLeafFromRaw(record);
    } else if (kind === "webhook") {
      const webhookId = String(record.webhookId ?? "").trim();
      parsed = webhookId ? { kind: "webhook", webhookId } : null;
    } else if (kind === "indicator" || kind === "trend") {
      parsed = indicatorLeafFromRaw(kind, record.start);
    }
    if (!parsed) {
      return null;
    }
    leaves.push(parsed);
    joins.push(join);
  }
  const stack = { leaves, joins };
  if (entryStackError({ stack })) {
    return null;
  }
  return stack;
}

export function formatEntryWithStack(
  start: string,
  stack: EntryStack,
  leafText: (leaf: StrategyLeaf) => string,
): string {
  const groups: string[][] = [[start.trim()]];
  for (let index = 0; index < stack.leaves.length; index += 1) {
    const text = leafText(stack.leaves[index]!).trim();
    if (!text) {
      continue;
    }
    if (stack.joins[index] === "or") {
      groups.push([text]);
    } else {
      groups[groups.length - 1]?.push(text);
    }
  }
  return groups
    .map((group) => group.filter(Boolean).join(", and "))
    .filter(Boolean)
    .join(", or ");
}
