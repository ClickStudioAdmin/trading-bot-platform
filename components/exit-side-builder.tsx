"use client";

import type { ReactNode } from "react";
import { AppSelect } from "@/components/app-select";
import {
  HintLabel,
  conditionFieldClass,
  useBotColumnLayout,
} from "@/components/bot-form-chrome";
import {
  AddConditionButton,
  JoinWord,
  RemoveConditionButton,
} from "@/components/condition-group";
import {
  anchorDisabledKinds,
  anchorDisabledWebhookIds,
  exitConflictSlots,
  type ExitStackRow,
} from "@/components/exit-condition-stack";
import { hardExitAnchor } from "@/lib/dca/exit-stack";
import { HardExitFields } from "@/components/hard-exit-fields";
import type { HardExitDraft, HardExitTrigger } from "@/lib/dca/hard-exit";
import type { FuturesSide } from "@/lib/futures/model";
import {
  customConditionCount,
  customExitClause,
  emptyExitClause,
  isClassicExitKind,
  type ExitBuilderClause,
  type ExitClauseKind,
} from "@/lib/strategy/exit-clauses";
import {
  entryKindDisabled,
  entryWebhookIdDisabled,
  STRATEGY_CONDITION_CAP,
} from "@/lib/strategy/expr";

const CLAUSE_OPTIONS: { value: Exclude<ExitClauseKind, "">; label: string }[] = [
  { value: "take_profit", label: "Take profit" },
  { value: "trailing_stop", label: "Trailing stop" },
  { value: "stop_loss", label: "Stop loss" },
  { value: "custom", label: "Build Custom Conditions" },
];

function rowKey(): string {
  return `exit-${Math.random().toString(36).slice(2, 10)}`;
}

type PlacedCustom = {
  clauseKey: string;
  role: "anchor" | "row";
  rowKey: string | null;
  stackIndex: number | null;
};

function placeCustom(clauses: readonly ExitBuilderClause[]): PlacedCustom[] {
  const placed: PlacedCustom[] = [];
  let stack = 0;
  const custom = clauses.filter((clause) => clause.kind === "custom");
  custom.forEach((clause, clauseIndex) => {
    placed.push({
      clauseKey: clause.key,
      role: "anchor",
      rowKey: null,
      stackIndex: clauseIndex === 0 ? null : stack++,
    });
    for (const row of clause.rows) {
      placed.push({
        clauseKey: clause.key,
        role: "row",
        rowKey: row.key,
        stackIndex: stack++,
      });
    }
  });
  return placed;
}

