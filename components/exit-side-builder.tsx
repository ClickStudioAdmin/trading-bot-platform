"use client";

import type { ReactNode } from "react";
import { AppSelect } from "@/components/app-select";
import {
  HintLabel,
  botFieldInvalidClass,
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
import {
  hardExitForTrigger,
  type HardExitDraft,
  type HardExitTrigger,
} from "@/lib/dca/hard-exit";
import type { FuturesSide } from "@/lib/futures/model";
import {
  customConditionCount,
  customExitClause,
  emptyExitClause,
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
  showErrors = false,
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
  /** Paint empty required controls after the form has been edited. */
  showErrors?: boolean;
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
  const canAddGroup =
    clauses.length < STRATEGY_CONDITION_CAP &&
    (classicUsed.size < 3 || customCount < STRATEGY_CONDITION_CAP);
  const leadAnchor = anchor ?? { trigger: "unset" as const };

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
        rows: [],
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
          current.kind === "custom" ? current.rows : [],
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
    const added = clause.kind === "custom" ? 1 : 2;
    if (isClassicExitKind(clause.kind) || customCount + added > STRATEGY_CONDITION_CAP) {
      return;
    }
    const row = { key: rowKey(), join: "and" as const, draft: { trigger: "unset" as const } };
    if (clause.kind !== "custom") {
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
  function seriesIndexFor(
    row: PlacedCustom | null,
    lead: HardExitDraft | null,
  ): number {
    if (!row || row.stackIndex == null) {
      return 0;
    }
    return hardExitAnchor(lead) ? row.stackIndex + 1 : row.stackIndex;
  }
  function disabledTriggers(
    row: PlacedCustom,
    draft: HardExitDraft,
    seriesIndex: number,
  ): HardExitTrigger[] {
    return (["price", "indicator", "trend", "webhook"] as const).filter(
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
  }

  const stackCount = placed.filter((row) => row.stackIndex != null).length;
  const exitStarted = clauses.some((clause) => clause.kind !== "");

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
        const anchorSeries = seriesIndexFor(anchorRow ?? null, anchor);
        const advancedDisabled = advancedFull
          ? (["price", "indicator", "trend", "webhook"] as const)
          : anchorRow
            ? disabledTriggers(anchorRow, clause.anchor, anchorSeries)
            : [];
        const rowAdded = clause.kind === "custom" ? 1 : 2;
        const canAddRow =
          !isClassicExitKind(clause.kind) &&
          customCount + rowAdded <= STRATEGY_CONDITION_CAP;
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
                  <HintLabel text="Condition Type" />
                  <AppSelect
                    value={clauseSelectValue(clause)}
                    onChange={(event) => setChoice(clause, event.target.value)}
                    className={
                      showErrors && clause.kind === "" && exitStarted
                        ? conditionFieldClass(botFieldInvalidClass, column)
                        : conditionFieldClass(fieldClass, column)
                    }
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
                    showErrors={showErrors}
                    seriesSlots={slots}
                    seriesIndex={anchorSeries}
                    disabledWebhookIds={
                      anchorRow?.stackIndex == null
                        ? anchorDisabledWebhookIds(leadAnchor, flatRows, webhookIds)
                        : webhookIds.filter((id) =>
                            entryWebhookIdDisabled({
                              slots,
                              index: anchorSeries,
                              webhookId: id,
                            }),
                          )
                    }
                  />
                </div>
              ) : null}
              {placed
                .filter((row) => row.clauseKey === clause.key && row.role === "row")
                .map((row) => {
                  const draft =
                    clause.rows.find((item) => item.key === row.rowKey)?.draft ?? {
                      trigger: "unset" as const,
                    };
                  const seriesIndex = seriesIndexFor(row, anchor);
                  const fieldPrefix =
                    row.stackIndex == null ? prefix : `${prefix}Stack${row.stackIndex}`;
                  return (
                    <div key={row.rowKey ?? row.clauseKey} className="space-y-3">
                      <JoinWord label="And" />
                      {named && row.stackIndex != null ? (
                        <input
                          type="hidden"
                          name={`${prefix}Stack${row.stackIndex}Join`}
                          value="and"
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
                              if (!row.rowKey) {
                                return;
                              }
                              patch(clause.key, (current) => ({
                                ...current,
                                rows: current.rows.map((item) =>
                                  item.key === row.rowKey ? { ...item, draft: next } : item,
                                ),
                              }));
                            }}
                            webhooks={webhooks}
                            gridClass={gridClass}
                            fieldClass={fieldClass}
                            labelClass={labelClass}
                            named={named}
                            showErrors={showErrors}
                            seriesSlots={slots}
                            seriesIndex={seriesIndex}
                            disabledKinds={disabledTriggers(row, draft, seriesIndex)}
                            disabledWebhookIds={webhookIds.filter((id) =>
                              entryWebhookIdDisabled({
                                slots,
                                index: seriesIndex,
                                webhookId: id,
                              }),
                            )}
                          />
                        </div>
                        <RemoveConditionButton
                          scope="condition"
                          onClick={() => {
                            if (row.rowKey) {
                              removeCustomRow(clause, row.rowKey);
                            }
                          }}
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
