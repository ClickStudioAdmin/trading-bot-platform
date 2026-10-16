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
import { HardExitFields } from "@/components/hard-exit-fields";
import {
  hardExitForTrigger,
  type HardExitTrigger,
} from "@/lib/dca/hard-exit";
import type { FuturesSide } from "@/lib/futures/model";
import {
  customConditionCount,
  customExitClause,
  emptyExitClause,
  exitConflictModel,
  exitLeadKindDisabled,
  isClassicExitKind,
  type ClassicExitKind,
  type ExitBuilderClause,
} from "@/lib/strategy/exit-clauses";
import {
  entryKindDisabled,
  entryWebhookIdDisabled,
  STRATEGY_CONDITION_CAP,
} from "@/lib/strategy/expr";

const COMMON_OPTIONS: { value: ClassicExitKind; label: string }[] = [
  { value: "take_profit", label: "Take Profit" },
  { value: "trailing_stop", label: "Trailing Stop" },
  { value: "stop_loss", label: "Stop Loss" },
];

const ADVANCED_OPTIONS: { value: HardExitTrigger; label: string }[] = [
  { value: "indicator", label: "Indicator" },
  { value: "trend", label: "Trend" },
  { value: "price", label: "Price Cross" },
  { value: "webhook", label: "Signal Webhook" },
];

function isAdvancedTrigger(value: string): value is HardExitTrigger {
  return (
    value === "indicator" ||
    value === "trend" ||
    value === "price" ||
    value === "webhook"
  );
}

