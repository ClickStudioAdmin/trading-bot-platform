"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { AppSelect } from "@/components/app-select";
import {
  BotColumnLayout,
  HintLabel,
  botFieldInvalidClass,
} from "@/components/bot-form-chrome";
import {
  AddConditionButton,
  JoinWord,
  RemoveConditionButton,
} from "@/components/condition-group";
import { CONDITION_GROUP_HELPER } from "@/components/condition-join";
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
  isExitPriceRule,
  type ExitPriceRuleTrigger,
  type HardExitDraft,
  type HardExitTrigger,
} from "@/lib/dca/hard-exit";
import type { FuturesSide } from "@/lib/futures/model";
import {
  clauseOrGroups,
  clauseReference,
  clauseScope,
  customExitClause,
  emptyExitClause,
  isClassicExitKind,
  normalizeExitClause,
  seedRepeatLevels,
  priceRuleForKind,
  type ClassicExitKind,
  type ExitBuilderClause,
  type ExitFieldSlot,
  type ExitOrGroup,
  type ExitPriceStyle,
  type ExitScope,
} from "@/lib/strategy/exit-clauses";
import {
  EMPTY_EXIT_PRICES,
  exitActionsForSave,
  type ExitSidePrices,
} from "@/lib/strategy/exit-actions";
import {
  entryKindDisabled,
  entryWebhookIdDisabled,
  STRATEGY_CONDITION_CAP,
} from "@/lib/strategy/expr";

const ACTION_OPTIONS: { value: ClassicExitKind | "breakeven" | "close"; label: string }[] = [
  { value: "take_profit", label: "Take Profit" },
  { value: "stop_loss", label: "Stop Loss" },
  { value: "breakeven", label: "Breakeven Stop" },
  { value: "trailing_stop", label: "Trailing Stop" },
  { value: "close", label: "Close" },
];

const CONDITION_OPTIONS: { value: HardExitTrigger; label: string }[] = [
  { value: "indicator", label: "Indicator" },
  { value: "trend", label: "Trend" },
  { value: "price", label: "Price Cross" },
  { value: "retrace", label: "Retrace" },
  { value: "webhook", label: "Signal Webhook" },
];

/** Each control keeps its own column. A fixed five-column row let the wide selects paint over the next field. */
const exitCardGrid =
  "grid items-start gap-4 [&>*]:min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,14rem),1fr))]";

function isConditionTrigger(value: string): value is HardExitTrigger {
  return (
    value === "indicator" ||
    value === "trend" ||
    value === "price" ||
    value === "retrace" ||
    value === "webhook"
  );
}

function choiceDraft(
  value: string,
  side: FuturesSide,
  current: HardExitDraft,
): HardExitDraft {
  if (value === "target" || value === "stop" || value === "trail") {
    return { trigger: value };
  }
  if (!isConditionTrigger(value)) {
    return { trigger: "unset" };
  }
  return hardExitForTrigger(
    value,
    side,
    current.trigger === value ? current : null,
  );
}

function withoutPriceRules(groups: ExitOrGroup[]): ExitOrGroup[] {
  return groups.flatMap((group) => {
    const kept = group.rows.filter((row) => !isExitPriceRule(row.draft.trigger));
    if (isExitPriceRule(group.anchor.trigger)) {
      const [next, ...tail] = kept;
      if (!next) {
        return [];
      }
      return [{ ...group, anchor: next.draft, rows: tail }];
    }
    return kept.length === group.rows.length ? [group] : [{ ...group, rows: kept }];
  });
}

