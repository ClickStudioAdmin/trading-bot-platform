import { formatHardExitText } from "@/lib/bots/condition-copy";
import type { FuturesSide } from "@/lib/futures/model";
import type { CandleBar } from "@/lib/market/candles";
import {
  STRATEGY_CONDITION_CAP,
  STRATEGY_TIMEFRAME_CAP,
  emptyEntryStack,
  entryStackConflictMessage,
  entryStackMet,
  entryStackTimeframes,
  entryStackToJson,
  strategyLeafTimeframe,
  type EntryConflictSlot,
  type EntryStack,
  type StrategyJoin,
  type StrategyLeaf,
} from "@/lib/strategy/expr";
import { dcaFilterMet, type DcaFilterSpec } from "./filters";
import {
  hardExitDraftFromStored,
  parseHardExitForm,
  writeHardExitFormFields,
  type HardExitDraft,
  type HardExitSignal,
} from "./hard-exit";
import type { DcaIndicatorTimeframe } from "./indicators";

export type { EntryStack as ExitStack };

export function exitStackMet(input: {
  first: boolean;
  leaves: boolean[];
  joins: StrategyJoin[];
}): boolean {
  return entryStackMet({
    trigger: input.first,
    leaves: input.leaves,
    joins: input.joins,
  });
}

export function hardExitAnchor(
  draft: HardExitDraft | null | undefined,
): EntryConflictSlot | null {
  if (!draft) {
    return null;
  }
  if (draft.trigger === "webhook") {
    return { kind: "webhook", join: "and", webhookId: draft.webhookId };
  }
  return { kind: draft.trigger, join: "and" };
}

export function hardExitTriggerTimeframe(
  draft: HardExitDraft | null | undefined,
): DcaIndicatorTimeframe | null {
  if (!draft || draft.trigger === "price" || draft.trigger === "webhook") {
    return null;
  }
  return draft.spec.timeframe;
}

export function anchorFromHardExit(
  filter: DcaFilterSpec | null | undefined,
  signal: HardExitSignal | null | undefined,
): EntryConflictSlot | null {
  return hardExitAnchor(hardExitDraftFromStored(filter, signal));
}

export function leafFromHardExit(
  filter: DcaFilterSpec | null | undefined,
  signal: HardExitSignal | null | undefined,
): StrategyLeaf | null {
  if (signal?.trigger === "price") {
    return {
      kind: "price",
      triggerBy: signal.triggerBy,
      compare: signal.compare,
      price: signal.price,
    };
  }
  if (signal?.trigger === "webhook") {
    return { kind: "webhook", webhookId: signal.webhookId };
  }
  if (filter) {
    return { kind: "filter", spec: filter };
  }
  return null;
}

