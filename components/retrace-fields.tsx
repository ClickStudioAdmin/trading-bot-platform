"use client";

import { AppSelect } from "@/components/app-select";
import {
  HintLabel,
  botFieldInvalidClass,
} from "@/components/bot-form-chrome";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  DCA_INDICATOR_TIMEFRAMES,
  DCA_INDICATOR_TIMEFRAME_LABELS,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import {
  retraceClaim,
  retraceFromLabel,
  type PositionRetraceFrom,
} from "@/lib/strategy/retrace";
import {
  choiceConflicts,
  type EntryConflictSlot,
} from "@/lib/strategy/expr";
import type { FuturesSide } from "@/lib/futures/model";

export type RetraceDraft = {
  source: "last" | "mark" | "index";
  from: PositionRetraceFrom;
  pct: string;
  lookback: string;
  timeframe: DcaIndicatorTimeframe;
};

const POSITION_RETRACE_FROMS: readonly PositionRetraceFrom[] = [
  "high",
  "low",
  "initial",
  "average",
];

export function blankRetraceDraft(side: FuturesSide): RetraceDraft {
  return {
    source: "last",
    from: side === "short" ? "low" : "high",
    pct: "",
    lookback: "20",
    timeframe: "15",
  };
}

export function RetraceFields({
  prefix,
  draft,
  onChange,
  fieldClass,
  labelClass,
  slots,
  slotIndex,
  showErrors = false,
  position = false,
}: {
  prefix: string;
  draft: RetraceDraft;
  onChange: (next: RetraceDraft) => void;
  fieldClass: string;
  labelClass: string;
  slots?: readonly EntryConflictSlot[];
  slotIndex?: number;
  showErrors?: boolean;
  /** Additional orders use the position lifetime and hide lookback and timeframe. */
  position?: boolean;
}) {
  function disabled(
    next: Partial<Pick<RetraceDraft, "source" | "from" | "timeframe">>,
    selected: boolean,
  ) {
    return choiceConflicts(
      slots,
      slotIndex,
      retraceClaim({
        source: next.source ?? draft.source,
        from: next.from ?? draft.from,
        timeframe: position ? undefined : (next.timeframe ?? draft.timeframe),
        position,
      }),
      selected,
    );
  }
  const pctMissing = !(Number(draft.pct.replace(/,/g, "").trim()) > 0);
  const froms = position
    ? POSITION_RETRACE_FROMS
    : (["high", "low"] as const);
  return (
    <>
      <label className={labelClass}>
        <HintLabel text="Price source" required />
        <AppSelect
          name={prefix ? `${prefix}RetraceSource` : undefined}
          value={draft.source}
          onChange={(event) =>
            onChange({
              ...draft,
              source:
                event.target.value === "mark" || event.target.value === "index"
                  ? event.target.value
                  : "last",
            })
          }
          className={fieldClass}
        >
          {(["last", "mark", "index"] as const).map((source) => (
            <option
              key={source}
              value={source}
              disabled={disabled({ source }, source === draft.source)}
            >
              {source === "last" ? "Last" : source === "mark" ? "Mark" : "Index"}
            </option>
          ))}
        </AppSelect>
      </label>
      <label className={position ? `${labelClass} col-span-2` : labelClass}>
        <HintLabel text="From" required />
        <AppSelect
          name={prefix ? `${prefix}RetraceFrom` : undefined}
          value={draft.from}
          onChange={(event) => {
            const from = POSITION_RETRACE_FROMS.find(
              (row) => row === event.target.value,
            );
            onChange({
              ...draft,
              from: from && (position || from === "high" || from === "low") ? from : "high",
            });
          }}
          className={fieldClass}
        >
          {froms.map((from) => (
            <option
              key={from}
              value={from}
              disabled={disabled({ from }, from === draft.from)}
            >
              {retraceFromLabel(from)}
            </option>
          ))}
        </AppSelect>
      </label>
      <label className={labelClass}>
        <HintLabel text="Retrace %" required />
        <GroupedNumberInput
          name={prefix ? `${prefix}RetracePct` : undefined}
          value={draft.pct}
          onChange={(pct) => onChange({ ...draft, pct })}
          allowDecimal
          className={showErrors && pctMissing ? botFieldInvalidClass : fieldClass}
        />
      </label>
      {position ? null : (
        <label className={labelClass}>
          <HintLabel text="Lookback" required />
          <GroupedNumberInput
            name={prefix ? `${prefix}RetraceLookback` : undefined}
            value={draft.lookback}
            onChange={(lookback) => onChange({ ...draft, lookback })}
            className={fieldClass}
          />
        </label>
      )}
      {position ? null : (
        <label className={labelClass}>
          <HintLabel text="Timeframe" required />
          <AppSelect
            name={prefix ? `${prefix}RetraceTimeframe` : undefined}
            value={draft.timeframe}
            onChange={(event) =>
              onChange({
                ...draft,
                timeframe: event.target.value as DcaIndicatorTimeframe,
              })
            }
            className={fieldClass}
          >
            {DCA_INDICATOR_TIMEFRAMES.map((interval) => (
              <option
                key={interval}
                value={interval}
                disabled={disabled({ timeframe: interval }, interval === draft.timeframe)}
              >
                {DCA_INDICATOR_TIMEFRAME_LABELS[interval]}
              </option>
            ))}
          </AppSelect>
        </label>
      )}
    </>
  );
}
