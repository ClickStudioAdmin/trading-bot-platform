"use client";

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
import type { FuturesSide } from "@/lib/futures/model";

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
  allowOff = true,
  fieldClass,
  labelClass,
}: {
  label: string;
  prefix: string;
  side: FuturesSide;
  spec: DcaFilterSpec | null;
  onChange: (next: DcaFilterSpec | null) => void;
  named?: boolean;
  dense?: boolean;
  allowOff?: boolean;
  fieldClass: string;
  labelClass: string;
}) {
  const kindField = (
    <label className={labelClass}>
      {label}
      <select
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
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
      whenClass={dense ? "lg:col-span-2" : "col-span-2"}
    />
  ) : null;
  if (dense) {
    return (
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-4">
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

function DcaFilterParamFields({
  prefix,
  side,
  spec,
  onChange,
  named,
  fieldClass,
  labelClass,
  bare = false,
  whenClass = "col-span-2",
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
}) {
  const whenOptions = dcaFilterWhenOptions(spec.kind, side);
  const whenValue = dcaFilterWhenValue(spec.compare);
  const showLevel = spec.kind === "rsi" && spec.compare !== "between";
  const showLevelRange = spec.kind === "rsi" && spec.compare === "between";
  const showMultiplier = spec.kind === "supertrend" || spec.kind === "atr_band";
  const fields = (
    <>
      <label className={labelClass}>
        Period
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
        <label className={labelClass}>
          Multiplier
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
      <label className={labelClass}>
        Timeframe
        <select
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
            <option key={interval} value={interval}>
              {DCA_INDICATOR_TIMEFRAME_LABELS[interval]}
            </option>
          ))}
        </select>
      </label>
      <label className={`${labelClass} ${whenClass}`}>
        When
        <select
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
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {showLevel ? (
        <label className={labelClass}>
          Level
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
          <label className={labelClass}>
            From
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
          <label className={labelClass}>
            To
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