export function exitStackError(input: {
  stack: EntryStack;
  triggerTimeframe?: DcaIndicatorTimeframe | null;
}): string | null {
  if (input.stack.joins.length !== input.stack.leaves.length) {
    return "Hard Exit conditions are incomplete.";
  }
  if (1 + input.stack.leaves.length > STRATEGY_CONDITION_CAP) {
    return "Use at most 12 Hard Exit conditions.";
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

export function parseExitStackForm(
  form: FormData,
  prefix: string,
  anchor: EntryConflictSlot | null,
  triggerTimeframe: DcaIndicatorTimeframe | null,
  label = "Hard Exit",
):
  | { ok: true; present: boolean; stack: EntryStack }
  | { ok: false; error: string } {
  if (form.get(`${prefix}StackCount`) == null) {
    return { ok: true, present: false, stack: emptyEntryStack() };
  }
  const count = Number(String(form.get(`${prefix}StackCount`)));
  if (!Number.isInteger(count) || count < 0) {
    return { ok: false, error: "Hard Exit conditions are incomplete." };
  }
  if (count > 0 && !anchor) {
    return { ok: false, error: `Turn on ${label} before adding conditions.` };
  }
  const leaves: StrategyLeaf[] = [];
  const joins: StrategyJoin[] = [];
  for (let index = 0; index < count; index += 1) {
    const joinRaw = String(form.get(`${prefix}Stack${index}Join`) ?? "and");
    const parsed = parseHardExitForm(form, `${prefix}Stack${index}`, label);
    if (!parsed.ok) {
      return parsed;
    }
    const leaf = leafFromHardExit(parsed.filter, parsed.signal);
    if (!leaf) {
      return { ok: false, error: "Hard Exit conditions are incomplete." };
    }
    leaves.push(leaf);
    joins.push(joinRaw === "or" ? "or" : "and");
  }
  const stack: EntryStack = { leaves, joins };
  const error = exitStackError({ stack, triggerTimeframe });
  if (error) {
    return { ok: false, error };
  }
  if (anchor) {
    const conflict = entryStackConflictMessage({ trigger: anchor, stack });
    if (conflict) {
      return { ok: false, error: conflict };
    }
  }
  return { ok: true, present: true, stack };
}

export function writeExitStackFormFields(
  form: FormData,
  prefix: string,
  stack: EntryStack | null | undefined,
): void {
  const leaves = stack?.leaves ?? [];
  form.set(`${prefix}StackCount`, String(leaves.length));
  leaves.forEach((leaf, index) => {
    const row = `${prefix}Stack${index}`;
    form.set(`${row}Join`, stack?.joins[index] ?? "and");
    if (leaf.kind === "price") {
      writeHardExitFormFields(form, row, {
        trigger: "price",
        triggerBy: leaf.triggerBy,
        compare: leaf.compare,
        price: String(leaf.price),
      });
      return;
    }
    if (leaf.kind === "webhook") {
      writeHardExitFormFields(form, row, {
        trigger: "webhook",
        webhookId: leaf.webhookId,
      });
      return;
    }
    if (leaf.kind === "filter") {
      writeHardExitFormFields(form, row, {
        trigger: leaf.spec.kind === "supertrend" ? "trend" : "indicator",
        spec: leaf.spec,
      });
    }
  });
}

/** Stored on a template so a webhook row survives without a desk id. */
export const TEMPLATE_EXIT_WEBHOOK_ID = "template-webhook";

function templateWebhookId(webhookId: string): boolean {
  const id = webhookId.trim();
  return id === "" || id === TEMPLATE_EXIT_WEBHOOK_ID;
}

export function templateExitStack(
  stack: EntryStack | null | undefined,
): EntryStack | null {
  if (!stack || stack.leaves.length === 0) {
    return null;
  }
  return {
    joins: [...stack.joins],
    leaves: stack.leaves.map((leaf) =>
      leaf.kind === "webhook"
        ? { kind: "webhook", webhookId: TEMPLATE_EXIT_WEBHOOK_ID }
        : leaf,
    ),
  };
}

/** Editor rows keep a template webhook blank until this desk picks one. */
export function exitStackForEditor(
  stack: EntryStack | null | undefined,
): EntryStack | null {
  if (!stack || stack.leaves.length === 0) {
    return null;
  }
  return {
    joins: [...stack.joins],
    leaves: stack.leaves.map((leaf) =>
      leaf.kind === "webhook" && leaf.webhookId === TEMPLATE_EXIT_WEBHOOK_ID
        ? { kind: "webhook", webhookId: "" }
        : leaf,
    ),
  };
}

export function exitStackWebhookIds(stack: EntryStack | null | undefined): string[] {
  if (!stack) {
    return [];
  }
  return stack.leaves
    .filter(
      (leaf) =>
        leaf.kind === "webhook" && !templateWebhookId(leaf.webhookId),
    )
    .map((leaf) => (leaf.kind === "webhook" ? leaf.webhookId : ""));
}

export function applyExitStackWebhook(
  stack: EntryStack | null | undefined,
  webhookId: string,
): EntryStack {
  if (!stack) {
    return emptyEntryStack();
  }
  return {
    joins: [...stack.joins],
    leaves: stack.leaves.map((leaf) =>
      leaf.kind === "webhook" && templateWebhookId(leaf.webhookId)
        ? { kind: "webhook", webhookId }
        : leaf,
    ),
  };
}

export function exitStackDropEmptyWebhooks(stack: EntryStack): EntryStack {
  const leaves: StrategyLeaf[] = [];
  const joins: StrategyJoin[] = [];
  stack.leaves.forEach((leaf, index) => {
    if (leaf.kind === "webhook" && templateWebhookId(leaf.webhookId)) {
      return;
    }
    leaves.push(leaf);
    joins.push(stack.joins[index] ?? "and");
  });
  return { leaves, joins };
}

export function exitStackNeedsWebhook(
  stack: EntryStack | null | undefined,
): boolean {
  return Boolean(
    stack?.leaves.some(
      (leaf) => leaf.kind === "webhook" && templateWebhookId(leaf.webhookId),
    ),
  );
}

export function exitStackNeedsWideBars(
  stack: EntryStack | null | undefined,
): boolean {
  if (!stack) {
    return false;
  }
  return stack.leaves.some(
    (leaf) =>
      leaf.kind === "filter" &&
      (leaf.spec.kind === "supertrend" || leaf.spec.kind === "atr_band"),
  );
}

export function exitExpressionMet(input: {
  first: boolean;
  stack: EntryStack | null | undefined;
  side: FuturesSide;
  price: number | null;
  prices?: {
    last: number | null;
    mark: number | null;
    index: number | null;
  } | null;
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>;
  firedWebhookId?: string | null;
}): boolean {
  const stack = input.stack ?? emptyEntryStack();
  if (stack.leaves.length === 0) {
    return input.first;
  }
  return exitStackMet({
    first: input.first,
    joins: stack.joins,
    leaves: stack.leaves.map((leaf) =>
      exitLeafMet({
        leaf,
        side: input.side,
        price: input.price,
        prices: input.prices,
        barsByTimeframe: input.barsByTimeframe,
        firedWebhookId: input.firedWebhookId,
      }),
    ),
  });
}

function quotedPrice(
  triggerBy: "last" | "mark" | "index",
  price: number | null,
  prices?: {
    last: number | null;
    mark: number | null;
    index: number | null;
  } | null,
): number | null {
  const quoted = prices?.[triggerBy] ?? (triggerBy === "last" ? price : null);
  return quoted != null && quoted > 0 ? quoted : null;
}

function exitLeafMet(input: {
  leaf: StrategyLeaf;
  side: FuturesSide;
  price: number | null;
  prices?: {
    last: number | null;
    mark: number | null;
    index: number | null;
  } | null;
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>;
  firedWebhookId?: string | null;
}): boolean {
  const leaf = input.leaf;
  if (leaf.kind === "filter") {
    const bars = input.barsByTimeframe.get(leaf.spec.timeframe) ?? [];
    return dcaFilterMet({
      spec: leaf.spec,
      side: input.side,
      closes: bars.map((row) => row.close),
      bars,
    });
  }
  if (leaf.kind === "price") {
    const level = quotedPrice(leaf.triggerBy, input.price, input.prices);
    if (level == null) {
      return false;
    }
    return leaf.compare === "gte" ? level >= leaf.price : level <= leaf.price;
  }
  if (leaf.kind === "webhook") {
    return input.firedWebhookId != null && input.firedWebhookId === leaf.webhookId;
  }
  return false;
}

export function exitStackForSide(
  playbook: {
    exitIf?: DcaFilterSpec | null;
    shortExitIf?: DcaFilterSpec | null;
    exitHard?: HardExitSignal | null;
    shortExitHard?: HardExitSignal | null;
    exitStack?: EntryStack | null;
    shortExitStack?: EntryStack | null;
  },
  side: FuturesSide,
): EntryStack {
  if (side === "short" && (playbook.shortExitIf || playbook.shortExitHard)) {
    return playbook.shortExitStack ?? emptyEntryStack();
  }
  return playbook.exitStack ?? emptyEntryStack();
}

export function formatExitExpressionText(input: {
  filter?: DcaFilterSpec | null;
  signal?: HardExitSignal | null;
  stack?: EntryStack | null;
  side?: FuturesSide;
}): string {
  const side = input.side ?? "long";
  const first = formatHardExitText({
    filter: input.filter,
    signal: input.signal,
    side,
  });
  const stack = input.stack;
  if (!stack || stack.leaves.length === 0) {
    return first;
  }
  const parts = [first];
  stack.leaves.forEach((leaf, index) => {
    const join = stack.joins[index] === "or" ? "Or" : "And";
    const text =
      leaf.kind === "filter"
        ? formatHardExitText({ filter: leaf.spec, side })
        : leaf.kind === "price"
          ? formatHardExitText({
              signal: {
                trigger: "price",
                triggerBy: leaf.triggerBy,
                compare: leaf.compare,
                price: leaf.price,
              },
              side,
            })
          : leaf.kind === "webhook"
            ? "Signal webhook"
            : formatHardExitText({ side });
    parts.push(`${join} ${text}`);
  });
  return parts.filter(Boolean).join(" ");
}

export function exitStackJson(stack: EntryStack | null | undefined): ReturnType<
  typeof entryStackToJson
> | null {
  if (!stack || stack.leaves.length === 0) {
    return null;
  }
  return entryStackToJson(stack);
}

export function exitLeafResults(input: {
  stack: EntryStack | null | undefined;
  side: FuturesSide;
  price: number | null;
  prices?: {
    last: number | null;
    mark: number | null;
    index: number | null;
  } | null;
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>;
  firedWebhookId?: string | null;
}): boolean[] {
  const stack = input.stack ?? emptyEntryStack();
  return stack.leaves.map((leaf) =>
    exitLeafMet({
      leaf,
      side: input.side,
      price: input.price,
      prices: input.prices,
      barsByTimeframe: input.barsByTimeframe,
      firedWebhookId: input.firedWebhookId,
    }),
  );
}

export function exitStackTimeframes(stack: EntryStack | null | undefined): DcaIndicatorTimeframe[] {
  if (!stack) {
    return [];
  }
  return entryStackTimeframes(stack);
}
