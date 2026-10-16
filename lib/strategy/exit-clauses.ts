import type { ExitStackRow } from "@/components/exit-condition-stack";
import type { HardExitDraft } from "@/lib/dca/hard-exit";
import type { StrategyJoin } from "@/lib/strategy/expr";

export const EXIT_CLAUSE_KINDS = [
  "take_profit",
  "trailing_stop",
  "stop_loss",
  "custom",
] as const;

export type ExitClauseKind = "" | (typeof EXIT_CLAUSE_KINDS)[number];

export type ClassicExitKind = "take_profit" | "trailing_stop" | "stop_loss";

/** One top-level exit. Clauses are joined with Or. */
export type ExitBuilderClause = {
  key: string;
  kind: ExitClauseKind;
  /** First advanced condition in this group. */
  anchor: HardExitDraft;
  /** Further custom conditions. They join the anchor with And. */
  rows: ExitStackRow[];
};

function clauseKey(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isClassicExitKind(kind: ExitClauseKind): kind is ClassicExitKind {
  return kind === "take_profit" || kind === "trailing_stop" || kind === "stop_loss";
}

export function emptyExitClause(): ExitBuilderClause {
  return {
    key: clauseKey("exit"),
    kind: "",
    anchor: { trigger: "unset" },
    rows: [],
  };
}

export function classicExitClause(kind: ClassicExitKind): ExitBuilderClause {
  return {
    key: `classic-${kind}`,
    kind,
    anchor: { trigger: "unset" },
    rows: [],
  };
}

export function customExitClause(
  anchor: HardExitDraft,
  rows: ExitStackRow[] = [],
  key = clauseKey("custom"),
): ExitBuilderClause {
  return {
    key,
    kind: "custom",
    anchor,
    rows: rows.map((row) => ({ ...row, join: "and" as const })),
  };
}

export function classicSignature(clauses: readonly ExitBuilderClause[]): string {
  return clauses
    .filter((clause) => isClassicExitKind(clause.kind))
    .map((clause) => clause.kind)
    .join("|");
}

export function blankExitClauses(): ExitBuilderClause[] {
  return [emptyExitClause()];
}

/** A list that already has a condition still shows Select Condition Type. */
export function exitClauseListMissing(
  clauses: readonly ExitBuilderClause[],
): boolean {
  const started = clauses.some((clause) => clause.kind !== "");
  return started && clauses.some((clause) => clause.kind === "");
}

export function classicExitFlags(clauses: readonly ExitBuilderClause[]): {
  takeProfit: boolean;
  trailing: boolean;
  stopLoss: boolean;
} {
  return {
    takeProfit: clauses.some((clause) => clause.kind === "take_profit"),
    trailing: clauses.some((clause) => clause.kind === "trailing_stop"),
    stopLoss: clauses.some((clause) => clause.kind === "stop_loss"),
  };
}

/** One stored classic set. Pass the short list only while Both is open. */
export function mergedClassicExitFlags(
  primary: readonly ExitBuilderClause[],
  short: readonly ExitBuilderClause[] | null,
): {
  takeProfit: boolean;
  trailing: boolean;
  stopLoss: boolean;
} {
  const left = classicExitFlags(primary);
  if (!short) {
    return left;
  }
  const right = classicExitFlags(short);
  return {
    takeProfit: left.takeProfit || right.takeProfit,
    trailing: left.trailing || right.trailing,
    stopLoss: left.stopLoss || right.stopLoss,
  };
}

/** Copy classic clauses from source onto target. Custom clauses on target stay. */
export function syncClassicClauses(
  target: readonly ExitBuilderClause[],
  source: readonly ExitBuilderClause[],
): ExitBuilderClause[] {
  const classics = source
    .filter((clause): clause is ExitBuilderClause & { kind: ClassicExitKind } =>
      isClassicExitKind(clause.kind),
    )
    .map((clause) => classicExitClause(clause.kind));
  const custom = target.filter((clause) => clause.kind === "custom");
  if (classics.length === 0 && custom.length === 0) {
    const empty = target.find((clause) => clause.kind === "");
    return [empty ?? emptyExitClause()];
  }
  return [...classics, ...custom];
}

export function customConditionCount(clauses: readonly ExitBuilderClause[]): number {
  return clauses.reduce((count, clause) => {
    if (clause.kind !== "custom") {
      return count;
    }
    return count + 1 + clause.rows.length;
  }, 0);
}

export function exitClausesFromSaved(input: {
  takeProfit: boolean;
  trailing: boolean;
  stopLoss: boolean;
  anchor: HardExitDraft | null;
  rows: readonly ExitStackRow[];
}): ExitBuilderClause[] {
  const clauses: ExitBuilderClause[] = [];
  if (input.takeProfit) {
    clauses.push(classicExitClause("take_profit"));
  }
  if (input.trailing) {
    clauses.push(classicExitClause("trailing_stop"));
  }
  if (input.stopLoss) {
    clauses.push(classicExitClause("stop_loss"));
  }
  clauses.push(...customClausesFromStack(input.anchor, input.rows));
  if (clauses.length === 0) {
    clauses.push(emptyExitClause());
  }
  return clauses;
}

function customClausesFromStack(
  anchor: HardExitDraft | null,
  rows: readonly ExitStackRow[],
): ExitBuilderClause[] {
  if (anchor == null && rows.length === 0) {
    return [];
  }
  const lead = anchor ?? rows[0]?.draft ?? { trigger: "unset" as const };
  const rest = anchor == null ? rows.slice(1) : rows;
  const groups: ExitStackRow[][] = [[]];
  for (const row of rest) {
    if (row.join === "or") {
      groups.push([row]);
    } else {
      groups[groups.length - 1]?.push(row);
    }
  }
  const clauses: ExitBuilderClause[] = [
    customExitClause(lead, groups[0] ?? []),
  ];
  for (const group of groups.slice(1)) {
    const [head, ...tail] = group;
    if (!head) {
      continue;
    }
    clauses.push(customExitClause(head.draft, tail, head.key));
  }
  return clauses;
}

/** Custom clauses become the stored anchor plus And/Or rows. */
export function customStackFromClauses(clauses: readonly ExitBuilderClause[]): {
  anchor: HardExitDraft | null;
  rows: ExitStackRow[];
} {
  const custom = clauses.filter((clause) => clause.kind === "custom");
  const [first, ...rest] = custom;
  if (!first) {
    return { anchor: null, rows: [] };
  }
  const rows: ExitStackRow[] = first.rows.map((row) => ({
    ...row,
    join: "and" as StrategyJoin,
  }));
  for (const group of rest) {
    rows.push({
      key: group.key,
      join: "or",
      draft: group.anchor,
    });
    for (const row of group.rows) {
      rows.push({ ...row, join: "and" });
    }
  }
  return { anchor: first.anchor, rows };
}
