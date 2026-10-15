"use client";

import { useEffect, useRef } from "react";
import { AppSelect } from "@/components/app-select";
import { HintLabel } from "@/components/bot-form-chrome";
import { HardExitFields } from "@/components/hard-exit-fields";
import { IconPlus, IconTrash } from "@/components/icons";
import {
  hardExitAnchor,
  hardExitClaim,
  hardExitTriggerTimeframe,
  leafFromHardExit,
} from "@/lib/dca/exit-stack";
import {
  hardExitComplete,
  hardExitForTrigger,
  hardExitParts,
  type HardExitDraft,
  type HardExitTrigger,
} from "@/lib/dca/hard-exit";
import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";
import type { FuturesSide } from "@/lib/futures/model";
import {
  STRATEGY_CONDITION_CAP,
  entryJoinDisabled,
  entryKindDisabled,
  entrySlotAllowed,
  entryWebhookIdDisabled,
  type EntryConflictSlot,
  type EntryStack,
  type StrategyJoin,
} from "@/lib/strategy/expr";

export type ExitStackRow = {
  key: string;
  join: StrategyJoin;
  draft: HardExitDraft;
};

function rowKey(): string {
  return `exit-${Math.random().toString(36).slice(2, 10)}`;
}

export function exitRowsFromStack(
  stack: EntryStack | null | undefined,
): ExitStackRow[] {
  if (!stack) {
    return [];
  }
  const rows: ExitStackRow[] = [];
  stack.leaves.forEach((leaf, index) => {
    if (leaf.kind === "price") {
      rows.push({
        key: rowKey(),
        join: stack.joins[index] ?? "and",
        draft: {
          trigger: "price",
          triggerBy: leaf.triggerBy,
          compare: leaf.compare,
          price: String(leaf.price),
        },
      });
      return;
    }
    if (leaf.kind === "webhook") {
      rows.push({
        key: rowKey(),
        join: stack.joins[index] ?? "and",
        draft: { trigger: "webhook", webhookId: leaf.webhookId },
      });
      return;
    }
    if (leaf.kind === "filter") {
      rows.push({
        key: rowKey(),
        join: stack.joins[index] ?? "and",
        draft: {
          trigger: leaf.spec.kind === "supertrend" ? "trend" : "indicator",
          spec: leaf.spec,
        },
      });
    }
  });
  return rows;
}

export function exitStackFromRows(rows: ExitStackRow[]): EntryStack {
  const leaves: EntryStack["leaves"] = [];
  const joins: StrategyJoin[] = [];
  for (const row of rows) {
    if (!hardExitComplete(row.draft)) {
      continue;
    }
    const parts = hardExitParts(row.draft);
    const leaf = leafFromHardExit(parts.filter, parts.signal);
    if (!leaf) {
      continue;
    }
    leaves.push(leaf);
    joins.push(row.join);
  }
  return { leaves, joins };
}

export function exitConflictSlots(
  anchor: HardExitDraft,
  rows: ExitStackRow[],
): EntryConflictSlot[] {
  const first = hardExitAnchor(anchor);
  return [
    ...(first ? [first] : []),
    ...rows.map((row) => ({
      kind: row.draft.trigger,
      join: row.join,
      webhookId: row.draft.trigger === "webhook" ? row.draft.webhookId : null,
      claim: hardExitClaim(row.draft),
    })),
  ];
}

function usedTimeframes(
  anchor: HardExitDraft,
  rows: ExitStackRow[],
): Set<DcaIndicatorTimeframe> {
  const used = new Set<DcaIndicatorTimeframe>();
  const first = hardExitTriggerTimeframe(anchor);
  if (first) {
    used.add(first);
  }
  for (const row of rows) {
    const timeframe = hardExitTriggerTimeframe(row.draft);
    if (timeframe) {
      used.add(timeframe);
    }
  }
  return used;
}

