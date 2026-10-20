import { entryLeafMet } from "@/lib/futures/conditions";
import type { FuturesSide } from "@/lib/futures/model";
import type { CandleBar } from "@/lib/market/candles";
import {
  addStackMet,
  entryStackIsLegacy,
  entryStackMet,
  entryStackTimeframes,
  resolveEntryStack,
  type EntryStack,
  type StrategyJoin,
} from "@/lib/strategy/expr";
import { retraceMet } from "@/lib/strategy/retrace";
import type { RetraceSpec } from "@/lib/strategy/retrace";
import { dcaFilterForSide, dcaFilterMet } from "./filters";
import { exitStackForSide, exitStackWebhookIds } from "./exit-stack";
import { hardExitForSide } from "./hard-exit";
import type { DcaIndicatorTimeframe } from "./indicators";
import {
  dcaEnabledSides,
  dcaStartKindForSide,
  dcaWebhookIdForSide,
  type DcaPlaybookConfig,
} from "./playbook";

type StackPlaybook = Pick<
  DcaPlaybookConfig,
  | "direction"
  | "confirm"
  | "shortConfirm"
  | "entryStack"
  | "shortEntryStack"
  | "startKind"
  | "shortStartKind"
  | "webhookId"
  | "shortWebhookId"
  | "exitIf"
  | "shortExitIf"
  | "exitHard"
  | "shortExitHard"
  | "exitStack"
  | "shortExitStack"
> & {
  retrace?: RetraceSpec | null;
  shortRetrace?: RetraceSpec | null;
  addStack?: EntryStack | null;
  shortAddStack?: EntryStack | null;
};

export function dcaEntryStackForSide(
  playbook: StackPlaybook,
  side: FuturesSide,
): EntryStack {
  const shortLeg = playbook.direction === "both" && side === "short";
  return resolveEntryStack(
    shortLeg ? playbook.shortEntryStack : playbook.entryStack,
    shortLeg ? playbook.shortConfirm : playbook.confirm,
  );
}

export function dcaEntryStackTimeframes(
  playbook: Pick<DcaPlaybookConfig, "entryStack" | "shortEntryStack">,
): DcaIndicatorTimeframe[] {
  const rows: DcaIndicatorTimeframe[] = [];
  for (const stack of [playbook.entryStack, playbook.shortEntryStack]) {
    if (!stack || entryStackIsLegacy(stack)) {
      continue;
    }
    for (const timeframe of entryStackTimeframes(stack)) {
      if (!rows.includes(timeframe)) {
        rows.push(timeframe);
      }
    }
  }
  return rows;
}

export function dcaEntryStackNeedsWideBars(
  playbook: Pick<DcaPlaybookConfig, "entryStack" | "shortEntryStack">,
): boolean {
  for (const stack of [playbook.entryStack, playbook.shortEntryStack]) {
    if (!stack) {
      continue;
    }
    for (const leaf of stack.leaves) {
      if (
        leaf.kind === "filter" &&
        (leaf.spec.kind === "supertrend" || leaf.spec.kind === "atr_band")
      ) {
        return true;
      }
      if (
        (leaf.kind === "indicator" || leaf.kind === "trend") &&
        (leaf.start.kind === "supertrend" || leaf.start.kind === "atr_band")
      ) {
        return true;
      }
    }
  }
  return false;
}

export function dcaPlaybookMatchesWebhook(
  playbook: StackPlaybook,
  firedId: string,
): boolean {
  if (!firedId) {
    return false;
  }
  if (
    dcaEnabledSides(playbook.direction).some(
      (side) =>
        dcaStartKindForSide(playbook, side) === "webhook" &&
        dcaWebhookIdForSide(playbook, side) === firedId,
    )
  ) {
    return true;
  }
  if (
    dcaEnabledSides(playbook.direction).some((side) => {
      const signal = hardExitForSide(playbook, side).signal;
      if (signal?.trigger === "webhook" && signal.webhookId === firedId) {
        return true;
      }
      return exitStackWebhookIds(exitStackForSide(playbook, side)).includes(
        firedId,
      );
    })
  ) {
    return true;
  }
  return dcaEnabledSides(playbook.direction).some((side) =>
    dcaEntryStackForSide(playbook, side).leaves.some(
      (leaf) => leaf.kind === "webhook" && leaf.webhookId === firedId,
    ),
  );
}

