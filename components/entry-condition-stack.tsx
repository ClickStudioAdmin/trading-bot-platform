"use client";

import { DcaFilterBlock } from "@/components/dca-filter-fields";
import { AppSelect } from "@/components/app-select";
import { HintLabel } from "@/components/bot-form-chrome";
import { IconPlus, IconTrash } from "@/components/icons";
import { dcaFilterSpecForKind, type DcaFilterSpec } from "@/lib/dca/filters";
import type { DcaIndicatorTimeframe } from "@/lib/dca/indicators";
import type { FuturesSide } from "@/lib/futures/model";
import {
  STRATEGY_CONDITION_CAP,
  resolveEntryStack,
  type EntryStack,
  type StrategyJoin,
} from "@/lib/strategy/expr";

export type EntryStackRow = {
  key: string;
  join: StrategyJoin;
  spec: DcaFilterSpec;
};

function rowKey(): string {
  return `entry-${Math.random().toString(36).slice(2, 10)}`;
}

export function entryRowsFromSources(
  stack: EntryStack | null | undefined,
  confirm: DcaFilterSpec | null | undefined,
): EntryStackRow[] {
  const resolved = resolveEntryStack(stack, confirm);
  return resolved.leaves.map((leaf, index) => ({
    key: rowKey(),
    join: resolved.joins[index] ?? "and",
    spec: leaf.spec,
  }));
}

export function entryStackFromRows(rows: EntryStackRow[]): EntryStack {
  return {
    leaves: rows.map((row) => ({ kind: "filter", spec: row.spec })),
    joins: rows.map((row) => row.join),
  };
}

function nextRow(
  side: FuturesSide,
  rows: EntryStackRow[],
  triggerTimeframe: DcaIndicatorTimeframe | null,
): EntryStackRow {
  const spec = dcaFilterSpecForKind("rsi", side);
  const used = new Set(rows.map((row) => row.spec.timeframe));
  if (triggerTimeframe) {
    used.add(triggerTimeframe);
  }
  if (used.size >= 4 && !used.has(spec.timeframe)) {
    const first = used.values().next().value;
    if (first) {
      spec.timeframe = first;
    }
  }
  return { key: rowKey(), join: "and", spec };
}

export function EntryConditionStack({
  prefix,
  side,
  rows,
  onChange,
  triggerTimeframe = null,
  gridClass,
  fieldClass,
  labelClass,
}: {
  prefix: string;
  side: FuturesSide;
  rows: EntryStackRow[];
  onChange: (rows: EntryStackRow[]) => void;
  triggerTimeframe?: DcaIndicatorTimeframe | null;
  gridClass: string;
  fieldClass: string;
  labelClass: string;
}) {
  const cap = STRATEGY_CONDITION_CAP - 1;
  return (
    <div className="space-y-4">
      <input type="hidden" name={`${prefix}Count`} value={String(rows.length)} />
      {rows.map((row, index) => (
        <div key={row.key} className="space-y-3 border-t border-line pt-4">
          <div className="flex items-end justify-between gap-3">
            <label className={`${labelClass} w-36`}>
              <HintLabel text="Join" required />
              <AppSelect
                name={`${prefix}${index}Join`}
                value={row.join}
                onChange={(event) => {
                  const join = event.target.value === "or" ? "or" : "and";
                  onChange(
                    rows.map((item) =>
                      item.key === row.key ? { ...item, join } : item,
                    ),
                  );
                }}
                className={fieldClass}
              >
                <option value="and">And</option>
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
          <DcaFilterBlock
            label="Kind"
            prefix={`${prefix}${index}`}
            side={side}
            spec={row.spec}
            onChange={(spec) => {
              if (!spec) {
                return;
              }
              onChange(
                rows.map((item) =>
                  item.key === row.key ? { ...item, spec } : item,
                ),
              );
            }}
            named
            dense
            allowOff={false}
            gridClass={gridClass}
            fieldClass={fieldClass}
            labelClass={labelClass}
          />
        </div>
      ))}
      {rows.length < cap ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
          onClick={() =>
            onChange([...rows, nextRow(side, rows, triggerTimeframe)])
          }
        >
          <IconPlus size={14} className="size-3.5" />
          Add condition
        </button>
      ) : null}
    </div>
  );
}