export function ExitSideBuilder({
  clauses,
  onChange,
  side,
  prefix,
  named = true,
  webhooks = [],
  fieldClass,
  labelClass,
  gridClass,
  renderTakeProfit,
  renderTrailingStop,
  renderStopLoss,
}: {
  clauses: ExitBuilderClause[];
  onChange: (next: ExitBuilderClause[]) => void;
  side: FuturesSide;
  /** Form prefix for the custom stack. `exitIf` or `r0_short_exitIf`. */
  prefix: string;
  named?: boolean;
  webhooks?: { id: string; name: string }[];
  fieldClass: string;
  labelClass: string;
  gridClass: string;
  renderTakeProfit: () => ReactNode;
  renderTrailingStop: () => ReactNode;
  renderStopLoss: () => ReactNode;
}) {
  const column = useBotColumnLayout();
  const custom = clauses.filter((clause) => clause.kind === "custom");
  const first = custom[0];
  const flatRows: ExitStackRow[] = [];
  if (first) {
    for (const row of first.rows) {
      flatRows.push({ ...row, join: "and" });
    }
    for (const group of custom.slice(1)) {
      flatRows.push({ key: group.key, join: "or", draft: group.anchor });
      for (const row of group.rows) {
        flatRows.push({ ...row, join: "and" });
      }
    }
  }
  const anchor = first?.anchor ?? null;
  const slots = exitConflictSlots(anchor ?? { trigger: "unset" }, flatRows);
  const placed = placeCustom(clauses);
  const webhookIds = webhooks.map((hook) => hook.id);
  const customCount = customConditionCount(clauses);
  const classicUsed = new Set(
    clauses.filter((clause) => isClassicExitKind(clause.kind)).map((clause) => clause.kind),
  );
  const canAddClause =
    clauses[clauses.length - 1]?.kind !== "" &&
    (classicUsed.size < 3 || customCount < STRATEGY_CONDITION_CAP);

  function commit(next: ExitBuilderClause[]) {
    onChange(next.length > 0 ? next : [emptyExitClause()]);
  }
  function patch(key: string, update: (clause: ExitBuilderClause) => ExitBuilderClause) {
    commit(clauses.map((clause) => (clause.key === key ? update(clause) : clause)));
  }
  function removeClause(key: string) {
    const next = clauses.filter((clause) => clause.key !== key);
    commit(next);
  }
  function setKind(clause: ExitBuilderClause, kind: ExitClauseKind) {
    if (kind === "custom") {
      patch(clause.key, (current) =>
        customExitClause({ trigger: "unset" }, [], current.key),
      );
      return;
    }
    patch(clause.key, (current) => ({
      ...current,
      kind,
      anchor: { trigger: "unset" },
      rows: [],
    }));
  }
  function addClause() {
    if (!canAddClause) {
      return;
    }
    commit([...clauses, emptyExitClause()]);
  }
  function addCustomRow(key: string) {
    if (customCount >= STRATEGY_CONDITION_CAP) {
      return;
    }
    patch(key, (current) => ({
      ...current,
      rows: [
        ...current.rows,
        { key: rowKey(), join: "and", draft: { trigger: "unset" } },
      ],
    }));
  }
  function removeCustomRow(clause: ExitBuilderClause, placedRow: PlacedCustom) {
    if (placedRow.role === "anchor") {
      const [promoted, ...rest] = clause.rows;
      if (!promoted) {
        removeClause(clause.key);
        return;
      }
      patch(clause.key, () => customExitClause(promoted.draft, rest, clause.key));
      return;
    }
    patch(clause.key, (current) => ({
      ...current,
      rows: current.rows.filter((row) => row.key !== placedRow.rowKey),
    }));
  }

  const stackCount = placed.filter((row) => row.stackIndex != null).length;

  return (
    <div className="space-y-3">
      {named && custom.length > 0 ? (
        <input type="hidden" name={`${prefix}StackCount`} value={String(stackCount)} />
      ) : null}
      {clauses.map((clause, index) => {
        const kindOptions = CLAUSE_OPTIONS.map((option) => {
          const taken =
            isClassicExitKind(option.value) &&
            option.value !== clause.kind &&
            classicUsed.has(option.value);
          const customFull =
            option.value === "custom" &&
            clause.kind !== "custom" &&
            customCount >= STRATEGY_CONDITION_CAP;
          return { ...option, disabled: taken || customFull };
        });
        return (
          <div key={clause.key} className="space-y-3">
            {index > 0 ? <JoinWord label="Or" /> : null}
            <div className="flex items-end justify-between gap-3">
              <label
                className={`${labelClass} ${
                  column ? "min-w-0 flex-1" : "whitespace-nowrap"
                }`}
              >
                <HintLabel text="Condition Type" required />
                <AppSelect
                  value={clause.kind}
                  onChange={(event) => {
                    const next = event.target.value as ExitClauseKind;
                    if (
                      next !== "take_profit" &&
                      next !== "trailing_stop" &&
                      next !== "stop_loss" &&
                      next !== "custom"
                    ) {
                      setKind(clause, "");
                      return;
                    }
                    setKind(clause, next);
                  }}
                  className={conditionFieldClass(fieldClass, column)}
                >
                  <option value="">Select Condition Type</option>
                  {kindOptions.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.disabled}>
                      {option.label}
                    </option>
                  ))}
                </AppSelect>
              </label>
              {clauses.length > 1 || clause.kind !== "" ? (
                <div className="shrink-0">
                  <RemoveConditionButton
                    scope="condition"
                    onClick={() => removeClause(clause.key)}
                  />
                </div>
              ) : null}
            </div>
            {clause.kind === "take_profit" ? renderTakeProfit() : null}
            {clause.kind === "trailing_stop" ? renderTrailingStop() : null}
            {clause.kind === "stop_loss" ? renderStopLoss() : null}
            {clause.kind === "custom" ? (
              <CustomGroup
                groupNumber={custom.findIndex((item) => item.key === clause.key) + 1}
                clause={clause}
                placed={placed.filter((row) => row.clauseKey === clause.key)}
                slots={slots}
                anchor={anchor}
                flatRows={flatRows}
                side={side}
                prefix={prefix}
                named={named}
                webhooks={webhooks}
                webhookIds={webhookIds}
                fieldClass={fieldClass}
                labelClass={labelClass}
                gridClass={gridClass}
                canAdd={customCount < STRATEGY_CONDITION_CAP}
                onAnchor={(draft) =>
                  patch(clause.key, (current) => ({ ...current, anchor: draft }))
                }
                onRow={(rowKeyValue, draft) =>
                  patch(clause.key, (current) => ({
                    ...current,
                    rows: current.rows.map((row) =>
                      row.key === rowKeyValue ? { ...row, draft } : row,
                    ),
                  }))
                }
                onRemove={(row) => removeCustomRow(clause, row)}
                onAdd={() => addCustomRow(clause.key)}
              />
            ) : null}
          </div>
        );
      })}
      {canAddClause ? (
        <AddConditionButton onClick={addClause} />
      ) : null}
    </div>
  );
}