export function ExitConditionStack({
  prefix,
  side,
  anchor,
  rows,
  onChange,
  webhooks = [],
  gridClass,
  fieldClass,
  labelClass,
  named = true,
}: {
  prefix: string;
  side: FuturesSide;
  anchor: HardExitDraft;
  rows: ExitStackRow[];
  onChange: (rows: ExitStackRow[]) => void;
  webhooks?: { id: string; name: string }[];
  gridClass: string;
  fieldClass: string;
  labelClass: string;
  named?: boolean;
}) {
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  const slots = exitConflictSlots(anchor, rows);
  const webhookIds = webhooks.map((hook) => hook.id);
  const anchorSlot = hardExitAnchor(anchor);
  function commit(next: ExitStackRow[]) {
    rowsRef.current = next;
    onChange(next);
  }
  function replace(key: string, next: ExitStackRow) {
    commit(rowsRef.current.map((item) => (item.key === key ? next : item)));
  }
  function addRow() {
    const current = rowsRef.current;
    const timeframeSet = usedTimeframes(anchor, current);
    const timeframe =
      timeframeSet.size >= 4
        ? (timeframeSet.values().next().value ?? "240")
        : "240";
    const kinds: HardExitTrigger[] = ["indicator", "price", "trend", "webhook"];
    let trigger: HardExitTrigger = "indicator";
    let join: StrategyJoin = "and";
    for (const candidate of kinds) {
      const draft = hardExitForTrigger(candidate, side, null);
      const andSlots = exitConflictSlots(anchor, [
        ...current,
        { key: "next", join: "and", draft },
      ]);
      if (
        entrySlotAllowed({
          slots: andSlots,
          index: andSlots.length - 1,
          kind: candidate,
          webhookIds,
        })
      ) {
        trigger = candidate;
        break;
      }
      const orSlots = exitConflictSlots(anchor, [
        ...current,
        { key: "next", join: "or", draft },
      ]);
      if (
        entrySlotAllowed({
          slots: orSlots,
          index: orSlots.length - 1,
          kind: candidate,
          webhookIds,
        })
      ) {
        trigger = candidate;
        join = "or";
        break;
      }
    }
    const base = hardExitForTrigger(trigger, side, null);
    const draft: HardExitDraft =
      base.trigger === "indicator" || base.trigger === "trend"
        ? { ...base, spec: { ...base.spec, timeframe } }
        : base;
    commit([...current, { key: rowKey(), join, draft }]);
  }
  return (
    <div className="space-y-4">
      {named ? (
        <input type="hidden" name={`${prefix}StackCount`} value={String(rows.length)} />
      ) : null}
      {rows.map((row, index) => {
        const slotIndex = anchorSlot ? index + 1 : index;
        const disabledKinds = (["price", "indicator", "trend", "webhook"] as const).filter(
          (kind) =>
            kind !== row.draft.trigger &&
            entryKindDisabled({
              slots,
              index: slotIndex,
              kind,
              webhookIds,
            }),
        );
        return (
          <div key={row.key} className="space-y-3 border-t border-line pt-4">
            <div className="flex items-end justify-between gap-3">
              <label className={`${labelClass} w-36`}>
                <HintLabel text="Join" required />
                <AppSelect
                  name={named ? `${prefix}Stack${index}Join` : undefined}
                  value={row.join}
                  onChange={(event) => {
                    const join = event.target.value === "or" ? "or" : "and";
                    replace(row.key, { ...row, join });
                  }}
                  className={fieldClass}
                >
                  <option
                    value="and"
                    disabled={entryJoinDisabled({
                      slots,
                      index: slotIndex,
                      join: "and",
                    })}
                  >
                    And
                  </option>
                  <option value="or">Or</option>
                </AppSelect>
              </label>
              <button
                type="button"
                className="inline-flex items-center gap-2 pb-2 text-sm text-danger"
                onClick={() =>
                  onChange(rows.filter((item) => item.key !== row.key))
                }
              >
                <IconTrash size={14} className="size-3.5" />
                Remove
              </button>
            </div>
            <HardExitFields
              prefix={`${prefix}Stack${index}`}
              side={side}
              value={row.draft}
              onChange={(draft) => replace(row.key, { ...row, draft })}
              webhooks={webhooks}
              gridClass={gridClass}
              fieldClass={fieldClass}
              labelClass={labelClass}
              named={named}
              seriesSlots={slots}
              seriesIndex={slotIndex}
              disabledKinds={[...disabledKinds]}
              disabledWebhookIds={webhooks
                .map((hook) => hook.id)
                .filter((id) =>
                  entryWebhookIdDisabled({
                    slots,
                    index: slotIndex,
                    webhookId: id,
                  }),
                )}
            />
          </div>
        );
      })}
      {rows.length + 1 < STRATEGY_CONDITION_CAP ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
          onClick={addRow}
        >
          <IconPlus size={14} className="size-3.5" />
          Add condition
        </button>
      ) : null}
    </div>
  );
}

export function anchorDisabledKinds(
  anchor: HardExitDraft,
  rows: ExitStackRow[],
  webhookIds: string[],
): HardExitTrigger[] {
  const slots = exitConflictSlots(anchor, rows);
  return (["price", "indicator", "trend", "webhook"] as const).filter((kind) =>
    entryKindDisabled({ slots, index: 0, kind, webhookIds }),
  );
}

export function anchorDisabledWebhookIds(
  anchor: HardExitDraft,
  rows: ExitStackRow[],
  webhookIds: string[],
): string[] {
  const slots = exitConflictSlots(anchor, rows);
  return webhookIds.filter((id) =>
    entryWebhookIdDisabled({ slots, index: 0, webhookId: id }),
  );
}
