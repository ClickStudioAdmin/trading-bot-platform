import {
  parseDcaFilterSpec,
  type DcaFilterSpec,
} from "@/lib/dca/filters";
import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";

/** Entry, add, and exit stacks share this cap. The initial trigger counts as one. */
export const STRATEGY_CONDITION_CAP = 12;
export const STRATEGY_TIMEFRAME_CAP = 4;

export type StrategyJoin = "and" | "or";

/** Market leaf used after the initial trigger. Later leaves stay in this slot. */
export type StrategyFilterLeaf = {
  kind: "filter";
  spec: DcaFilterSpec;
};

/**
 * Conditions after the initial order trigger.
 * `joins[i]` is how `leaves[i]` attaches: And stays in the current group,
 * Or starts a new group. Groups are OR'd. Leaves inside a group are AND'd.
 */
export type EntryStack = {
  leaves: StrategyFilterLeaf[];
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

export function entryStackTimeframes(stack: EntryStack): DcaIndicatorTimeframe[] {
  const rows: DcaIndicatorTimeframe[] = [];
  for (const leaf of stack.leaves) {
    if (!rows.includes(leaf.spec.timeframe)) {
      rows.push(leaf.spec.timeframe);
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
    timeframes.add(leaf.spec.timeframe);
  }
  if (timeframes.size > STRATEGY_TIMEFRAME_CAP) {
    return "Use at most 4 timeframes.";
  }
  return null;
}

export function entryStackToJson(stack: EntryStack): {
  leaves: StrategyFilterLeaf[];
  joins: StrategyJoin[];
} {
  return {
    leaves: stack.leaves.map((leaf) => ({ kind: "filter", spec: leaf.spec })),
    joins: [...stack.joins],
  };
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
  const leaves: StrategyFilterLeaf[] = [];
  const joins: StrategyJoin[] = [];
  for (let index = 0; index < row.leaves.length; index += 1) {
    const leaf = row.leaves[index];
    const join = row.joins[index];
    if (!leaf || typeof leaf !== "object" || Array.isArray(leaf)) {
      return null;
    }
    if ((leaf as { kind?: unknown }).kind !== "filter") {
      return null;
    }
    if (join !== "and" && join !== "or") {
      return null;
    }
    const specRaw = (leaf as { spec?: unknown }).spec;
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
      multiplier: specRow.multiplier,
    });
    if (!spec) {
      return null;
    }
    leaves.push({ kind: "filter", spec });
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
  leafText: (spec: DcaFilterSpec) => string,
): string {
  const groups: string[][] = [[start.trim()]];
  for (let index = 0; index < stack.leaves.length; index += 1) {
    const text = leafText(stack.leaves[index]!.spec).trim();
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
