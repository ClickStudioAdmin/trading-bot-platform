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
  clauseOrGroups,
  clauseScope,
  customExitClause,
  emptyExitClause,
  isClassicExitKind,
  type ClassicExitKind,
  type ExitBuilderClause,
  type ExitOrGroup,
  type ExitScope,
} from "@/lib/strategy/exit-clauses";
import {
  EMPTY_EXIT_PRICES,
  actionKindLabel,
  exitActionsForSave,
  type ExitSidePrices,
} from "@/lib/strategy/exit-actions";
import {
  entryKindDisabled,
  entryWebhookIdDisabled,
  STRATEGY_CONDITION_CAP,
} from "@/lib/strategy/expr";

const ACTION_OPTIONS: { value: ClassicExitKind | "close"; label: string }[] = [
  { value: "take_profit", label: "Take Profit" },
  { value: "trailing_stop", label: "Trailing Stop" },
  { value: "stop_loss", label: "Stop Loss" },
  { value: "close", label: "Close" },
];

const CONDITION_OPTIONS: { value: HardExitTrigger; label: string }[] = [
  { value: "indicator", label: "Indicator" },
  { value: "trend", label: "Trend" },
  { value: "price", label: "Price Cross" },
  { value: "webhook", label: "Signal Webhook" },
];

function isConditionTrigger(value: string): value is HardExitTrigger {
  return (
    value === "indicator" ||
    value === "trend" ||
    value === "price" ||
    value === "webhook"
  );
}

function actionValue(clause: ExitBuilderClause): string {
  if (isClassicExitKind(clause.kind)) {
    return clause.kind;
  }
  if (clause.kind === "custom") {
    return "close";
  }
  return "";
}

function rowKey(): string {
  return `exit-${Math.random().toString(36).slice(2, 10)}`;
}

function conditionCount(clause: ExitBuilderClause): number {
  const lead = clause.anchor.trigger === "unset" ? 0 : 1;
  const extra = clauseOrGroups(clause).reduce(
    (sum, group) => sum + (group.anchor.trigger === "unset" ? 0 : 1) + group.rows.length,
    0,
  );
  return lead + clause.rows.length + extra;
}

function flatRows(clause: ExitBuilderClause): ExitStackRow[] {
  const rows: ExitStackRow[] = clause.rows.map((row) => ({
    ...row,
    join: "and",
  }));
  for (const group of clauseOrGroups(clause)) {
    rows.push({ key: group.key, join: "or", draft: group.anchor });
    for (const row of group.rows) {
      rows.push({ ...row, join: "and" });
    }
  }
  return rows;
}

type Placed = {
  role: "anchor" | "row" | "or-anchor";
  rowKey: string | null;
  groupKey: string | null;
  stackIndex: number | null;
};