function clauseSelectValue(clause: ExitBuilderClause): string {
  if (isClassicExitKind(clause.kind)) {
    return clause.kind;
  }
  if (clause.kind === "custom" && clause.anchor.trigger !== "unset") {
    return clause.anchor.trigger;
  }
  return "";
}

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
  const placed = placeCustom(clauses);
  const webhookIds = webhooks.map((hook) => hook.id);
  const conflicts = exitConflictModel(clauses);
  const customCount = customConditionCount(clauses);
  const classicUsed = new Set(
    clauses.filter((clause) => isClassicExitKind(clause.kind)).map((clause) => clause.kind),
  );
  const canAddGroup =
    clauses.length < STRATEGY_CONDITION_CAP &&
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
  function setChoice(clause: ExitBuilderClause, value: string) {
    if (
      value === "take_profit" ||
      value === "trailing_stop" ||
      value === "stop_loss"
    ) {
      patch(clause.key, (current) => ({
        ...current,
        kind: value,
        anchor: { trigger: "unset" },
        rows: current.rows,
      }));
      return;
    }
    if (isAdvancedTrigger(value)) {
      patch(clause.key, (current) =>
        customExitClause(
          hardExitForTrigger(
            value,
            side,
            current.kind === "custom" ? current.anchor : null,
          ),
          current.rows,
          current.key,
        ),
      );
      return;
    }
    patch(clause.key, (current) => ({
      ...current,
      kind: "",
      anchor: { trigger: "unset" },
      rows: [],
    }));
  }
  function addGroup() {
    if (!canAddGroup) {
      return;
    }
    commit([...clauses, emptyExitClause()]);
  }
  function addCustomRow(clause: ExitBuilderClause) {
    const added = clause.kind === "" ? 2 : 1;
    if (customCount + added > STRATEGY_CONDITION_CAP) {
      return;
    }
    const row = { key: rowKey(), join: "and" as const, draft: { trigger: "unset" as const } };
    if (clause.kind === "") {
      patch(clause.key, (current) => customExitClause({ trigger: "unset" }, [row], current.key));
      return;
    }
    patch(clause.key, (current) => ({
      ...current,
      rows: [...current.rows, row],
    }));
  }
  function removeCustomRow(clause: ExitBuilderClause, rowKeyValue: string) {
    patch(clause.key, (current) => ({
      ...current,
      rows: current.rows.filter((row) => row.key !== rowKeyValue),
    }));
  }
  function disabledKinds(
    seriesIndex: number,
    selected: HardExitTrigger | "unset",
  ): HardExitTrigger[] {
    return (["price", "indicator", "trend", "webhook"] as const).filter(
      (kind) =>
        kind !== selected &&
        entryKindDisabled({
          slots: conflicts.slots,
          index: seriesIndex,
          kind,
          webhookIds,
        }),
    );
  }
  function disabledWebhookIds(seriesIndex: number): string[] {
    return webhookIds.filter((id) =>
      entryWebhookIdDisabled({
        slots: conflicts.slots,
        index: seriesIndex,
        webhookId: id,
      }),
    );
  }

  const stackCount = placed.filter((row) => row.stackIndex != null).length;

  return (
    <div className="space-y-3">
      {named && custom.length > 0 ? (
        <input type="hidden" name={`${prefix}StackCount`} value={String(stackCount)} />
      ) : null}
      {clauses.map((clause, index) => {
        const advancedFull = clause.kind !== "custom" && customCount >= STRATEGY_CONDITION_CAP;
        const anchorRow = placed.find(
          (row) => row.clauseKey === clause.key && row.role === "anchor",
        );
        const anchorSeries = conflicts.anchorIndex[clause.key] ?? 0;
        const advancedDisabled = advancedFull
          ? (["price", "indicator", "trend", "webhook"] as const)
          : (["price", "indicator", "trend", "webhook"] as const).filter(
              (kind) =>
                kind !== clause.anchor.trigger &&
                exitLeadKindDisabled({
                  model: conflicts,
                  clauseKey: clause.key,
                  kind,
                  webhookIds,
                }),
            );
        const rowAdded = clause.kind === "" ? 2 : 1;
        const canAddRow = customCount + rowAdded <= STRATEGY_CONDITION_CAP;
        const anchorPrefix =
          anchorRow?.stackIndex == null ? prefix : `${prefix}Stack${anchorRow.stackIndex}`;
        return (
          <div key={clause.key} className="space-y-3">
            {index > 0 ? <JoinWord label="Or" /> : null}
            <section className="space-y-4 rounded-card border border-line bg-canvas px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-sm font-semibold text-ink">
                  Group {index + 1}
                  <span className="ml-2 text-hint font-normal text-ink-muted">
                    - Every condition in this group must be true.
                  </span>
                </h3>
                {clauses.length > 1 ? (
                  <RemoveConditionButton
                    scope="group"
                    onClick={() => removeClause(clause.key)}
                  />
                ) : null}
              </div>
              <div className={gridClass}>
                <label className={`${labelClass} whitespace-nowrap`}>
                  <HintLabel text="Condition Type" required />
                  <AppSelect
                    value={clauseSelectValue(clause)}
                    onChange={(event) => setChoice(clause, event.target.value)}
                    className={conditionFieldClass(fieldClass, column)}
                  >
                    <option value="">Select Condition Type</option>
                    <optgroup label="Common">
                      {COMMON_OPTIONS.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          disabled={
                            option.value !== clause.kind && classicUsed.has(option.value)
                          }
                        >
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Advanced">
                      {ADVANCED_OPTIONS.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                          disabled={
                            option.value !== clause.anchor.trigger &&
                            advancedDisabled.includes(option.value)
                          }
                        >
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  </AppSelect>
                </label>
              </div>
              {clause.kind === "take_profit" ? renderTakeProfit() : null}
              {clause.kind === "trailing_stop" ? renderTrailingStop() : null}
              {clause.kind === "stop_loss" ? renderStopLoss() : null}
              {clause.kind === "custom" && clause.anchor.trigger !== "unset" ? (
                <div className="space-y-3">
                  {named && anchorRow?.stackIndex != null ? (
                    <input
                      type="hidden"
                      name={`${prefix}Stack${anchorRow.stackIndex}Join`}
                      value="or"
                    />
                  ) : null}
                  <HardExitFields
                    showTrigger={false}
                    lead={false}
                    prefix={anchorPrefix}
                    side={side}
                    value={clause.anchor}
                    onChange={(draft) =>
                      patch(clause.key, (current) => ({ ...current, anchor: draft }))
                    }
                    webhooks={webhooks}
                    gridClass={gridClass}
                    fieldClass={fieldClass}
                    labelClass={labelClass}
                    named={named}
                    seriesSlots={conflicts.slots}
                    seriesIndex={anchorSeries}
                    disabledWebhookIds={disabledWebhookIds(anchorSeries)}
                  />
                </div>
              ) : null}
              {clause.rows.map((row) => {
                  const placedRow = placed.find(
                    (item) => item.clauseKey === clause.key && item.rowKey === row.key,
                  );
                  const seriesIndex = conflicts.rowIndex[row.key] ?? 0;
                  const postRow = named && clause.kind === "custom";
                  const fieldPrefix =
                    postRow && placedRow?.stackIndex != null
                      ? `${prefix}Stack${placedRow.stackIndex}`
                      : prefix;
                  return (
                    <div key={row.key} className="space-y-3">
                      <JoinWord label="And" />
                      {postRow && placedRow?.stackIndex != null ? (
                        <input
                          type="hidden"
                          name={`${prefix}Stack${placedRow.stackIndex}Join`}
                          value="and"
                        />
                      ) : null}
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
                        <div className="min-w-0">
                          <HardExitFields
                            lead={false}
                            prefix={fieldPrefix}
                            side={side}
                            value={row.draft}
                            onChange={(next) => {
                              patch(clause.key, (current) => ({
                                ...current,
                                rows: current.rows.map((item) =>
                                  item.key === row.key ? { ...item, draft: next } : item,
                                ),
                              }));
                            }}
                            webhooks={webhooks}
                            gridClass={gridClass}
                            fieldClass={fieldClass}
                            labelClass={labelClass}
                            named={postRow}
                            seriesSlots={conflicts.slots}
                            seriesIndex={seriesIndex}
                            disabledKinds={disabledKinds(seriesIndex, row.draft.trigger)}
                            disabledWebhookIds={disabledWebhookIds(seriesIndex)}
                          />
                        </div>
                        <RemoveConditionButton
                          scope="condition"
                          onClick={() => removeCustomRow(clause, row.key)}
                        />
                      </div>
                    </div>
                  );
                })}
              {canAddRow ? (
                <AddConditionButton onClick={() => addCustomRow(clause)} />
              ) : null}
            </section>
          </div>
        );
      })}
      {canAddGroup ? (
        <AddConditionButton label="Add Condition Group" onClick={addGroup} />
      ) : null}
    </div>
  );
}
