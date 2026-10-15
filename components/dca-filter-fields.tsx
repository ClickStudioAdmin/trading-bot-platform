"use client";

import { HintLabel, useBotColumnLayout } from "@/components/bot-form-chrome";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  DCA_FILTER_KIND_OPTIONS,
  dcaFilterSpecForKind,
  dcaFilterWhenOptions,
  dcaFilterWhenValue,
  parseDcaFilterKind,
  type DcaFilterKind,
  type DcaFilterSpec,
} from "@/lib/dca/filters";
import {
  DCA_INDICATOR_TIMEFRAMES,
  DCA_INDICATOR_TIMEFRAME_LABELS,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import { indicatorClaim } from "@/lib/strategy/conflicts";
import {
  choiceConflicts,
  type EntryConflictSlot,
} from "@/lib/strategy/expr";
import type { FuturesSide } from "@/lib/futures/model";
import { AppSelect } from "@/components/app-select";

type SeriesProps = {
  seriesSlots?: readonly EntryConflictSlot[];
  seriesIndex?: number;
};

function filterSeriesClaim(
  spec: DcaFilterSpec,
  patch: {
    kind?: DcaFilterSpec["kind"];
    timeframe?: DcaIndicatorTimeframe;
    compare?: string;
    level?: number | null;
    levelTo?: number | null;
  },
) {
  const compare = patch.compare ?? spec.compare;
  let level = patch.level === undefined ? spec.level : patch.level;
  let levelTo = patch.levelTo === undefined ? spec.levelTo : patch.levelTo;
  if (compare === "between") {
    const valid =
      level != null && levelTo != null && level < levelTo;
    if (!valid) {
      level = 30;
      levelTo = 70;
    }
  }
  return indicatorClaim({
    surface: "filter",
    kind: patch.kind ?? spec.kind,
    timeframe: patch.timeframe ?? spec.timeframe,
    compare,
    level,
    levelTo,
    period: spec.period,
    multiplier: spec.multiplier,
  });
}

function nextFilterSpec(
  current: DcaFilterSpec | null,
  kind: DcaFilterKind,
  side: FuturesSide,
): DcaFilterSpec {
  const seeded = dcaFilterSpecForKind(kind, side);
  return {
    ...seeded,
    timeframe: current?.timeframe ?? seeded.timeframe,
  };
}

export function DcaFilterBlock({
  label,
  prefix,
  side,
  spec,
  onChange,
  named = false,
  dense = false,
  allowOff = false,
  gridClass,
  whenClass: whenClassProp,
  fieldClass,
  labelClass,
  seriesSlots,
  seriesIndex,
}: {
  label: string;
  prefix: string;
  side: FuturesSide;
  spec: DcaFilterSpec | null;
  onChange: (next: DcaFilterSpec | null) => void;
  named?: boolean;
  dense?: boolean;
  allowOff?: boolean;
  gridClass?: string;
  whenClass?: string;
  fieldClass: string;
  labelClass: string;
} & SeriesProps) {
  const kindField = (
    <label className={labelClass}>
      <HintLabel text={label} required />
      <AppSelect
        name={named ? `${prefix}Kind` : undefined}
        value={spec?.kind ?? ""}
        onChange={(event) => {
          const kind = parseDcaFilterKind(event.target.value);
          onChange(kind ? nextFilterSpec(spec, kind, side) : null);
        }}
        className={fieldClass}
      >
        {allowOff ? <option value="">Off</option> : null}
        {DCA_FILTER_KIND_OPTIONS.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={
              spec != null &&
              choiceConflicts(
                seriesSlots,
                seriesIndex,
                filterSeriesClaim(
                  { ...nextFilterSpec(spec, option.value, side), timeframe: spec.timeframe },
                  {},
                ),
                option.value === spec.kind,
              )
            }
          >
            {option.label}
          </option>
        ))}
      </AppSelect>
    </label>
  );
  const params = spec ? (
    <DcaFilterParamFields
      prefix={prefix}
      side={side}
      spec={spec}
      onChange={onChange}
      named={named}
      fieldClass={fieldClass}
      labelClass={labelClass}
      bare={dense}
      whenClass={whenClassProp ?? "col-span-2"}
      seriesSlots={seriesSlots}
      seriesIndex={seriesIndex}
    />
  ) : null;
  if (dense) {
    return (
      <div
        className={
          gridClass ?? "grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-4"
        }
      >
        {kindField}
        {params}
      </div>
    );
  }
  return (
    <div className="col-span-full space-y-2">
      {kindField}
      {params}
    </div>
  );
}