function placeFirstClose(clause: ExitBuilderClause): Placed[] {
  const placed: Placed[] = [
    { role: "anchor", rowKey: null, groupKey: null, stackIndex: null },
  ];
  let stack = 0;
  for (const row of clause.rows) {
    placed.push({
      role: "row",
      rowKey: row.key,
      groupKey: null,
      stackIndex: stack++,
    });
  }
  for (const group of clauseOrGroups(clause)) {
    placed.push({
      role: "or-anchor",
      rowKey: null,
      groupKey: group.key,
      stackIndex: stack++,
    });
    for (const row of group.rows) {
      placed.push({
        role: "row",
        rowKey: row.key,
        groupKey: group.key,
        stackIndex: stack++,
      });
    }
  }
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
  actionName,
  prices = EMPTY_EXIT_PRICES,
}: {
  clauses: ExitBuilderClause[];
  onChange: (next: ExitBuilderClause[]) => void;
  side: FuturesSide;
  /** Form prefix for the first Close stack. `exitIf` or `short_exitIf`. */
  prefix: string;
  named?: boolean;
  webhooks?: { id: string; name: string }[];
  fieldClass: string;
  labelClass: string;
  gridClass: string;
  renderTakeProfit: () => ReactNode;
  renderTrailingStop: () => ReactNode;
  renderStopLoss: () => ReactNode;
  showErrors?: boolean;
  /** Posts the action list. Empty when the side still uses the classic columns. */
  actionName?: string;
  prices?: ExitSidePrices;
}) {
  const column = useBotColumnLayout();
  const webhookIds = webhooks.map((hook) => hook.id);
  const firstClose = clauses.find((clause) => clause.kind === "custom");
  const closePlaced = firstClose ? placeFirstClose(firstClose) : [];
  const stackCount = closePlaced.filter((row) => row.stackIndex != null).length;
  const savedActions = exitActionsForSave(clauses, prices);
  const remainderUsed = clauses.some(
    (clause) => clause.kind !== "" && clauseScope(clause).kind === "remainder",
  );

  function commit(next: ExitBuilderClause[]) {
    onChange(next.length > 0 ? next : [emptyExitClause()]);
  }
  function patch(key: string, update: (clause: ExitBuilderClause) => ExitBuilderClause) {
    commit(clauses.map((clause) => (clause.key === key ? update(clause) : clause)));
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
        anchor: current.kind === "custom" ? { trigger: "unset" } : current.anchor,
        rows: current.kind === "custom" ? [] : current.rows,
        orGroups: current.kind === "custom" ? [] : current.orGroups,
      }));
      return;
    }
    if (value === "close") {
      patch(clause.key, (current) =>
        current.kind === "custom"
          ? current
          : {
              ...customExitClause(
                current.anchor.trigger === "unset" ? { trigger: "unset" } : current.anchor,
                current.rows,
                current.key,
              ),
              scope: current.scope,
              orGroups: current.orGroups,
            },
      );
      return;
    }
    patch(clause.key, (current) => ({ ...emptyExitClause(), key: current.key }));
  }
  function setAnchor(clause: ExitBuilderClause, value: string) {
    if (!isConditionTrigger(value)) {
      patch(clause.key, (current) => ({
        ...current,
        anchor: { trigger: "unset" },
        rows: [],
        orGroups: [],
      }));
      return;
    }
    patch(clause.key, (current) => ({
      ...current,
      anchor: hardExitForTrigger(
        value,
        side,
        current.anchor.trigger === value ? current.anchor : null,
      ),
    }));
  }
  function addRow(clause: ExitBuilderClause) {
    if (conditionCount(clause) >= STRATEGY_CONDITION_CAP || clause.anchor.trigger === "unset") {
      return;
    }
    patch(clause.key, (current) => ({
      ...current,
      rows: [
        ...current.rows,
        { key: rowKey(), join: "and" as const, draft: { trigger: "unset" } },
      ],
    }));
  }
  function addOrGroup(clause: ExitBuilderClause) {
    if (conditionCount(clause) >= STRATEGY_CONDITION_CAP || clause.anchor.trigger === "unset") {
      return;
    }
    const group: ExitOrGroup = {
      key: rowKey(),
      anchor: { trigger: "unset" },
      rows: [],
    };
    patch(clause.key, (current) => ({
      ...current,
      orGroups: [...clauseOrGroups(current), group],
    }));
  }
  function setScope(clause: ExitBuilderClause, kind: ExitScope["kind"]) {
    const next: ExitScope =
      kind === "percent"
        ? { kind, pct: null }
        : kind === "qty"
          ? { kind, qty: null }
          : kind === "fills"
            ? { kind, minProfitPct: null }
            : { kind };
    patch(clause.key, (current) => ({ ...current, scope: next }));
  }

  const kindCounts = new Map<string, number>();

  return (
    <div className="space-y-3">
      {actionName ? (
        <input
          type="hidden"
          name={actionName}
          value={savedActions ? JSON.stringify(savedActions) : ""}
        />
      ) : null}
      {named && firstClose ? (
        <input type="hidden" name={`${prefix}StackCount`} value={String(stackCount)} />
      ) : null}
      {clauses.map((clause) => {
        const seen = (kindCounts.get(clause.kind) ?? 0) + (clause.kind === "" ? 0 : 1);
        if (clause.kind !== "") {
          kindCounts.set(clause.kind, seen);
        }
        const firstOfKind = seen <= 1;
        const postsClose = named && firstClose?.key === clause.key;
        const placed = postsClose ? closePlaced : [];
        const rows = flatRows(clause);
        const slots = exitConflictSlots(clause.anchor, rows);
        const lead = clause.anchor;
        const count = conditionCount(clause);
        const canAddRow =
          clause.anchor.trigger !== "unset" && count < STRATEGY_CONDITION_CAP;
        const scope = clauseScope(clause);
        const scopeInvalid =
          showErrors &&
          ((scope.kind === "percent" && !(scope.pct != null && scope.pct > 0 && scope.pct < 100)) ||
            (scope.kind === "qty" && !(scope.qty != null && scope.qty > 0)) ||
            (scope.kind === "fills" &&
              !(scope.minProfitPct != null && scope.minProfitPct > 0)));
        const ownInvalid =
          showErrors &&
          !firstOfKind &&
          ((clause.kind === "trailing_stop" && !(clause.ownDistance != null && clause.ownDistance > 0)) ||
            ((clause.kind === "take_profit" || clause.kind === "stop_loss") &&
              !(clause.ownPct != null && clause.ownPct > 0)));
        return (
          <div key={clause.key} className="space-y-3">
            <section className="condition-group space-y-4 rounded-card border border-line bg-canvas px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-sm font-semibold text-ink">
                  {clause.kind === "" ? "Action" : actionKindLabel(clause.kind)}
                  <span className="ml-2 text-hint font-normal text-ink-muted">
                    {clause.kind === "custom"
                      ? "- Fires when its conditions are true."
                      : "- Turns on when its conditions are true."}
                  </span>
                </h3>
                {clauses.length > 1 ? (
                  <RemoveConditionButton
                    scope="group"
                    onClick={() => commit(clauses.filter((item) => item.key !== clause.key))}
                  />
                ) : null}
              </div>
              <div className={gridClass}>
                <label className={`${labelClass} whitespace-nowrap`}>
                  <HintLabel text="Action" />
                  <AppSelect
                    value={actionValue(clause)}
                    onChange={(event) => setChoice(clause, event.target.value)}
                    className={
                      showErrors && clause.kind === "" && clauses.some((item) => item.kind !== "")
                        ? conditionFieldClass(botFieldInvalidClass, column)
                        : conditionFieldClass(fieldClass, column)
                    }
                  >
                    <option value="">Select Action</option>
                    {ACTION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </AppSelect>
                </label>
                {clause.kind !== "" ? (
                  <label className={labelClass}>
                    <HintLabel text="Responsibility" />
                    <AppSelect
                      value={scope.kind}
                      onChange={(event) =>
                        setScope(clause, event.target.value as ExitScope["kind"])
                      }
                      className={conditionFieldClass(fieldClass, column)}
                    >
                      <option value="all">All</option>
                      <option value="percent">Percent of open size</option>
                      <option value="qty">Quantity</option>
                      <option value="fills">Fills in profit</option>
                      <option value="remainder" disabled={remainderUsed && scope.kind !== "remainder"}>
                        Remainder
                      </option>
                    </AppSelect>
                  </label>
                ) : null}
                {scope.kind === "percent" || scope.kind === "qty" || scope.kind === "fills" ? (
                  <label className={labelClass}>
                    <HintLabel
                      text={
                        scope.kind === "percent"
                          ? "Percent"
                          : scope.kind === "qty"
                            ? "Quantity"
                            : "Profit %"
                      }
                    />
                    <input
                      value={
                        scope.kind === "percent"
                          ? scope.pct ?? ""
                          : scope.kind === "qty"
                            ? scope.qty ?? ""
                            : scope.minProfitPct ?? ""
                      }
                      onChange={(event) => {
                        const raw = event.target.value.replace(/,/g, "").trim();
                        const number = raw === "" ? null : Number(raw);
                        const next = number != null && Number.isFinite(number) ? number : null;
                        patch(clause.key, (current) => ({
                          ...current,
                          scope:
                            scope.kind === "percent"
                              ? { kind: "percent", pct: next }
                              : scope.kind === "qty"
                                ? { kind: "qty", qty: next }
                                : { kind: "fills", minProfitPct: next },
                        }));
                      }}
                      inputMode="decimal"
                      className={scopeInvalid ? botFieldInvalidClass : fieldClass}
                    />
                  </label>
                ) : null}
              </div>
              {clause.kind === "take_profit" && firstOfKind ? renderTakeProfit() : null}
              {clause.kind === "trailing_stop" && firstOfKind ? renderTrailingStop() : null}
              {clause.kind === "stop_loss" && firstOfKind ? renderStopLoss() : null}
              {!firstOfKind &&
              (clause.kind === "take_profit" ||
                clause.kind === "stop_loss" ||
                clause.kind === "trailing_stop") ? (
                <label className={labelClass}>
                  <HintLabel
                    text={clause.kind === "trailing_stop" ? "Distance" : "Target %"}
                  />
                  <input
                    value={
                      clause.kind === "trailing_stop"
                        ? clause.ownDistance ?? ""
                        : clause.ownPct ?? ""
                    }
                    onChange={(event) => {
                      const raw = event.target.value.replace(/,/g, "").trim();
                      const number = raw === "" ? null : Number(raw);
                      const next = number != null && Number.isFinite(number) ? number : null;
                      patch(clause.key, (current) =>
                        current.kind === "trailing_stop"
                          ? { ...current, ownDistance: next }
                          : { ...current, ownPct: next },
                      );
                    }}
                    inputMode="decimal"
                    className={ownInvalid ? botFieldInvalidClass : fieldClass}
                  />
                </label>
              ) : null}
              {clause.kind !== "" ? (
                <div className="space-y-3 border-t border-line pt-4">
                  <ConditionStack
                    clause={clause}
                    side={side}
                    prefix={prefix}
                    named={postsClose}
                    placed={placed}
                    slots={slots}
                    lead={lead}
                    rows={rows}
                    webhookIds={webhookIds}
                    webhooks={webhooks}
                    gridClass={gridClass}
                    fieldClass={fieldClass}
                    labelClass={labelClass}
                    showErrors={showErrors}
                    column={column}
                    onAnchor={(value) => setAnchor(clause, value)}
                    onPatch={(update) => patch(clause.key, update)}
                  />
                  {canAddRow ? (
                    <div className="flex flex-wrap gap-2">
                      <AddConditionButton onClick={() => addRow(clause)} />
                      <AddConditionButton label="Add Condition Group" onClick={() => addOrGroup(clause)} />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        );
      })}
      {clauses.length < STRATEGY_CONDITION_CAP ? (
        <AddConditionButton
          label="Add action"
          onClick={() => commit([...clauses, emptyExitClause()])}
        />
      ) : null}
    </div>
  );
}

function ConditionStack({
  clause,
  side,
  prefix,
  named,
  placed,
  slots,
  lead,
  rows,
  webhookIds,
  webhooks,
  gridClass,
  fieldClass,
  labelClass,
  showErrors,
  column,
  onAnchor,
  onPatch,
}: {
  clause: ExitBuilderClause;
  side: FuturesSide;
  prefix: string;
  named: boolean;
  placed: Placed[];
  slots: ReturnType<typeof exitConflictSlots>;
  lead: HardExitDraft;
  rows: ExitStackRow[];
  webhookIds: string[];
  webhooks: { id: string; name: string }[];
  gridClass: string;
  fieldClass: string;
  labelClass: string;
  showErrors: boolean;
  column: boolean;
  onAnchor: (value: string) => void;
  onPatch: (update: (clause: ExitBuilderClause) => ExitBuilderClause) => void;
}) {
  const anchorPlaced = placed.find((row) => row.role === "anchor") ?? null;
  const seriesIndex = 0;
  const disabled = (["price", "indicator", "trend", "webhook"] as const).filter(
    (kind) =>
      kind !== clause.anchor.trigger &&
      anchorDisabledKinds(lead, rows, webhookIds).includes(kind),
  );
  const label = clause.kind === "custom" ? "Condition Type" : "Enable when";
  return (
    <div className="space-y-3">
      <div className={gridClass}>
        <label className={`${labelClass} whitespace-nowrap`}>
          <HintLabel text={label} />
          <AppSelect
            value={clause.anchor.trigger === "unset" ? "" : clause.anchor.trigger}
            onChange={(event) => onAnchor(event.target.value)}
            className={
              showErrors && clause.kind === "custom" && clause.anchor.trigger === "unset"
                ? conditionFieldClass(botFieldInvalidClass, column)
                : conditionFieldClass(fieldClass, column)
            }
          >
            <option value="">{clause.kind === "custom" ? "Select Condition Type" : "Always on"}</option>
            {CONDITION_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={disabled.includes(option.value)}
              >
                {option.label}
              </option>
            ))}
          </AppSelect>
        </label>
        {clause.anchor.trigger !== "unset" ? (
          <HardExitFields
            embed
            showTrigger={false}
            prefix={named ? prefix : `${prefix}Draft`}
            side={side}
            value={clause.anchor}
            onChange={(draft) => onPatch((current) => ({ ...current, anchor: draft }))}
            webhooks={webhooks}
            gridClass={gridClass}
            fieldClass={fieldClass}
            labelClass={labelClass}
            named={named}
            showErrors={showErrors}
            seriesSlots={slots}
            seriesIndex={seriesIndex}
            disabledWebhookIds={anchorDisabledWebhookIds(lead, rows, webhookIds)}
          />
        ) : null}
      </div>
      {clause.rows.map((row) => (
        <DraftRow
          key={row.key}
          join="And"
          draft={row.draft}
          named={named}
          prefix={prefix}
          stackIndex={placed.find((item) => item.rowKey === row.key)?.stackIndex ?? null}
          side={side}
          slots={slots}
          rows={rows}
          lead={lead}
          webhookIds={webhookIds}
          webhooks={webhooks}
          gridClass={gridClass}
          fieldClass={fieldClass}
          labelClass={labelClass}
          showErrors={showErrors}
          onChange={(draft) =>
            onPatch((current) => ({
              ...current,
              rows: current.rows.map((item) =>
                item.key === row.key ? { ...item, draft } : item,
              ),
            }))
          }
          onRemove={() =>
            onPatch((current) => ({
              ...current,
              rows: current.rows.filter((item) => item.key !== row.key),
            }))
          }
        />
      ))}
      {clauseOrGroups(clause).map((group) => (
        <OrGroup
          key={group.key}
          group={group}
          named={named}
          prefix={prefix}
          placed={placed}
          side={side}
          slots={slots}
          rows={rows}
          lead={lead}
          webhookIds={webhookIds}
          webhooks={webhooks}
          gridClass={gridClass}
          fieldClass={fieldClass}
          labelClass={labelClass}
          showErrors={showErrors}
          column={column}
          onPatch={onPatch}
        />
      ))}
      {anchorPlaced ? null : null}
    </div>
  );
}

function OrGroup(props: {
  group: ExitOrGroup;
  named: boolean;
  prefix: string;
  placed: Placed[];
  side: FuturesSide;
  slots: ReturnType<typeof exitConflictSlots>;
  rows: ExitStackRow[];
  lead: HardExitDraft;
  webhookIds: string[];
  webhooks: { id: string; name: string }[];
  gridClass: string;
  fieldClass: string;
  labelClass: string;
  showErrors: boolean;
  column: boolean;
  onPatch: (update: (clause: ExitBuilderClause) => ExitBuilderClause) => void;
}) {
  const { group, onPatch } = props;
  const stackIndex =
    props.placed.find((item) => item.role === "or-anchor" && item.groupKey === group.key)
      ?.stackIndex ?? null;
  return (
    <div className="space-y-3">
      <JoinWord label="Or" />
      <div className={props.gridClass}>
        <label className={`${props.labelClass} whitespace-nowrap`}>
          <HintLabel text="Condition Type" />
          <AppSelect
            value={group.anchor.trigger === "unset" ? "" : group.anchor.trigger}
            onChange={(event) => {
              const value = event.target.value;
              onPatch((current) => ({
                ...current,
                orGroups: clauseOrGroups(current).map((item) =>
                  item.key === group.key
                    ? {
                        ...item,
                        anchor: isConditionTrigger(value)
                          ? hardExitForTrigger(value, props.side, item.anchor)
                          : { trigger: "unset" },
                      }
                    : item,
                ),
              }));
            }}
            className={
              props.showErrors && group.anchor.trigger === "unset"
                ? conditionFieldClass(botFieldInvalidClass, props.column)
                : conditionFieldClass(props.fieldClass, props.column)
            }
          >
            <option value="">Select Condition Type</option>
            {CONDITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AppSelect>
        </label>
      </div>
      {group.anchor.trigger !== "unset" ? (
        <DraftFields
          draft={group.anchor}
          named={props.named}
          prefix={props.prefix}
          stackIndex={stackIndex}
          join="or"
          side={props.side}
          slots={props.slots}
          lead={props.lead}
          webhookIds={props.webhookIds}
          webhooks={props.webhooks}
          gridClass={props.gridClass}
          fieldClass={props.fieldClass}
          labelClass={props.labelClass}
          showErrors={props.showErrors}
          showTrigger={false}
          onChange={(draft) =>
            onPatch((current) => ({
              ...current,
              orGroups: clauseOrGroups(current).map((item) =>
                item.key === group.key ? { ...item, anchor: draft } : item,
              ),
            }))
          }
        />
      ) : null}
      {group.rows.map((row) => (
        <DraftRow
          key={row.key}
          join="And"
          draft={row.draft}
          named={props.named}
          prefix={props.prefix}
          stackIndex={props.placed.find((item) => item.rowKey === row.key)?.stackIndex ?? null}
          side={props.side}
          slots={props.slots}
          rows={props.rows}
          lead={props.lead}
          webhookIds={props.webhookIds}
          webhooks={props.webhooks}
          gridClass={props.gridClass}
          fieldClass={props.fieldClass}
          labelClass={props.labelClass}
          showErrors={props.showErrors}
          onChange={(draft) =>
            onPatch((current) => ({
              ...current,
              orGroups: clauseOrGroups(current).map((item) =>
                item.key === group.key
                  ? {
                      ...item,
                      rows: item.rows.map((leaf) =>
                        leaf.key === row.key ? { ...leaf, draft } : leaf,
                      ),
                    }
                  : item,
              ),
            }))
          }
          onRemove={() =>
            onPatch((current) => ({
              ...current,
              orGroups: clauseOrGroups(current).map((item) =>
                item.key === group.key
                  ? { ...item, rows: item.rows.filter((leaf) => leaf.key !== row.key) }
                  : item,
              ),
            }))
          }
        />
      ))}
    </div>
  );
}

function DraftRow(props: {
  join: "And" | "Or";
  draft: HardExitDraft;
  named: boolean;
  prefix: string;
  stackIndex: number | null;
  side: FuturesSide;
  slots: ReturnType<typeof exitConflictSlots>;
  rows: ExitStackRow[];
  lead: HardExitDraft;
  webhookIds: string[];
  webhooks: { id: string; name: string }[];
  gridClass: string;
  fieldClass: string;
  labelClass: string;
  showErrors: boolean;
  onChange: (draft: HardExitDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3">
      <JoinWord label={props.join} />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
        <div className="min-w-0">
          <DraftFields
            draft={props.draft}
            named={props.named}
            prefix={props.prefix}
            stackIndex={props.stackIndex}
            join={props.join === "Or" ? "or" : "and"}
            side={props.side}
            slots={props.slots}
            lead={props.lead}
            webhookIds={props.webhookIds}
            webhooks={props.webhooks}
            gridClass={props.gridClass}
            fieldClass={props.fieldClass}
            labelClass={props.labelClass}
            showErrors={props.showErrors}
            showTrigger
            onChange={props.onChange}
          />
        </div>
        <RemoveConditionButton scope="condition" onClick={props.onRemove} />
      </div>
    </div>
  );
}

function DraftFields({
  draft,
  named,
  prefix,
  stackIndex,
  join,
  side,
  slots,
  lead,
  webhookIds,
  webhooks,
  gridClass,
  fieldClass,
  labelClass,
  showErrors,
  showTrigger,
  onChange,
}: {
  draft: HardExitDraft;
  named: boolean;
  prefix: string;
  stackIndex: number | null;
  join?: "and" | "or";
  side: FuturesSide;
  slots: ReturnType<typeof exitConflictSlots>;
  lead: HardExitDraft;
  webhookIds: string[];
  webhooks: { id: string; name: string }[];
  gridClass: string;
  fieldClass: string;
  labelClass: string;
  showErrors: boolean;
  showTrigger: boolean;
  onChange: (draft: HardExitDraft) => void;
}) {
  const fieldPrefix = stackIndex == null ? prefix : `${prefix}Stack${stackIndex}`;
  const seriesIndex = hardExitAnchor(lead) && stackIndex != null ? stackIndex + 1 : stackIndex ?? 0;
  const disabledKinds = (["price", "indicator", "trend", "webhook"] as const).filter((kind) =>
    entryKindDisabled({ slots, index: seriesIndex, kind, webhookIds }),
  );
  return (
    <div className="space-y-3">
      {named && stackIndex != null && join ? (
        <input type="hidden" name={`${prefix}Stack${stackIndex}Join`} value={join} />
      ) : null}
      <HardExitFields
        showTrigger={showTrigger}
        prefix={named ? fieldPrefix : `${prefix}Draft`}
        side={side}
        value={draft}
        onChange={onChange}
        webhooks={webhooks}
        gridClass={gridClass}
        fieldClass={fieldClass}
        labelClass={labelClass}
        named={named}
        showErrors={showErrors}
        seriesSlots={slots}
        seriesIndex={seriesIndex}
        disabledKinds={showTrigger ? disabledKinds : undefined}
        disabledWebhookIds={webhookIds.filter((id) =>
          entryWebhookIdDisabled({ slots, index: seriesIndex, webhookId: id }),
        )}
      />
    </div>
  );
}