function CustomGroup({
  groupNumber,
  clause,
  placed,
  slots,
  anchor,
  flatRows,
  side,
  prefix,
  named,
  webhooks,
  webhookIds,
  fieldClass,
  labelClass,
  gridClass,
  canAdd,
  onAnchor,
  onRow,
  onRemove,
  onAdd,
}: {
  groupNumber: number;
  clause: ExitBuilderClause;
  placed: PlacedCustom[];
  slots: ReturnType<typeof exitConflictSlots>;
  anchor: HardExitDraft | null;
  flatRows: ExitStackRow[];
  side: FuturesSide;
  prefix: string;
  named: boolean;
  webhooks: { id: string; name: string }[];
  webhookIds: string[];
  fieldClass: string;
  labelClass: string;
  gridClass: string;
  canAdd: boolean;
  onAnchor: (draft: HardExitDraft) => void;
  onRow: (key: string, draft: HardExitDraft) => void;
  onRemove: (row: PlacedCustom) => void;
  onAdd: () => void;
}) {
  const leadAnchor = anchor ?? clause.anchor;
  return (
    <section className="space-y-4 rounded-card border border-line bg-canvas px-4 py-4">
      <h3 className="min-w-0 text-sm font-semibold text-ink">
        Group {groupNumber}
        <span className="ml-2 text-hint font-normal text-ink-muted">
          - Every condition in this group must be true.
        </span>
      </h3>
      {placed.map((row, rowIndex) => {
        const draft =
          row.role === "anchor"
            ? clause.anchor
            : (clause.rows.find((item) => item.key === row.rowKey)?.draft ?? {
                trigger: "unset" as const,
              });
        const anchorPresent = Boolean(hardExitAnchor(anchor));
        const seriesIndex =
          row.stackIndex == null
            ? 0
            : anchorPresent
              ? row.stackIndex + 1
              : row.stackIndex;
        const disabledKinds = (["price", "indicator", "trend", "webhook"] as const).filter(
          (kind) =>
            kind !== draft.trigger &&
            (row.role === "anchor" && row.stackIndex == null
              ? anchorDisabledKinds(leadAnchor, flatRows, webhookIds).includes(kind)
              : entryKindDisabled({
                  slots,
                  index: seriesIndex,
                  kind,
                  webhookIds,
                })),
        );
        const fieldPrefix =
          row.stackIndex == null ? prefix : `${prefix}Stack${row.stackIndex}`;
        return (
          <div key={row.rowKey ?? `${clause.key}-anchor`} className="space-y-3">
            {rowIndex > 0 ? <JoinWord label="And" /> : null}
            {named && row.stackIndex != null ? (
              <input
                type="hidden"
                name={`${prefix}Stack${row.stackIndex}Join`}
                value={rowIndex === 0 ? "or" : "and"}
              />
            ) : null}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
              <div className="min-w-0">
                <HardExitFields
                  lead={false}
                  prefix={fieldPrefix}
                  side={side}
                  value={draft}
                  onChange={(next) => {
                    if (row.role === "anchor") {
                      onAnchor(next);
                      return;
                    }
                    if (row.rowKey) {
                      onRow(row.rowKey, next);
                    }
                  }}
                  webhooks={webhooks}
                  gridClass={gridClass}
                  fieldClass={fieldClass}
                  labelClass={labelClass}
                  named={named}
                  seriesSlots={slots}
                  seriesIndex={seriesIndex}
                  disabledKinds={[...disabledKinds] as HardExitTrigger[]}
                  disabledWebhookIds={
                    row.role === "anchor" && row.stackIndex == null
                      ? anchorDisabledWebhookIds(leadAnchor, flatRows, webhookIds)
                      : webhookIds.filter((id) =>
                          entryWebhookIdDisabled({
                            slots,
                            index: seriesIndex,
                            webhookId: id,
                          }),
                        )
                  }
                />
              </div>
              <div className="shrink-0">
                <RemoveConditionButton
                  scope="condition"
                  onClick={() => onRemove(row)}
                />
              </div>
            </div>
          </div>
        );
      })}
      {canAdd ? <AddConditionButton onClick={onAdd} /> : null}
    </section>
  );
}