export function dcaEntryTickExtras(input: {
  playbook: StackPlaybook;
  side: FuturesSide;
  price: number | null;
  prices?: {
    last: number | null;
    mark: number | null;
    index: number | null;
  } | null;
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>;
  firedWebhookId?: string | null;
}): { entryLeaves?: boolean[]; entryJoins?: StrategyJoin[] } {
  const stack = dcaEntryStackForSide(input.playbook, input.side);
  if (entryStackIsLegacy(stack)) {
    return {};
  }
  return {
    entryJoins: stack.joins,
    entryLeaves: stack.leaves.map((leaf) =>
      entryLeafMet({
        leaf,
        side: input.side,
        price: input.price,
        prices: input.prices,
        barsByTimeframe: input.barsByTimeframe,
        firedWebhookId: input.firedWebhookId,
      }),
    ),
  };
}

function quotedSource(
  source: "last" | "mark" | "index",
  price: number | null,
  prices?: {
    last: number | null;
    mark: number | null;
    index: number | null;
  } | null,
): number | null {
  if (!prices) {
    return price;
  }
  if (source === "mark") {
    return prices.mark;
  }
  if (source === "index") {
    return prices.index;
  }
  return prices.last;
}

/** Retrace start and the additional-order gate for one side. */
export function dcaSideGates(input: {
  playbook: StackPlaybook;
  side: FuturesSide;
  price: number | null;
  prices?: {
    last: number | null;
    mark: number | null;
    index: number | null;
  } | null;
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>;
  firedWebhookId?: string | null;
  protection?: { openQty: number | null; provenPct: number | null } | null;
}): { retraceMet: boolean; addMet: boolean } {
  const shortLeg = input.playbook.direction === "both" && input.side === "short";
  const spec = shortLeg ? input.playbook.shortRetrace : input.playbook.retrace;
  const startKind = dcaStartKindForSide(input.playbook, input.side);
  let retraceNow = false;
  if (startKind === "retrace" && spec) {
    const bars = input.barsByTimeframe.get(spec.timeframe) ?? [];
    retraceNow = retraceMet({
      spec,
      price: quotedSource(spec.source, input.price, input.prices),
      bars,
    });
  }
  const add = shortLeg ? input.playbook.shortAddStack : input.playbook.addStack;
  if (!add || add.leaves.length === 0) {
    return { retraceMet: retraceNow, addMet: true };
  }
  const leaves = add.leaves.map((leaf) =>
    entryLeafMet({
      leaf,
      side: input.side,
      price: input.price,
      prices: input.prices,
      barsByTimeframe: input.barsByTimeframe,
      firedWebhookId: input.firedWebhookId,
      protection: input.protection,
    }),
  );
  return {
    retraceMet: retraceNow,
    addMet: addStackMet({ stack: add, leaves }),
  };
}

/** Full entry expression. Legacy confirm stays an And on the trigger. */
export function dcaEntryExpressionMet(input: {
  playbook: StackPlaybook;
  side: FuturesSide;
  trigger: boolean;
  price: number | null;
  prices?: {
    last: number | null;
    mark: number | null;
    index: number | null;
  } | null;
  barsByTimeframe: Map<DcaIndicatorTimeframe, CandleBar[]>;
  firedWebhookId?: string | null;
}): boolean {
  const stack = dcaEntryStackForSide(input.playbook, input.side);
  if (entryStackIsLegacy(stack)) {
    if (!input.trigger) {
      return false;
    }
    const confirm = dcaFilterForSide(
      {
        confirm: input.playbook.confirm,
        shortConfirm: input.playbook.shortConfirm,
      },
      input.side,
      "confirm",
    );
    if (!confirm) {
      return true;
    }
    const bars = input.barsByTimeframe.get(confirm.timeframe) ?? [];
    return dcaFilterMet({
      spec: confirm,
      side: input.side,
      closes: bars.map((row) => row.close),
      bars,
    });
  }
  return entryStackMet({
    trigger: input.trigger,
    joins: stack.joins,
    leaves: stack.leaves.map((leaf) =>
      entryLeafMet({
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
