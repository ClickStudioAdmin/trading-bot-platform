"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  AddConditionButton,
  andInsertIndex,
  GroupedConditions,
  insertAt,
  RemoveConditionButton,
} from "@/components/condition-group";
import { AppSelect } from "@/components/app-select";
import { HintLabel } from "@/components/bot-form-chrome";
import { HardExitFields } from "@/components/hard-exit-fields";
import { IconPlus } from "@/components/icons";
import {
  hardExitAnchor,
  hardExitClaim,
  leafFromHardExit,
} from "@/lib/dca/exit-stack";
import {
  hardExitComplete,
  hardExitParts,
  isPriceRuleDraft,
  type HardExitDraft,
  type HardExitTrigger,
} from "@/lib/dca/hard-exit";
import type { FuturesSide } from "@/lib/futures/model";
import {
  STRATEGY_CONDITION_CAP,
  entryJoinDisabled,
  entryKindDisabled,
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
    ...rows.map((row) =>
      row.draft.trigger === "unset" ||
      (row.draft.trigger === "indicator" && row.draft.spec == null)
        ? {
            kind: "indicator" as const,
            join: row.join,
            webhookId: null,
            claim: null,
          }
        : isPriceRuleDraft(row.draft)
          ? {
              kind: "indicator" as const,
              join: row.join,
              webhookId: null,
              claim: null,
            }
          : {
            kind: row.draft.trigger,
            join: row.join,
            webhookId:
              row.draft.trigger === "webhook" ? row.draft.webhookId : null,
            claim: hardExitClaim(row.draft),
          },
    ),
  ];
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
  grouped = false,
  lead,
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
  /** And rows share a card. Or starts the next card. */
  grouped?: boolean;
  lead?: ReactNode;
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
    commit([
      ...rowsRef.current,
      { key: rowKey(), join: "and", draft: { trigger: "unset" } },
    ]);
  }
  function addAt(join: StrategyJoin, groupIndex?: number) {
    const current = rowsRef.current;
    if (current.length + 1 >= STRATEGY_CONDITION_CAP) {
      return;
    }
    const index =
      join === "or" ? current.length : andInsertIndex(current, groupIndex ?? 0);
    commit(
      insertAt(current, index, {
        key: rowKey(),
        join,
        draft: { trigger: "unset" },
      }),
    );
  }
  function joinControl(row: ExitStackRow, index: number, slotIndex: number, labelled: boolean) {
    return (
      <label className={`${labelled ? labelClass : ""} w-36 shrink-0`}>
        {labelled ? (
          <HintLabel text="Join" required />
        ) : (
          <span className="sr-only">
            How this condition combines with the ones above
          </span>
        )}
        <AppSelect
          name={named ? `${prefix}Stack${index}Join` : undefined}
          value={row.join}
          aria-label={
            labelled ? undefined : "How this condition combines with the ones above"
          }
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
    );
  }
  function removeControl(
    row: ExitStackRow,
    scope: "group" | "condition" = "condition",
  ) {
    return (
      <RemoveConditionButton
        scope={scope}
        onClick={() => onChange(rows.filter((item) => item.key !== row.key))}
      />
    );
  }
  const rendered = rows.map((row, index) => {
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
    return {
      key: row.key,
      join: row.join,
      row,
      index,
      slotIndex,
      body: (
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
      ),
    };
  });
  const countInput = named ? (
    <input type="hidden" name={`${prefix}StackCount`} value={String(rows.length)} />
  ) : null;
  const canAdd = rows.length + 1 < STRATEGY_CONDITION_CAP;
  const addButton = canAdd ? (
    <button
      type="button"
      className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
      onClick={addRow}
    >
      <IconPlus size={14} className="size-3.5" />
      Add Condition
    </button>
  ) : null;
  if (grouped) {
    return (
      <div className="space-y-3">
        {countInput}
        <GroupedConditions
          rows={rendered}
          lead={lead}
          renderRemove={(item, scope) => removeControl(item.row, scope)}
          renderBody={(item) => (
            <>
              {named ? (
                <input
                  type="hidden"
                  name={`${prefix}Stack${item.index}Join`}
                  value={item.join}
                />
              ) : null}
              {item.body}
            </>
          )}
          renderAddInGroup={
            canAdd
              ? (groupIndex) => (
                  <AddConditionButton onClick={() => addAt("and", groupIndex)} />
                )
              : undefined
          }
          addGroup={
            canAdd ? (
              <AddConditionButton
                label="Add Condition Group"
                onClick={() => addAt("or")}
              />
            ) : null
          }
        />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {countInput}
      {rendered.map((item) => (
        <div key={item.key} className="space-y-3 border-t border-line pt-4">
          <div className="flex items-end justify-between gap-3">
            {joinControl(item.row, item.index, item.slotIndex, true)}
            {removeControl(item.row)}
          </div>
          {item.body}
        </div>
      ))}
      {addButton}
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
