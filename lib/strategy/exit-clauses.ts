import type { ExitStackRow } from "@/components/exit-condition-stack";
import {
  exitPriceRuleLabel,
  type ExitPriceRuleTrigger,
  type HardExitDraft,
} from "@/lib/dca/hard-exit";
import type { StrategyJoin } from "@/lib/strategy/expr";

export const EXIT_CLAUSE_KINDS = [
  "take_profit",
  "trailing_stop",
  "stop_loss",
  "breakeven",
  "custom",
] as const;

export type ExitClauseKind = "" | (typeof EXIT_CLAUSE_KINDS)[number];

export type ClassicExitKind = "take_profit" | "trailing_stop" | "stop_loss";

/** How much of the open position one action may reduce. */
export type ExitScope =
  | { kind: "all" }
  | { kind: "remainder" }
  | { kind: "percent"; pct: number | null }
  | { kind: "qty"; qty: number | null }
  | { kind: "fills"; minProfitPct: number | null };

export const EXIT_SCOPE_ALL: ExitScope = { kind: "all" };

/** Per lot prices each fill on its own. Average uses one blended entry. */
export type ExitReference = "lot" | "average";

/** An Or group after the first And group on one action. */
export type ExitOrGroup = {
  key: string;
  anchor: HardExitDraft;
  rows: ExitStackRow[];
};

/**
 * One exit action. Price actions arm from `anchor` / `rows` / `orGroups`.
 * A custom action is Close, and that stack is what makes it fire.
 */
export type ExitBuilderClause = {
  key: string;
  kind: ExitClauseKind;
  /** First condition in this action. Unset means the price action has no arm stack. */
  anchor: HardExitDraft;
  /** Further conditions. They join the anchor with And. */
  rows: ExitStackRow[];
  /** Later condition groups. Each joins the first group with Or. */
  orGroups: ExitOrGroup[];
  scope: ExitScope;
  /**
   * Per lot or Average. A new card is per lot. A card loaded from columns,
   * or from an older action with no choice stored, stays Average.
   */
  reference?: ExitReference;
  /** Target for a repeated take profit or stop. The first card uses the side fields. */
  ownPct: number | null;
  /** Distance for a repeated trailing stop. */
  ownDistance: number | null;
  /** Price fields for a later card of the same action. The first card uses the side fields. */
  levels?: ExitRepeatLevels;
};

/** DCA or Flex. A later card uses this to show that desk's price fields. */
export type ExitPriceStyle = "dca" | "flex";

/** The same price fields as the first card, kept on a later action. */
export type ExitRepeatLevels = {
  style: ExitPriceStyle | "";
  basis: string;
  method: string;
  target: string;
  atrPeriod: string;
  atrMult: string;
  orderType: string;
  trigger: string;
  trail: string;
  limitPrice: string;
  breakeven: boolean;
  breakevenActivation: string;
  breakevenOffset: string;
};

export type ExitFieldSlot = {
  levels: ExitRepeatLevels;
  onChange: (patch: Partial<ExitRepeatLevels>) => void;
  showErrors: boolean;
};

export function emptyRepeatLevels(): ExitRepeatLevels {
  return {
    style: "",
    basis: "average",
    method: "",
    target: "",
    atrPeriod: "",
    atrMult: "",
    orderType: "market",
    trigger: "",
    trail: "",
    limitPrice: "",
    breakeven: false,
    breakevenActivation: "",
    breakevenOffset: "",
  };
}

export function clauseLevels(clause: { levels?: ExitRepeatLevels | null }): ExitRepeatLevels {
  return { ...emptyRepeatLevels(), ...clause.levels };
}

export type TrailActivationKind = "percent" | "price";

/**
 * When a trailing stop starts. Percent is profit from entry. Price is a
 * market level. A new trail defaults to percent. A saved Flex activation
 * price stays a price.
 */
export function trailActivationKind(input: {
  method?: string | null;
  style?: string | null;
  trigger?: string | null;
  trailingActivation?: number | null;
  trailingTriggerPct?: number | null;
}): TrailActivationKind {
  if (input.method === "price" || input.method === "percent") {
    return input.method;
  }
  const triggerPct = input.trailingTriggerPct;
  const activation = input.trailingActivation;
  if (activation != null && activation > 0 && !(triggerPct != null && triggerPct > 0)) {
    return "price";
  }
  if (triggerPct != null && triggerPct > 0 && activation == null) {
    return "percent";
  }
  if (String(input.trigger ?? "").trim() !== "" && input.style === "flex") {
    return "price";
  }
  return "percent";
}

