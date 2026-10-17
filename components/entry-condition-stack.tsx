"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  AddConditionButton,
  andInsertIndex,
  GroupedConditions,
  insertAt,
  RemoveConditionButton,
} from "@/components/condition-group";
import { DcaFilterBlock } from "@/components/dca-filter-fields";
import { AppSelect } from "@/components/app-select";
import {
  IndicatorStartFields,
  TrendStartFields,
} from "@/components/bot-indicator-fields";
import {
  HintLabel,
  botFieldInvalidClass,
  conditionFieldClass,
  useBotColumnLayout,
} from "@/components/bot-form-chrome";
import { IconPlus } from "@/components/icons";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import { dcaFilterComplete, type DcaFilterSpec } from "@/lib/dca/filters";
import {
  DEFAULT_DCA_RSI_PERIOD,
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DEFAULT_DCA_SUPERTREND_PERIOD,
  indicatorCompareForDirection,
  indicatorDraftMissing,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import {
  parseDcaIndicatorStartFields,
  type DcaIndicatorStart,
} from "@/lib/dca/playbook";
import type { FuturesSide, FuturesTrigger } from "@/lib/futures/model";
import {
  indicatorClaim,
  priceClaim,
  type ConflictClaim,
} from "@/lib/strategy/conflicts";
import {
  STRATEGY_CONDITION_CAP,
  entryJoinDisabled,
  entryKindDisabled,
  entryWebhookIdDisabled,
  priceChoiceConflicts,
  resolveEntryStack,
  type EntryConflictSlot,
  type EntryStack,
  type StrategyJoin,
  type StrategyLeaf,
  type StrategyTriggerKind,
} from "@/lib/strategy/expr";

type IndicatorConditionDraft = {
  indicatorKind: DcaIndicatorKind | "";
  timeframe: DcaIndicatorTimeframe;
  compare: string;
  level: string;
  period: string;
  slowPeriod: string;
  multiplier: string;
};

export type EntryConditionDraft =
  | { kind: "unset" }
  | { kind: "filter"; spec: DcaFilterSpec }
  | {
      kind: "price";
      triggerBy: FuturesTrigger;
      compare: "gte" | "lte";
      price: string;
    }
  | ({ kind: "indicator" } & IndicatorConditionDraft)
  | ({ kind: "trend" } & IndicatorConditionDraft)
  | { kind: "webhook"; webhookId: string };

export type EntryStackRow = {
  key: string;
  join: StrategyJoin;
  draft: EntryConditionDraft;
};

export type EntryWebhookOption = { id: string; name: string };

export type EntryAnchor = {
  kind: StrategyTriggerKind;
  webhookId?: string | null;
  claim?: ConflictClaim | null;
};

export function claimFromEntryDraft(
  draft: EntryConditionDraft,
): ConflictClaim | null {
  if (draft.kind === "price") {
    return priceClaim({
      source: draft.triggerBy,
      compare: draft.compare,
      price: draft.price,
    });
  }
  if (draft.kind === "webhook" || draft.kind === "unset") {
    return null;
  }
  if (draft.kind === "filter") {
    return indicatorClaim({
      surface: "filter",
      kind: draft.spec.kind,
      timeframe: draft.spec.timeframe,
      compare: draft.spec.compare,
      level: draft.spec.level,
      levelTo: draft.spec.levelTo,
      period: draft.spec.period,
      slowPeriod: draft.spec.slowPeriod,
      multiplier: draft.spec.multiplier,
    });
  }
  if (!draft.indicatorKind) {
    return null;
  }
  return indicatorClaim({
    surface: "entry",
    kind: draft.indicatorKind,
    timeframe: draft.timeframe,
    compare: draft.compare,
    level: draft.level,
    period: draft.period,
    slowPeriod: draft.slowPeriod,
    multiplier: draft.multiplier,
  });
}

function rowKey(): string {
  return `entry-${Math.random().toString(36).slice(2, 10)}`;
}

function draftFromLeaf(leaf: StrategyLeaf): EntryConditionDraft {
  if (leaf.kind === "filter") {
    return { kind: "filter", spec: leaf.spec };
  }
  if (leaf.kind === "price") {
    return {
      kind: "price",
      triggerBy: leaf.triggerBy,
      compare: leaf.compare,
      price: String(leaf.price),
    };
  }
  if (leaf.kind === "webhook") {
    return { kind: "webhook", webhookId: leaf.webhookId };
  }
  return {
    kind: leaf.kind,
    indicatorKind: leaf.start.kind,
    timeframe: leaf.start.timeframe,
    compare: leaf.start.compare ?? "",
    level: leaf.start.level != null ? String(leaf.start.level) : "",
    period: leaf.start.period != null ? String(leaf.start.period) : "",
    slowPeriod:
      leaf.start.slowPeriod != null ? String(leaf.start.slowPeriod) : "",
    multiplier:
      leaf.start.multiplier != null ? String(leaf.start.multiplier) : "",
  };
}

export function entryRowsFromSources(
  stack: EntryStack | null | undefined,
  confirm: DcaFilterSpec | null | undefined,
): EntryStackRow[] {
  const resolved = resolveEntryStack(stack, confirm);
  return resolved.leaves.map((leaf, index) => ({
    key: rowKey(),
    join: resolved.joins[index] ?? "and",
    draft: draftFromLeaf(leaf),
  }));
}

function indicatorStartFromDraft(
  draft: ({ kind: "indicator" | "trend" } & IndicatorConditionDraft),
): DcaIndicatorStart | null {
  const form = new FormData();
  const names = {
    kind: "indicatorKind",
    timeframe: "indicatorTimeframe",
    compare: "indicatorCompare",
    level: "indicatorLevel",
    period: "indicatorPeriod",
    slowPeriod: "indicatorSlowPeriod",
    multiplier: "indicatorMultiplier",
  };
  form.set(names.kind, draft.indicatorKind);
  form.set(names.timeframe, draft.timeframe);
  form.set(names.compare, draft.compare);
  if (draft.level.trim() !== "") {
    form.set(names.level, draft.level);
  }
  if (draft.period.trim() !== "") {
    form.set(names.period, draft.period);
  }
  if (draft.slowPeriod.trim() !== "") {
    form.set(names.slowPeriod, draft.slowPeriod);
  }
  if (draft.multiplier.trim() !== "") {
    form.set(names.multiplier, draft.multiplier);
  }
  const parsed = parseDcaIndicatorStartFields(
    form,
    names,
    true,
    "",
    draft.kind === "trend" ? "trend" : "indicator",
  );
  return parsed.ok ? parsed.start : null;
}

export function entryDraftComplete(draft: EntryConditionDraft): boolean {
  if (draft.kind === "unset") {
    return false;
  }
  if (draft.kind === "filter") {
    return dcaFilterComplete(draft.spec);
  }
  if (draft.kind === "price") {
    return Number(draft.price.replace(/,/g, "").trim()) > 0;
  }
  if (draft.kind === "webhook") {
    return draft.webhookId.trim() !== "";
  }
  if (
    indicatorDraftMissing({
      family: draft.kind,
      kind: draft.indicatorKind,
      compare: draft.compare,
      level: draft.level,
      period: draft.period,
      slowPeriod: draft.slowPeriod,
      multiplier: draft.multiplier,
    })
  ) {
    return false;
  }
  return indicatorStartFromDraft(draft) != null;
}

export function entryStackFromRows(rows: EntryStackRow[]): EntryStack {
  const leaves: StrategyLeaf[] = [];
  const joins: StrategyJoin[] = [];
  for (const row of rows) {
    const leaf = leafFromDraft(row.draft);
    if (!leaf) {
      continue;
    }
    leaves.push(leaf);
    joins.push(row.join);
  }
  return { leaves, joins };
}

function leafFromDraft(draft: EntryConditionDraft): StrategyLeaf | null {
  if (draft.kind === "unset") {
    return null;
  }
  if (draft.kind === "filter") {
    return { kind: "filter", spec: draft.spec };
  }
  if (draft.kind === "price") {
    const price = Number(draft.price.replace(/,/g, "").trim());
    if (!(price > 0)) {
      return null;
    }
    return {
      kind: "price",
      triggerBy: draft.triggerBy,
      compare: draft.compare,
      price,
    };
  }
  if (draft.kind === "webhook") {
    if (!draft.webhookId.trim()) {
      return null;
    }
    return { kind: "webhook", webhookId: draft.webhookId };
  }
  const start = indicatorStartFromDraft(draft);
  if (!start) {
    return null;
  }
  return { kind: draft.kind, start };
}

export function flipEntryRows(
  rows: EntryStackRow[],
  side: FuturesSide,
): EntryStackRow[] {
  return rows.map((row) => {
    if (row.draft.kind === "price") {
      return {
        ...row,
        draft: {
          ...row.draft,
          compare: row.draft.compare === "gte" ? "lte" : "gte",
        },
      };
    }
    if (row.draft.kind === "indicator" || row.draft.kind === "trend") {
      if (!row.draft.indicatorKind) {
        return row;
      }
      return {
        ...row,
        draft: {
          ...row.draft,
          compare: indicatorCompareForDirection(
            side,
            row.draft.indicatorKind,
            "",
          ),
          level:
            row.draft.indicatorKind === "rsi"
              ? side === "short"
                ? "70"
                : "30"
              : row.draft.level,
        },
      };
    }
    return row;
  });
}

export function entryConflictSlots(
  anchor: EntryAnchor,
  rows: EntryStackRow[],
): EntryConflictSlot[] {
  return [
    {
      kind: anchor.kind,
      join: "and",
      webhookId: anchor.kind === "webhook" ? (anchor.webhookId ?? null) : null,
      claim: anchor.claim ?? null,
    },
    ...rows.map((row) => ({
      kind: row.draft.kind === "unset" ? "indicator" : row.draft.kind,
      join: row.join,
      webhookId: row.draft.kind === "webhook" ? row.draft.webhookId : null,
      claim: claimFromEntryDraft(row.draft),
    })),
  ];
}

function pickedTimeframe(
  rows: EntryStackRow[],
  triggerTimeframe: DcaIndicatorTimeframe | null,
  fallback: DcaIndicatorTimeframe,
): DcaIndicatorTimeframe {
  const used = new Set<DcaIndicatorTimeframe>();
  if (triggerTimeframe) {
    used.add(triggerTimeframe);
  }
  for (const row of rows) {
    if (row.draft.kind === "filter") {
      used.add(row.draft.spec.timeframe);
    } else if (row.draft.kind === "indicator" || row.draft.kind === "trend") {
      used.add(row.draft.timeframe);
    }
  }
  if (used.size >= 4 && !used.has(fallback)) {
    return used.values().next().value ?? fallback;
  }
  return fallback;
}

function draftForKind(
  kind: StrategyTriggerKind,
  side: FuturesSide,
  timeframe: DcaIndicatorTimeframe,
): EntryConditionDraft {
  if (kind === "price") {
    return { kind: "price", triggerBy: "last", compare: "gte", price: "" };
  }
  if (kind === "webhook") {
    return { kind: "webhook", webhookId: "" };
  }
  if (kind === "trend") {
    return {
      kind: "trend",
      indicatorKind: "supertrend",
      timeframe,
      compare: indicatorCompareForDirection(side, "supertrend", ""),
      level: "",
      period: String(DEFAULT_DCA_SUPERTREND_PERIOD),
      slowPeriod: "",
      multiplier: String(DEFAULT_DCA_SUPERTREND_MULTIPLIER),
    };
  }
  return {
    kind: "indicator",
    indicatorKind: "",
    timeframe,
    compare: "",
    level: "",
    period: "",
    slowPeriod: "",
    multiplier: "",
  };
}

function blankEntryRow(join: StrategyJoin): EntryStackRow {
  return { key: rowKey(), join, draft: { kind: "unset" } };
}

const TRIGGER_OPTIONS: { value: StrategyTriggerKind; label: string }[] = [
  { value: "indicator", label: "Indicator" },
  { value: "trend", label: "Trend" },
  { value: "price", label: "Price Cross" },
  { value: "webhook", label: "Signal Webhook" },
];

export function EntryConditionStack({
  prefix,
  side,
  rows,
  onChange,
  anchor,
  webhooks = [],
  triggerTimeframe = null,
  gridClass,
  fieldClass,
  labelClass,
  grouped = false,
  lead,
  groupFooter,
  showErrors = false,
  optionalAddedKind = false,
}: {
  prefix: string;
  side: FuturesSide;
  rows: EntryStackRow[];
  onChange: (rows: EntryStackRow[]) => void;
  anchor: EntryAnchor;
  webhooks?: EntryWebhookOption[];
  triggerTimeframe?: DcaIndicatorTimeframe | null;
  gridClass: string;
  fieldClass: string;
  labelClass: string;
  /** And rows share a card. Or starts the next card. */
  grouped?: boolean;
  lead?: ReactNode;
  /** Size fields at the bottom of each group, after Add Condition. */
  groupFooter?: (groupIndex: number) => ReactNode;
  /** Paint empty required controls after the form has been edited. */
  showErrors?: boolean;
  /** Perps added rows can stay on Select Condition Type. */
  optionalAddedKind?: boolean;
}) {
  const column = useBotColumnLayout();
  const cap = STRATEGY_CONDITION_CAP - 1;
  const webhookIds = webhooks.map((hook) => hook.id);
  const slots = entryConflictSlots(anchor, rows);
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  function commit(next: EntryStackRow[]) {
    rowsRef.current = next;
    onChange(next);
  }
  function replace(key: string, next: EntryStackRow) {
    commit(rowsRef.current.map((item) => (item.key === key ? next : item)));
  }
  function patchDraft(
    key: string,
    patch: Partial<IndicatorConditionDraft>,
  ) {
    commit(
      rowsRef.current.map((item) => {
        if (item.key !== key) {
          return item;
        }
        if (item.draft.kind !== "indicator" && item.draft.kind !== "trend") {
          return item;
        }
        return { ...item, draft: { ...item.draft, ...patch } };
      }),
    );
  }
  function joinControl(row: EntryStackRow, index: number, slotIndex: number, labelled: boolean) {
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
          name={index < 0 ? undefined : `${prefix}${index}Join`}
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
    row: EntryStackRow,
    scope: "group" | "condition" = "condition",
  ) {
    return (
      <RemoveConditionButton
        scope={scope}
        onClick={() => onChange(rows.filter((item) => item.key !== row.key))}
      />
    );
  }
  let postedCount = 0;
  const rendered = rows.map((row, index) => {
        const slotIndex = index + 1;
        const draft = row.draft;
        const postRow = !optionalAddedKind || draft.kind !== "unset";
        const nameIndex = postRow ? postedCount : -1;
        if (postRow) {
          postedCount += 1;
        }
        const webhookChoices =
          draft.kind === "webhook" &&
          draft.webhookId &&
          !webhooks.some((hook) => hook.id === draft.webhookId)
            ? [...webhooks, { id: draft.webhookId, name: "Webhook (removed)" }]
            : webhooks;
        return {
          key: row.key,
          join: row.join,
          row,
          index: nameIndex,
          slotIndex,
          body: (
          <>
            {draft.kind === "filter" ? (
              <>
                <input
                  type="hidden"
                  name={nameIndex < 0 ? undefined : `${prefix}${nameIndex}Source`}
                  value="filter"
                />
                <DcaFilterBlock
                  label="Kind"
                  prefix={`${prefix}${nameIndex}`}
                  side={side}
                  spec={draft.spec}
                  onChange={(spec) => {
                    if (!spec) {
                      return;
                    }
                    replace(row.key, { ...row, draft: { kind: "filter", spec } });
                  }}
                  named
                  dense
                  allowOff={false}
                  gridClass={gridClass}
                  fieldClass={fieldClass}
                  labelClass={labelClass}
                  showErrors={showErrors}
                  seriesSlots={slots}
                  seriesIndex={slotIndex}
                />
              </>
            ) : (
              <div className={gridClass}>
                <label className={`${labelClass} whitespace-nowrap`}>
                  <HintLabel
                    text="Condition Type"
                    required={!optionalAddedKind}
                  />
                  <AppSelect
                    name={nameIndex < 0 ? undefined : `${prefix}${nameIndex}Source`}
                    value={draft.kind === "unset" ? "" : draft.kind}
                    onChange={(event) => {
                      const kind = event.target.value as StrategyTriggerKind;
                      if (
                        kind !== "price" &&
                        kind !== "indicator" &&
                        kind !== "trend" &&
                        kind !== "webhook"
                      ) {
                        replace(row.key, { ...row, draft: { kind: "unset" } });
                        return;
                      }
                      const timeframe = pickedTimeframe(
                        rows,
                        triggerTimeframe,
                        "15",
                      );
                      replace(row.key, {
                        ...row,
                        draft: draftForKind(kind, side, timeframe),
                      });
                    }}
                    className={
                      showErrors && draft.kind === "unset" && !optionalAddedKind
                        ? conditionFieldClass(botFieldInvalidClass, column)
                        : row.join === "or"
                          ? conditionFieldClass(fieldClass, column)
                          : fieldClass
                    }
                  >
                    <option value="">Select Condition Type</option>
                    {TRIGGER_OPTIONS.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        disabled={entryKindDisabled({
                          slots,
                          index: slotIndex,
                          kind: option.value,
                          webhookIds,
                        })}
                      >
                        {option.label}
                      </option>
                    ))}
                  </AppSelect>
                </label>
                {draft.kind === "price" ? (
                  <>
                    <label className={labelClass}>
                      <HintLabel text="Price source" required />
                      <AppSelect
                        name={`${prefix}${nameIndex}TriggerBy`}
                        value={draft.triggerBy}
                        onChange={(event) =>
                          replace(row.key, {
                            ...row,
                            draft: {
                              ...draft,
                              triggerBy: event.target.value as FuturesTrigger,
                            },
                          })
                        }
                        className={fieldClass}
                      >
                        {(["last", "mark", "index"] as const).map((source) => (
                          <option
                            key={source}
                            value={source}
                            disabled={priceChoiceConflicts(
                              slots,
                              slotIndex,
                              {
                                source: draft.triggerBy,
                                compare: draft.compare,
                                price: draft.price,
                              },
                              { source },
                            )}
                          >
                            {source === "last"
                              ? "Last is"
                              : source === "mark"
                                ? "Mark is"
                                : "Index is"}
                          </option>
                        ))}
                      </AppSelect>
                    </label>
                    <label className={labelClass}>
                      <HintLabel text="Compare" required />
                      <AppSelect
                        name={`${prefix}${nameIndex}TriggerCompare`}
                        value={draft.compare}
                        onChange={(event) =>
                          replace(row.key, {
                            ...row,
                            draft: {
                              ...draft,
                              compare: event.target.value === "lte" ? "lte" : "gte",
                            },
                          })
                        }
                        className={fieldClass}
                      >
                        {(["gte", "lte"] as const).map((compare) => (
                          <option
                            key={compare}
                            value={compare}
                            disabled={priceChoiceConflicts(
                              slots,
                              slotIndex,
                              {
                                source: draft.triggerBy,
                                compare: draft.compare,
                                price: draft.price,
                              },
                              { compare },
                            )}
                          >
                            {compare === "gte" ? "At or above" : "At or below"}
                          </option>
                        ))}
                      </AppSelect>
                    </label>
                    <label className={labelClass}>
                      <HintLabel text="Price" required />
                      <GroupedNumberInput
                        name={`${prefix}${nameIndex}TriggerPrice`}
                        value={draft.price}
                        onChange={(price) =>
                          replace(row.key, {
                            ...row,
                            draft: { ...draft, price },
                          })
                        }
                        allowDecimal
                        className={
                          showErrors &&
                          !(Number(draft.price.replace(/,/g, "").trim()) > 0)
                            ? botFieldInvalidClass
                            : fieldClass
                        }
                      />
                    </label>
                  </>
                ) : draft.kind === "indicator" ? (
                  <IndicatorStartFields
                    side={side}
                    prefix={`${prefix}${nameIndex}indicator`}
                    kind={draft.indicatorKind}
                    timeframe={draft.timeframe}
                    compare={draft.compare}
                    level={draft.level}
                    period={draft.period}
                    slowPeriod={draft.slowPeriod}
                    multiplier={draft.multiplier}
                    seriesSlots={slots}
                    seriesIndex={slotIndex}
                    showErrors={showErrors}
                    onKindChange={(indicatorKind) =>
                      patchDraft(row.key, { indicatorKind })
                    }
                    onTimeframeChange={(timeframe) =>
                      patchDraft(row.key, { timeframe })
                    }
                    onCompareChange={(compare) =>
                      patchDraft(row.key, { compare })
                    }
                    onLevelChange={(level) => patchDraft(row.key, { level })}
                    onPeriodChange={(period) => patchDraft(row.key, { period })}
                    onSlowPeriodChange={(slowPeriod) =>
                      patchDraft(row.key, { slowPeriod })
                    }
                    onMultiplierChange={(multiplier) =>
                      patchDraft(row.key, { multiplier })
                    }
                  />
                ) : draft.kind === "trend" ? (
                  <TrendStartFields
                    side={side}
                    prefix={`${prefix}${nameIndex}indicator`}
                    kind={draft.indicatorKind || "supertrend"}
                    timeframe={draft.timeframe}
                    compare={draft.compare}
                    period={draft.period}
                    multiplier={draft.multiplier}
                    seriesSlots={slots}
                    seriesIndex={slotIndex}
                    showErrors={showErrors}
                    onKindChange={(indicatorKind) =>
                      patchDraft(row.key, { indicatorKind })
                    }
                    onTimeframeChange={(timeframe) =>
                      patchDraft(row.key, { timeframe })
                    }
                    onCompareChange={(compare) =>
                      patchDraft(row.key, { compare })
                    }
                    onPeriodChange={(period) => patchDraft(row.key, { period })}
                    onMultiplierChange={(multiplier) =>
                      patchDraft(row.key, { multiplier })
                    }
                  />
                ) : draft.kind === "webhook" ? (
                  <label className={`${labelClass} col-span-full`}>
                    <HintLabel text="Webhook" required />
                    <AppSelect
                      name={`${prefix}${nameIndex}WebhookId`}
                      value={draft.webhookId}
                      onChange={(event) =>
                        replace(row.key, {
                          ...row,
                          draft: { ...draft, webhookId: event.target.value },
                        })
                      }
                      className={
                        showErrors && draft.webhookId.trim() === ""
                          ? conditionFieldClass(botFieldInvalidClass, column)
                          : conditionFieldClass(fieldClass, column)
                      }
                    >
                      <option value="">
                        {webhooks.length === 0
                          ? "Create a Signal webhook first"
                          : "Pick a webhook"}
                        </option>
                      {webhookChoices.map((hook) => (
                        <option
                          key={hook.id}
                          value={hook.id}
                          disabled={entryWebhookIdDisabled({
                            slots,
                            index: slotIndex,
                            webhookId: hook.id,
                          })}
                        >
                          {hook.name}
                        </option>
                      ))}
                    </AppSelect>
                  </label>
                ) : null}
              </div>
            )}
          </>
          ),
        };
      });
  function addAt(join: StrategyJoin, groupIndex?: number) {
    const current = rowsRef.current;
    if (current.length >= cap) {
      return;
    }
    const index =
      join === "or" ? current.length : andInsertIndex(current, groupIndex ?? 0);
    const created = blankEntryRow(join);
    commit(insertAt(current, index, created));
  }
  const canAdd = rows.length < cap;
  const addButton = canAdd ? (
    <button
      type="button"
      className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
        onClick={() => onChange([...rows, blankEntryRow("and")])}
    >
      <IconPlus size={14} className="size-3.5" />
      Add Condition
    </button>
  ) : null;
  if (grouped) {
    return (
      <div className="space-y-3">
        <input type="hidden" name={`${prefix}Count`} value={String(postedCount)} />
        <GroupedConditions
          rows={rendered}
          lead={lead}
          renderRemove={(item, scope) => removeControl(item.row, scope)}
          renderBody={(item) => (
            <>
              {item.index < 0 ? null : (
                <input type="hidden" name={`${prefix}${item.index}Join`} value={item.join} />
              )}
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
          renderGroupFooter={groupFooter}
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
      <input type="hidden" name={`${prefix}Count`} value={String(postedCount)} />
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