export function DcaFilterParamFields({
  prefix,
  side,
  spec,
  onChange,
  named,
  fieldClass,
  labelClass,
  bare = false,
  whenClass = "col-span-2",
  seriesSlots,
  seriesIndex,
}: {
  prefix: string;
  side: FuturesSide;
  spec: DcaFilterSpec;
  onChange: (next: DcaFilterSpec) => void;
  named: boolean;
  fieldClass: string;
  labelClass: string;
  bare?: boolean;
  whenClass?: string;
} & SeriesProps) {
  const column = useBotColumnLayout();
  const whenOptions = dcaFilterWhenOptions(spec.kind, side);
  const whenValue = dcaFilterWhenValue(spec.compare);
  const showLevel = spec.kind === "rsi" && spec.compare !== "between";
  const showLevelRange = spec.kind === "rsi" && spec.compare === "between";
  const showMultiplier = spec.kind === "supertrend" || spec.kind === "atr_band";
  const fields = (
    <>
      <label className={`${labelClass} min-w-0`}>
        <HintLabel text="Period" required />
        <GroupedNumberInput
          name={named ? `${prefix}Period` : undefined}
          value={spec.period == null ? "" : String(spec.period)}
          onChange={(next) => {
            const period = Number(next.replace(/,/g, "").trim());
            onChange({
              ...spec,
              period: Number.isFinite(period) && period > 0 ? period : spec.period,
            });
          }}
          className={fieldClass}
        />
      </label>
      {showMultiplier ? (
        <label className={`${labelClass} min-w-0`}>
          <HintLabel text="Multiplier" required />
          <GroupedNumberInput
            name={named ? `${prefix}Multiplier` : undefined}
            value={spec.multiplier == null ? "" : String(spec.multiplier)}
            onChange={(next) => {
              const multiplier = Number(next.replace(/,/g, "").trim());
              onChange({
                ...spec,
                multiplier:
                  Number.isFinite(multiplier) && multiplier > 0
                    ? multiplier
                    : spec.multiplier,
              });
            }}
            allowDecimal
            className={fieldClass}
          />
        </label>
      ) : null}
      <label className={`${labelClass} min-w-0`}>
        <HintLabel text="Timeframe" required />
        <AppSelect
          name={named ? `${prefix}Timeframe` : undefined}
          value={spec.timeframe}
          onChange={(event) =>
            onChange({
              ...spec,
              timeframe: event.target.value as DcaIndicatorTimeframe,
            })
          }
          className={fieldClass}
        >
          {DCA_INDICATOR_TIMEFRAMES.map((interval) => (
            <option
              key={interval}
              value={interval}
              disabled={choiceConflicts(
                seriesSlots,
                seriesIndex,
                filterSeriesClaim(spec, { timeframe: interval }),
                interval === spec.timeframe,
              )}
            >
              {DCA_INDICATOR_TIMEFRAME_LABELS[interval]}
            </option>
          ))}
        </AppSelect>
      </label>
      <label
        className={
          column
            ? `${labelClass} col-span-full min-w-0`
            : `${labelClass} ${whenClass} min-w-0`
        }
      >
        <HintLabel text="When" required />
        <AppSelect
          name={named ? `${prefix}Compare` : undefined}
          value={whenValue}
          onChange={(event) => {
            const compare = event.target.value as DcaFilterSpec["compare"];
            if (compare === "between") {
              const from = spec.level;
              const to = spec.levelTo;
              const valid = from != null && to != null && from < to;
              onChange({
                ...spec,
                compare,
                level: valid ? from : 30,
                levelTo: valid ? to : 70,
              });
              return;
            }
            onChange({ ...spec, compare, levelTo: null });
          }}
          className={fieldClass}
        >
          {whenOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={choiceConflicts(
                seriesSlots,
                seriesIndex,
                filterSeriesClaim(spec, { compare: option.value }),
                option.value === whenValue,
              )}
            >
              {option.label}
            </option>
          ))}
        </AppSelect>
      </label>
      {showLevel ? (
        <label className={`${labelClass} min-w-0`}>
          <HintLabel text="Level" required />
          <GroupedNumberInput
            name={named ? `${prefix}Level` : undefined}
            value={spec.level == null ? "" : String(spec.level)}
            onChange={(next) => {
              const level = Number(next.replace(/,/g, "").trim());
              onChange({
                ...spec,
                level: Number.isFinite(level) ? level : spec.level,
              });
            }}
            allowDecimal
            className={fieldClass}
          />
        </label>
      ) : null}
      {showLevelRange ? (
        <>
          <label className={`${labelClass} min-w-0`}>
            <HintLabel text="From" required />
            <GroupedNumberInput
              name={named ? `${prefix}Level` : undefined}
              value={spec.level == null ? "" : String(spec.level)}
              onChange={(next) => {
                const level = Number(next.replace(/,/g, "").trim());
                onChange({
                  ...spec,
                  level: Number.isFinite(level) ? level : spec.level,
                });
              }}
              allowDecimal
              className={fieldClass}
            />
          </label>
          <label className={`${labelClass} min-w-0`}>
            <HintLabel text="To" required />
            <GroupedNumberInput
              name={named ? `${prefix}LevelTo` : undefined}
              value={spec.levelTo == null ? "" : String(spec.levelTo)}
              onChange={(next) => {
                const levelTo = Number(next.replace(/,/g, "").trim());
                onChange({
                  ...spec,
                  levelTo: Number.isFinite(levelTo) ? levelTo : spec.levelTo,
                });
              }}
              allowDecimal
              className={fieldClass}
            />
          </label>
        </>
      ) : null}
    </>
  );
  if (bare) {
    return fields;
  }
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2">{fields}</div>
  );
}