function actionValue(clause: ExitBuilderClause): string {
  if (isClassicExitKind(clause.kind) || clause.kind === "breakeven") {
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
  renderTakeProfit,
  renderTrailingStop,
  renderStopLoss,
  renderBreakeven,
  showErrors = false,
  actionName,
  prices = EMPTY_EXIT_PRICES,
  priceStyle = "dca",
  stopIsPercent = false,
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
  renderTakeProfit: (slot: ExitFieldSlot | null) => ReactNode;
  renderTrailingStop: (slot: ExitFieldSlot | null) => ReactNode;
  renderStopLoss: (slot: ExitFieldSlot | null) => ReactNode;
  renderBreakeven: (slot: ExitFieldSlot | null) => ReactNode;
  showErrors?: boolean;
  /** Posts the action list. Empty when the side still uses the classic columns. */
  actionName?: string;
  prices?: ExitSidePrices;
  /** Later cards use this desk's price fields. */
  priceStyle?: ExitPriceStyle;
  /** The first stop card is a percent stop, so it shows Execution. */
  stopIsPercent?: boolean;
}) {
  const normalized = useMemo(
    () => clauses.map((clause) => normalizeExitClause(clause)),
    [clauses],
  );
  useEffect(() => {
    if (normalized.some((clause, index) => clause !== clauses[index])) {
      onChange(normalized);
    }
  }, [clauses, normalized, onChange]);
  const webhookIds = webhooks.map((hook) => hook.id);
  const firstClose = normalized.find((clause) => clause.kind === "custom");
  const closePlaced = firstClose ? placeFirstClose(firstClose) : [];
  const stackCount = closePlaced.filter((row) => row.stackIndex != null).length;
  const savedActions = exitActionsForSave(normalized, prices, priceStyle);
  const remainderUsed = normalized.some(
    (clause) => clause.kind !== "" && clauseScope(clause).kind === "remainder",
  );

  function commit(next: ExitBuilderClause[]) {
    onChange(next.length > 0 ? next : [emptyExitClause()]);
  }
  function patch(key: string, update: (clause: ExitBuilderClause) => ExitBuilderClause) {
    commit(normalized.map((clause) => (clause.key === key ? update(clause) : clause)));
  }
  function setChoice(clause: ExitBuilderClause, value: string) {
    if (
      value === "take_profit" ||
      value === "trailing_stop" ||
      value === "stop_loss" ||
      value === "breakeven"
    ) {
      const rule = priceRuleForKind(value);
      patch(clause.key, (current) => {
        const keptRows = current.rows.filter((row) => !isExitPriceRule(row.draft.trigger));
        const keepAnchor =
          current.anchor.trigger !== "unset" && !isExitPriceRule(current.anchor.trigger);
        return normalizeExitClause({
          ...current,
          kind: value,
          scope: current.scope,
          anchor: rule ? { trigger: rule } : current.anchor,
          rows: keepAnchor
            ? [{ key: rowKey(), join: "and", draft: current.anchor }, ...keptRows]
            : keptRows,
          orGroups: withoutPriceRules(clauseOrGroups(current)),
        });
      });
      return;
    }
    if (value === "close") {
      patch(clause.key, (current) => {
        if (current.kind === "custom") {
          return current;
        }
        const keptRows = current.rows.filter((row) => !isExitPriceRule(row.draft.trigger));
        let anchor =
          current.anchor.trigger === "unset" || isExitPriceRule(current.anchor.trigger)
            ? ({ trigger: "unset" } as const)
            : current.anchor;
        let rows = keptRows;
        if (anchor.trigger === "unset" && rows[0]) {
          anchor = rows[0].draft;
          rows = rows.slice(1);
        }
        return {
          ...customExitClause(anchor, rows, current.key),
          scope: current.scope,
          orGroups: withoutPriceRules(clauseOrGroups(current)),
        };
      });
      return;
    }
    patch(clause.key, (current) => ({ ...emptyExitClause(), key: current.key }));
  }
  function setAnchor(clause: ExitBuilderClause, value: string) {
    if (priceRuleForKind(clause.kind)) {
      return;
    }
    if (value === "") {
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
      anchor: choiceDraft(value, side, current.anchor),
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
  function showExecution(clause: ExitBuilderClause, firstOfKind: boolean): boolean {
    if (clause.kind === "trailing_stop" || clause.kind === "breakeven") {
      return true;
    }
    if (clause.kind !== "stop_loss") {
      return false;
    }
    if (!firstOfKind) {
      const method = clause.levels?.method;
      if (method === "price") {
        return false;
      }
      if (method === "percent") {
        return true;
      }
      return priceStyle === "dca";
    }
    return priceStyle === "dca" || stopIsPercent;
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

  function ruleFields(clause: ExitBuilderClause, firstOfKind: boolean): ReactNode {
    if (firstOfKind) {
      if (clause.kind === "take_profit") {
        return renderTakeProfit(null);
      }
      if (clause.kind === "trailing_stop") {
        return renderTrailingStop(null);
      }
      if (clause.kind === "stop_loss") {
        return renderStopLoss(null);
      }
      if (clause.kind === "breakeven") {
        return renderBreakeven(null);
      }
      return null;
    }
    if (clause.kind === "breakeven") {
      return null;
    }
    if (!isClassicExitKind(clause.kind)) {
      return null;
    }
    const slot: ExitFieldSlot = {
      levels: seedRepeatLevels(clause, priceStyle),
      showErrors,
      onChange: (next) => {
        patch(clause.key, (current) => ({
          ...current,
          levels: { ...seedRepeatLevels(current, priceStyle), ...next },
        }));
      },
    };
    if (clause.kind === "take_profit") {
      return renderTakeProfit(slot);
    }
    if (clause.kind === "trailing_stop") {
      return renderTrailingStop(slot);
    }
    return renderStopLoss(slot);
  }

  const kindCounts = new Map<string, number>();

  return (
    <BotColumnLayout enabled>
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
      {normalized.map((clause, index) => {
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
        return (
          <div key={clause.key} className="space-y-3">
            {index > 0 ? <JoinWord label="Or" /> : null}
            <section className="condition-group space-y-4 rounded-card border border-line bg-canvas px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-sm font-semibold text-ink">
                  Group {index + 1}
                  <span className="ml-2 text-hint font-normal text-ink-muted">
                    - {CONDITION_GROUP_HELPER}
                  </span>
                </h3>
                {normalized.length > 1 ? (
                  <RemoveConditionButton
                    scope="group"
                    onClick={() => commit(normalized.filter((item) => item.key !== clause.key))}
                  />
                ) : null}
              </div>
              <div className={exitCardGrid}>
                <label className={`${labelClass} whitespace-nowrap`}>
                  <HintLabel text="Action" />
                  <AppSelect
                    value={actionValue(clause)}
                    onChange={(event) => setChoice(clause, event.target.value)}
                    className={
                      showErrors && clause.kind === "" && normalized.some((item) => item.kind !== "")
                        ? botFieldInvalidClass
                        : fieldClass
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
              </div>
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
                    fieldClass={fieldClass}
                    labelClass={labelClass}
                    showErrors={showErrors}
                    ruleFields={ruleFields(clause, firstOfKind)}
                    onAnchor={(value) => setAnchor(clause, value)}
                    onPatch={(update) => patch(clause.key, update)}
                  />
                  {canAddRow ? (
                    <div className="col-span-full w-full">
                      <AddConditionButton onClick={() => addRow(clause)} />
                    </div>
                  ) : null}
                </div>
              ) : null}
              {clause.kind !== "" ? (
                <div className={`${exitCardGrid} border-t border-line pt-4`}>
                  {showExecution(clause, firstOfKind) ? (
                    <label className={labelClass}>
                      <HintLabel text="Execution" />
                      <AppSelect
                        value={clauseReference(clause)}
                        onChange={(event) => {
                          const reference = event.target.value === "lot" ? "lot" : "average";
                          patch(clause.key, (current) => ({ ...current, reference }));
                        }}
                        className={fieldClass}
                      >
                        <option value="lot">Per lot</option>
                        <option value="average">Average</option>
                      </AppSelect>
                    </label>
                  ) : null}
                  <label className={labelClass}>
                    <HintLabel text="Applies To" />
                    <AppSelect
                      value={scope.kind}
                      onChange={(event) =>
                        setScope(clause, event.target.value as ExitScope["kind"])
                      }
                      className={fieldClass}
                    >
                      <option value="all">Entire Position</option>
                      {scope.kind === "percent" ? (
                        <option value="percent">Percentage of Position</option>
                      ) : null}
                      {scope.kind === "qty" ? <option value="qty">Quantity</option> : null}
                      <option value="fills">Fills in profit</option>
                      <option value="remainder" disabled={remainderUsed && scope.kind !== "remainder"}>
                        Remainder
                      </option>
                    </AppSelect>
                  </label>
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
              ) : null}
            </section>
          </div>
        );
      })}
      {normalized.length < STRATEGY_CONDITION_CAP ? (
        <AddConditionButton
          label="Add action"
          onClick={() => commit([...normalized, emptyExitClause()])}
        />
      ) : null}
    </div>
    </BotColumnLayout>
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
  fieldClass,
  labelClass,
  showErrors,
  ruleFields,
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
  fieldClass: string;
  labelClass: string;
  showErrors: boolean;
  ruleFields: ReactNode;
  onAnchor: (value: string) => void;
  onPatch: (update: (clause: ExitBuilderClause) => ExitBuilderClause) => void;
}) {
  const anchorPlaced = placed.find((row) => row.role === "anchor") ?? null;
  const seriesIndex = 0;
  const fixedRule = priceRuleForKind(clause.kind);
  const disabled = (["price", "indicator", "trend", "webhook", "retrace"] as const).filter(
    (kind) =>
      kind !== clause.anchor.trigger &&
      anchorDisabledKinds(lead, rows, webhookIds).includes(kind),
  );
  return (
    <div className="space-y-3">
      <div className={exitCardGrid}>
        {fixedRule ? null : (
          <label className={`${labelClass} whitespace-nowrap`}>
            <HintLabel text="Condition Type" />
            <AppSelect
              value={clause.anchor.trigger === "unset" ? "" : clause.anchor.trigger}
              onChange={(event) => onAnchor(event.target.value)}
              className={
                showErrors && clause.anchor.trigger === "unset"
                  ? botFieldInvalidClass
                  : fieldClass
              }
            >
              <option value="">Select Condition Type</option>
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
        )}
        {fixedRule ? ruleFields : null}
        {!fixedRule && clause.anchor.trigger !== "unset" ? (
          <HardExitFields
            embed
            showTrigger={false}
            prefix={named ? prefix : `${prefix}Draft`}
            side={side}
            value={clause.anchor}
            onChange={(draft) => onPatch((current) => ({ ...current, anchor: draft }))}
            webhooks={webhooks}
            gridClass={exitCardGrid}
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
          fieldClass={fieldClass}
          labelClass={labelClass}
          showErrors={showErrors}
          ruleChoices={[]}
          ruleFields={null}
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
          fieldClass={fieldClass}
          labelClass={labelClass}
          showErrors={showErrors}
          ruleChoices={[]}
          ruleFields={null}
          ruleLeaf={null}
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
  fieldClass: string;
  labelClass: string;
  showErrors: boolean;
  ruleChoices: { value: ExitPriceRuleTrigger; label: string; disabled?: boolean }[];
  ruleFields: ReactNode;
  ruleLeaf: string | null;
  onPatch: (update: (clause: ExitBuilderClause) => ExitBuilderClause) => void;
}) {
  const { group, onPatch } = props;
  const stackIndex =
    props.placed.find((item) => item.role === "or-anchor" && item.groupKey === group.key)
      ?.stackIndex ?? null;
  return (
    <div className="space-y-3">
      <JoinWord label="Or" />
      <div className={exitCardGrid}>
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
                        anchor: choiceDraft(value, props.side, item.anchor),
                      }
                    : item,
                ),
              }));
            }}
            className={
              props.showErrors && group.anchor.trigger === "unset"
                ? botFieldInvalidClass
                : props.fieldClass
            }
          >
            <option value="">Select Condition Type</option>
            {props.ruleChoices.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled === true && group.anchor.trigger !== option.value}
              >
                {option.label}
              </option>
            ))}
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
          fieldClass={props.fieldClass}
          labelClass={props.labelClass}
          showErrors={props.showErrors}
          showTrigger={false}
          ruleChoices={props.ruleChoices}
          ruleFields={props.ruleLeaf === group.key ? props.ruleFields : null}
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
          fieldClass={props.fieldClass}
          labelClass={props.labelClass}
          showErrors={props.showErrors}
          ruleChoices={props.ruleChoices.map((option) => ({
            ...option,
            disabled: props.ruleLeaf != null && props.ruleLeaf !== row.key,
          }))}
          ruleFields={props.ruleLeaf === row.key ? props.ruleFields : null}
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
  fieldClass: string;
  labelClass: string;
  showErrors: boolean;
  ruleChoices: { value: ExitPriceRuleTrigger; label: string; disabled?: boolean }[];
  ruleFields: ReactNode;
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
            fieldClass={props.fieldClass}
            labelClass={props.labelClass}
            showErrors={props.showErrors}
            showTrigger
            ruleChoices={props.ruleChoices}
            ruleFields={props.ruleFields}
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
  fieldClass,
  labelClass,
  showErrors,
  showTrigger,
  ruleChoices = [],
  ruleFields = null,
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
  fieldClass: string;
  labelClass: string;
  showErrors: boolean;
  showTrigger: boolean;
  ruleChoices?: { value: ExitPriceRuleTrigger; label: string; disabled?: boolean }[];
  ruleFields?: ReactNode;
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
        gridClass={exitCardGrid}
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
        extraTriggers={ruleChoices}
        extra={ruleFields}
      />
    </div>
  );
}