/** Fill desk defaults on a later card without wiping a value the user already set. */
export function seedRepeatLevels(
  clause: ExitBuilderClause,
  style: ExitPriceStyle,
): ExitRepeatLevels {
  const levels = clauseLevels(clause);
  return {
    ...levels,
    style: levels.style || style,
    basis: levels.basis || "average",
    orderType: levels.orderType || "market",
    method:
      levels.method ||
      (clause.kind === "trailing_stop"
        ? trailActivationKind({
            style: levels.style || style,
            trigger: levels.trigger,
          })
        : style === "flex"
          ? "price"
          : "percent"),
    trigger:
      levels.trigger ||
      (style === "flex" && clause.kind !== "trailing_stop" ? "last" : ""),
    target: levels.target || (clause.ownPct != null ? String(clause.ownPct) : ""),
    trail: levels.trail || (clause.ownDistance != null ? String(clause.ownDistance) : ""),
  };
}

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
    orGroups: [],
    scope: EXIT_SCOPE_ALL,
    reference: "lot",
    ownPct: null,
    ownDistance: null,
  };
}

export function priceRuleForKind(
  kind: ExitBuilderClause["kind"],
): ExitPriceRuleTrigger | null {
  if (kind === "take_profit") {
    return "target";
  }
  if (kind === "stop_loss") {
    return "stop";
  }
  if (kind === "trailing_stop") {
    return "trail";
  }
  if (kind === "breakeven") {
    return "profit";
  }
  return null;
}

export function priceRuleName(kind: ExitBuilderClause["kind"]): string | null {
  const rule = priceRuleForKind(kind);
  return rule ? exitPriceRuleLabel(rule) : null;
}

export function clauseHasPriceRule(clause: ExitBuilderClause): boolean {
  const rule = priceRuleForKind(clause.kind);
  if (!rule) {
    return false;
  }
  if (clause.anchor.trigger === rule) {
    return true;
  }
  if (clause.rows.some((row) => row.draft.trigger === rule)) {
    return true;
  }
  return clauseOrGroups(clause).some(
    (group) =>
      group.anchor.trigger === rule ||
      group.rows.some((row) => row.draft.trigger === rule),
  );
}

/**
 * Take profit, stop, and trail keep their price rule as the first condition.
 * A saved indicator, trend, price cross, or webhook moves under it.
 */
export function pinExitPriceRule(clause: ExitBuilderClause): ExitBuilderClause {
  const rule = priceRuleForKind(clause.kind);
  if (!rule) {
    return clause;
  }
  const groups = clauseOrGroups(clause);
  let stripped = false;
  const rows = clause.rows.filter((row) => {
    if (row.draft.trigger === rule) {
      stripped = true;
      return false;
    }
    return true;
  });
  const orGroups = groups.flatMap((group) => {
    const kept = group.rows.filter((row) => row.draft.trigger !== rule);
    const anchorIsRule = group.anchor.trigger === rule;
    if (!anchorIsRule && kept.length === group.rows.length) {
      return [group];
    }
    stripped = true;
    if (!anchorIsRule) {
      return [{ ...group, rows: kept }];
    }
    const [next, ...tail] = kept;
    if (!next) {
      return [];
    }
    return [{ ...group, anchor: next.draft, rows: tail }];
  });
  const anchorIsRule = clause.anchor.trigger === rule;
  if (anchorIsRule && !stripped) {
    return clause;
  }
  const displaced =
    !anchorIsRule && clause.anchor.trigger !== "unset" ? clause.anchor : null;
  return {
    ...clause,
    anchor: anchorIsRule ? clause.anchor : { trigger: rule },
    rows: displaced
      ? [{ key: `${clause.key}-kept`, join: "and", draft: displaced }, ...rows]
      : rows,
    orGroups,
  };
}

/** Pin the price rule and drop an Or group that has no condition. */
export function normalizeExitClause(clause: ExitBuilderClause): ExitBuilderClause {
  const pinned = pinExitPriceRule(clause);
  const groups = clauseOrGroups(pinned);
  const kept = groups.filter(
    (group) => group.anchor.trigger !== "unset" || group.rows.length > 0,
  );
  if (pinned === clause && kept.length === groups.length) {
    return clause;
  }
  if (kept.length === groups.length) {
    return pinned;
  }
  return { ...pinned, orGroups: kept };
}

/** Column price fields belong to the first card of that kind. */
export function exitPriceLive(clauses: readonly ExitBuilderClause[]): {
  takeProfit: boolean;
  trailing: boolean;
  stopLoss: boolean;
} {
  const first = (kind: ClassicExitKind) =>
    clauses.find((clause) => clause.kind === kind);
  return {
    takeProfit: clauseHasPriceRule(first("take_profit") ?? emptyExitClause()),
    trailing: clauseHasPriceRule(first("trailing_stop") ?? emptyExitClause()),
    stopLoss: clauseHasPriceRule(first("stop_loss") ?? emptyExitClause()),
  };
}

