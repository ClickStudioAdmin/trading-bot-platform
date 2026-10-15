"use client";

import { useEffect, useRef } from "react";
import { DcaFilterBlock } from "@/components/dca-filter-fields";
import { AppSelect } from "@/components/app-select";
import {
  IndicatorStartFields,
  TrendStartFields,
} from "@/components/bot-indicator-fields";
import { HintLabel } from "@/components/bot-form-chrome";
import { IconPlus, IconTrash } from "@/components/icons";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import { dcaFilterComplete, type DcaFilterSpec } from "@/lib/dca/filters";
import {
  DEFAULT_DCA_RSI_PERIOD,
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DEFAULT_DCA_SUPERTREND_PERIOD,
  indicatorCompareForDirection,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import {
  parseDcaIndicatorStartFields,
  type DcaIndicatorStart,
} from "@/lib/dca/playbook";
import type { FuturesSide, FuturesTrigger } from "@/lib/futures/model";
import {
  STRATEGY_CONDITION_CAP,
  entryJoinDisabled,
  entryKindDisabled,
  entryWebhookIdDisabled,
  resolveEntryStack,
  type EntryConflictSlot,
  type EntryStack,
  type StrategyJoin,
  type StrategyLeaf,
  type StrategyTriggerKind,
} from "@/lib/strategy/expr";

type IndicatorConditionDraft = {
  indicatorKind: DcaIndicatorKind;
  timeframe: DcaIndicatorTimeframe;
  compare: string;
  level: string;
  period: string;
  slowPeriod: string;
  multiplier: string;
};

export type EntryConditionDraft =
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
  if (draft.kind === "filter") {
    return dcaFilterComplete(draft.spec);
  }
  if (draft.kind === "price") {
    return Number(draft.price.replace(/,/g, "").trim()) > 0;
  }
  if (draft.kind === "webhook") {
    return draft.webhookId.trim() !== "";
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
  anchor: { kind: StrategyTriggerKind; webhookId?: string | null },
  rows: EntryStackRow[],
): EntryConflictSlot[] {
  return [
    {
      kind: anchor.kind,
      join: "and",
      webhookId: anchor.kind === "webhook" ? (anchor.webhookId ?? null) : null,
    },
    ...rows.map((row) => ({
      kind: row.draft.kind,
      join: row.join,
      webhookId: row.draft.kind === "webhook" ? row.draft.webhookId : null,
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
    indicatorKind: "rsi",
    timeframe,
    compare: indicatorCompareForDirection(side, "rsi", ""),
    level: side === "short" ? "70" : "30",
    period: String(DEFAULT_DCA_RSI_PERIOD),
    slowPeriod: "",
    multiplier: String(DEFAULT_DCA_SUPERTREND_MULTIPLIER),
  };
}

function nextRow(
  side: FuturesSide,
  rows: EntryStackRow[],
  anchor: { kind: StrategyTriggerKind; webhookId?: string | null },
  webhookIds: string[],
  triggerTimeframe: DcaIndicatorTimeframe | null,
): EntryStackRow {
  const timeframe = pickedTimeframe(rows, triggerTimeframe, "15");
  const kinds: StrategyTriggerKind[] = [
    "price",
    "indicator",
    "trend",
    "webhook",
  ];
  let kind: StrategyTriggerKind = "indicator";
  for (const candidate of kinds) {
    const slots = entryConflictSlots(anchor, [
      ...rows,
      {
        key: "next",
        join: "and",
        draft: draftForKind(candidate, side, timeframe),
      },
    ]);
    if (
      !entryKindDisabled({
        slots,
        index: slots.length - 1,
        kind: candidate,
        webhookIds,
      })
    ) {
      kind = candidate;
      break;
    }
  }
  return {
    key: rowKey(),
    join: "and",
    draft: draftForKind(kind, side, timeframe),
  };
}

const TRIGGER_OPTIONS: { value: StrategyTriggerKind; label: string }[] = [
  { value: "price", label: "Price cross" },
  { value: "indicator", label: "Indicator" },
  { value: "trend", label: "Trend" },
  { value: "webhook", label: "Signal webhook" },
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
}: {
  prefix: string;
  side: FuturesSide;
  rows: EntryStackRow[];
  onChange: (rows: EntryStackRow[]) => void;
  anchor: { kind: StrategyTriggerKind; webhookId?: string | null };
  webhooks?: EntryWebhookOption[];
  triggerTimeframe?: DcaIndicatorTimeframe | null;
  gridClass: string;
  fieldClass: string;
  labelClass: string;
}) {
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
  return (
    <div className="space-y-4">
      <input type="hidden" name={`${prefix}Count`} value={String(rows.length)} />
      {rows.map((row, index) => {
        const slotIndex = index + 1;
        const draft = row.draft;
        const webhookChoices =
          draft.kind === "webhook" &&
          draft.webhookId &&
          !webhooks.some((hook) => hook.id === draft.webhookId)
            ? [...webhooks, { id: draft.webhookId, name: "Webhook (removed)" }]
            : webhooks;
        return (
          <div key={row.key} className="space-y-3 border-t border-line pt-4">
            <div className="flex items-end justify-between gap-3">
              <label className={`${labelClass} w-36`}>
                <HintLabel text="Join" required />
                <AppSelect
                  name={`${prefix}${index}Join`}
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
                onClick={() => onChange(rows.filter((item) => item.key !== row.key))}
              >
                <IconTrash size={14} className="size-3.5" />
                Remove
              </button>
            </div>
            {draft.kind === "filter" ? (
              <>
                <input
                  type="hidden"
                  name={`${prefix}${index}Source`}
                  value="filter"
                />
                <DcaFilterBlock
                  label="Kind"
                  prefix={`${prefix}${index}`}
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
                />
              </>
            ) : (
              <div className={gridClass}>
                <label className={labelClass}>
                  <HintLabel text="Trigger" required />
                  <AppSelect
                    name={`${prefix}${index}Source`}
                    value={draft.kind}
                    onChange={(event) => {
                      const kind = event.target.value as StrategyTriggerKind;
                      if (
                        kind !== "price" &&
                        kind !== "indicator" &&
                        kind !== "trend" &&
                        kind !== "webhook"
                      ) {
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
                    className={fieldClass}
                  >
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
                        name={`${prefix}${index}TriggerBy`}
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
                        <option value="last">Last is</option>
                        <option value="mark">Mark is</option>
                        <option value="index">Index is</option>
                      </AppSelect>
                    </label>
                    <label className={labelClass}>
                      <HintLabel text="Compare" required />
                      <AppSelect
                        name={`${prefix}${index}TriggerCompare`}
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
                        <option value="gte">At or above</option>
                        <option value="lte">At or below</option>
                      </AppSelect>
                    </label>
                    <label className={labelClass}>
                      <HintLabel text="Price" required />
                      <GroupedNumberInput
                        name={`${prefix}${index}TriggerPrice`}
                        value={draft.price}
                        onChange={(price) =>
                          replace(row.key, {
                            ...row,
                            draft: { ...draft, price },
                          })
                        }
                        allowDecimal
                        className={fieldClass}
                      />
                    </label>
                  </>
                ) : draft.kind === "indicator" ? (
                  <IndicatorStartFields
                    side={side}
                    prefix={`${prefix}${index}indicator`}
                    kind={draft.indicatorKind}
                    timeframe={draft.timeframe}
                    compare={draft.compare}
                    level={draft.level}
                    period={draft.period}
                    slowPeriod={draft.slowPeriod}
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
                  />
                ) : draft.kind === "trend" ? (
                  <TrendStartFields
                    side={side}
                    prefix={`${prefix}${index}indicator`}
                    kind={draft.indicatorKind}
                    timeframe={draft.timeframe}
                    compare={draft.compare}
                    period={draft.period}
                    multiplier={draft.multiplier}
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
                ) : (
                  <label className={labelClass}>
                    <HintLabel text="Webhook" required />
                    <AppSelect
                      name={`${prefix}${index}WebhookId`}
                      value={draft.webhookId}
                      onChange={(event) =>
                        replace(row.key, {
                          ...row,
                          draft: { ...draft, webhookId: event.target.value },
                        })
                      }
                      className={fieldClass}
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
                )}
              </div>
            )}
          </div>
        );
      })}
      {rows.length < cap ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
          onClick={() =>
            onChange([
              ...rows,
              nextRow(side, rows, anchor, webhookIds, triggerTimeframe),
            ])
          }
        >
          <IconPlus size={14} className="size-3.5" />
          Add condition
        </button>
      ) : null}
    </div>
  );
}