export function breakevenExitClause(): ExitBuilderClause {
  return {
    key: clauseKey("breakeven"),
    kind: "breakeven",
    anchor: { trigger: "profit" },
    rows: [],
    orGroups: [],
    scope: EXIT_SCOPE_ALL,
    ownPct: null,
    ownDistance: null,
  };
}

/** A saved column breakeven opens as its own card. An action list that already has one stays as it is. */
export function ensureBreakevenClause(
  clauses: readonly ExitBuilderClause[],
  enabled: boolean,
): ExitBuilderClause[] {
  if (!enabled || clauses.some((clause) => clause.kind === "breakeven")) {
    return [...clauses];
  }
  const card = breakevenExitClause();
  if (clauses.length === 1 && clauses[0]?.kind === "") {
    return [card];
  }
  return [...clauses, card];
}

export function classicExitClause(kind: ClassicExitKind): ExitBuilderClause {
  const rule = priceRuleForKind(kind);
  return {
    key: `classic-${kind}`,
    kind,
    anchor: rule ? { trigger: rule } : { trigger: "unset" },
    rows: [],
    orGroups: [],
    scope: EXIT_SCOPE_ALL,
    ownPct: null,
    ownDistance: null,
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
    orGroups: [],
    scope: EXIT_SCOPE_ALL,
    ownPct: null,
    ownDistance: null,
  };
}

/** Action menu value. A Close whose first condition is a webhook is Signal Webhook. */
export function exitBuilderActionValue(clause: ExitBuilderClause): string {
  if (isClassicExitKind(clause.kind) || clause.kind === "breakeven") {
    return clause.kind;
  }
  if (clause.kind === "custom") {
    return clause.anchor.trigger === "webhook" ? "webhook" : "close";
  }
  return "";
}

export function clauseScope(clause: ExitBuilderClause): ExitScope {
  return clause.scope ?? EXIT_SCOPE_ALL;
}

/** Missing means Average, which is how a saved card and the classic columns behave. */
export function clauseReference(clause: ExitBuilderClause): ExitReference {
  return clause.reference === "lot" ? "lot" : "average";
}

export function clauseOrGroups(clause: ExitBuilderClause): ExitOrGroup[] {
  return clause.orGroups ?? [];
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

/** A Signal webhook on this side still has no desk webhook chosen. */
export function exitClausesNeedWebhook(
  clauses: readonly ExitBuilderClause[],
): boolean {
  return clauses.some((clause) => {
    const drafts = [
      clause.anchor,
      ...clause.rows.map((row) => row.draft),
      ...clauseOrGroups(clause).flatMap((group) => [
        group.anchor,
        ...group.rows.map((row) => row.draft),
      ]),
    ];
    return drafts.some(
      (draft) => draft.trigger === "webhook" && draft.webhookId.trim() === "",
    );
  });
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
    .map((clause) => ({
      ...classicExitClause(clause.kind),
      key: clause.key,
      anchor: clause.anchor,
      rows: clause.rows,
      orGroups: clauseOrGroups(clause),
      scope: clauseScope(clause),
      ownPct: clause.ownPct ?? null,
      ownDistance: clause.ownDistance ?? null,
      levels: clause.levels,
    }));
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
    const extra = clauseOrGroups(clause).reduce(
      (sum, group) => sum + 1 + group.rows.length,
      0,
    );
    return count + 1 + clause.rows.length + extra;
  }, 0);
}

export function exitClausesFromSaved(input: {
  takeProfit: boolean;
  trailing: boolean;
  stopLoss: boolean;
  breakeven?: boolean;
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
  if (input.breakeven) {
    clauses.push(breakevenExitClause());
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
  const [leadGroup, ...orGroups] = groups;
  const clause = customExitClause(lead, leadGroup ?? []);
  clause.orGroups = orGroups.flatMap((group) => {
    const [head, ...tail] = group;
    if (!head) {
      return [];
    }
    return [
      {
        key: head.key,
        anchor: head.draft,
        rows: tail.map((row) => ({ ...row, join: "and" as const })),
      },
    ];
  });
  return [clause];
}

/** Custom clauses become the stored anchor plus And/Or rows. */
export function customStackFromClauses(clauses: readonly ExitBuilderClause[]): {
  anchor: HardExitDraft | null;
  rows: ExitStackRow[];
} {
  const first = clauses.find((clause) => clause.kind === "custom");
  if (!first) {
    return { anchor: null, rows: [] };
  }
  const rows: ExitStackRow[] = first.rows.map((row) => ({
    ...row,
    join: "and" as StrategyJoin,
  }));
  for (const group of clauseOrGroups(first)) {
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
