"use client";

import { HintLabel, botFieldClass, botLabelClass } from "@/components/bot-form-chrome";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  DCA_INDICATOR_KIND_OPTIONS,
  DCA_TREND_KIND_OPTIONS,
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DCA_INDICATOR_TIMEFRAMES,
  DCA_INDICATOR_TIMEFRAME_LABELS,
  defaultDcaIndicatorPeriod,
  defaultDcaIndicatorSlowPeriod,
  dcaIndicatorIsLegacyEmaPrice,
  dcaIndicatorShowsLevel,
  dcaIndicatorUsesPairPeriods,
  dcaIndicatorUsesPeriod,
  dcaIndicatorWhenOptions,
  dcaIndicatorWhenValue,
  indicatorCompareForDirection,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";

const fieldClass = botFieldClass;
const labelClass = botLabelClass;

export function IndicatorStartFields({
  side,
  prefix,
  kind,
  timeframe,
  compare,
  level,
  period,
  slowPeriod,
  onKindChange,
  onTimeframeChange,
  onCompareChange,
  onLevelChange,
  onPeriodChange,
  onSlowPeriodChange,
}: {
  side: "long" | "short";
  prefix: string;
  kind: DcaIndicatorKind;
  timeframe: DcaIndicatorTimeframe;
  compare: string;
  level: string;
  period: string;
  slowPeriod: string;
  onKindChange: (next: DcaIndicatorKind) => void;
  onTimeframeChange: (next: DcaIndicatorTimeframe) => void;
  onCompareChange: (next: string) => void;
  onLevelChange: (next: string) => void;
  onPeriodChange: (next: string) => void;
  onSlowPeriodChange: (next: string) => void;
}) {
  const includeLegacyEmaPrice = dcaIndicatorIsLegacyEmaPrice(
    kind,
    compare,
    level,
  );
  const whenOptions = dcaIndicatorWhenOptions(
    kind,
    side,
    includeLegacyEmaPrice,
  );
  const showPairPeriods =
    dcaIndicatorUsesPairPeriods(kind) && !includeLegacyEmaPrice;
  const whenField = (
    <label className={labelClass}>
      <HintLabel text="When" required />
      <select
        name={`${prefix}Compare`}
        value={dcaIndicatorWhenValue(kind, side, compare, level)}
        onChange={(event) => {
          const next = event.target.value;
          onCompareChange(next);
          if (kind === "ema_cross" && next !== "legacy") {
            onLevelChange("");
          }
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
  );
  const indicatorField = (
    <label className={labelClass}>
      <HintLabel text="Indicator" required />
      <select
        name={`${prefix}Kind`}
        value={kind}
        onChange={(event) => {
          const next = event.target.value as DcaIndicatorKind;
          onKindChange(next);
          onCompareChange(indicatorCompareForDirection(side, next, ""));
          if (next === "rsi") {
            onLevelChange("30");
          } else if (next === "macd") {
            onLevelChange("0");
          } else if (
            kind === "rsi" ||
            kind === "macd" ||
            dcaIndicatorIsLegacyEmaPrice(kind, compare, level)
          ) {
            onLevelChange("");
          }
          if (dcaIndicatorUsesPairPeriods(next)) {
            onPeriodChange(String(defaultDcaIndicatorPeriod(next)));
            onSlowPeriodChange(String(defaultDcaIndicatorSlowPeriod(next)));
          } else {
            onSlowPeriodChange("");
            if (dcaIndicatorUsesPeriod(next)) {
              onPeriodChange(String(defaultDcaIndicatorPeriod(next)));
            }
          }
        }}
        className={fieldClass}
      >
        {DCA_INDICATOR_KIND_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
  const timeframeField = (
    <label className={labelClass}>
      <HintLabel text="Timeframe" required />
      <select
        name={`${prefix}Timeframe`}
        value={timeframe}
        onChange={(event) =>
          onTimeframeChange(event.target.value as DcaIndicatorTimeframe)
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
  );
  const pairFields = (
    <>
      <label className={labelClass}>
        <HintLabel text="Fast" required />
        <GroupedNumberInput
          name={`${prefix}Period`}
          value={period}
          onChange={onPeriodChange}
          className={fieldClass}
        />
      </label>
      {whenField}
      <label className={labelClass}>
        <HintLabel text="Slow" required />
        <GroupedNumberInput
          name={`${prefix}SlowPeriod`}
          value={slowPeriod}
          onChange={onSlowPeriodChange}
          className={fieldClass}
        />
      </label>
    </>
  );
  const periodField = dcaIndicatorUsesPeriod(kind) ? (
    <label className={labelClass}>
      <HintLabel text="Period" required />
      <GroupedNumberInput
        name={`${prefix}Period`}
        value={period}
        onChange={onPeriodChange}
        className={fieldClass}
      />
    </label>
  ) : null;
  const levelField = dcaIndicatorShowsLevel(kind, compare, level) ? (
    <label className={labelClass}>
      <HintLabel
        text={kind === "ema_cross" ? "Level (price)" : "Level"}
        required
      />
      <GroupedNumberInput
        name={`${prefix}Level`}
        value={level}
        onChange={onLevelChange}
        allowDecimal
        allowNegative={kind === "macd"}
        className={fieldClass}
      />
    </label>
  ) : null;
  return (
    <>
      {showPairPeriods ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:col-span-2 sm:grid-cols-5 lg:col-span-4">
          {indicatorField}
          {timeframeField}
          {pairFields}
        </div>
      ) : kind === "rsi" ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:col-span-2 sm:grid-cols-5 lg:col-span-4">
          {indicatorField}
          {periodField}
          {timeframeField}
          {whenField}
          {levelField}
        </div>
      ) : (
        <>
          {indicatorField}
          {periodField}
          {timeframeField}
          {whenField}
          {levelField}
        </>
      )}
    </>
  );
}

export function TrendStartFields({
  side,
  prefix,
  kind,
  timeframe,
  compare,
  period,
  multiplier,
  onKindChange,
  onTimeframeChange,
  onCompareChange,
  onPeriodChange,
  onMultiplierChange,
}: {
  side: "long" | "short";
  prefix: string;
  kind: DcaIndicatorKind;
  timeframe: DcaIndicatorTimeframe;
  compare: string;
  period: string;
  multiplier: string;
  onKindChange: (next: DcaIndicatorKind) => void;
  onTimeframeChange: (next: DcaIndicatorTimeframe) => void;
  onCompareChange: (next: string) => void;
  onPeriodChange: (next: string) => void;
  onMultiplierChange: (next: string) => void;
}) {
  const trendKind = kind === "supertrend" ? kind : "supertrend";
  const whenOptions = dcaIndicatorWhenOptions(trendKind, side, false);
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:col-span-2 sm:grid-cols-5 lg:col-span-4">
      <label className={labelClass}>
        <HintLabel text="Trend" required />
        <select
          name={`${prefix}Kind`}
          value={trendKind}
          onChange={(event) => {
            const next = event.target.value as DcaIndicatorKind;
            onKindChange(next);
            onCompareChange(indicatorCompareForDirection(side, next, ""));
            onPeriodChange(String(defaultDcaIndicatorPeriod(next)));
            onMultiplierChange(String(DEFAULT_DCA_SUPERTREND_MULTIPLIER));
          }}
          className={fieldClass}
        >
          {DCA_TREND_KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        <HintLabel text="Period" required />
        <GroupedNumberInput
          name={`${prefix}Period`}
          value={period}
          onChange={onPeriodChange}
          className={fieldClass}
        />
      </label>
      <label className={labelClass}>
        <HintLabel text="Multiplier" required />
        <GroupedNumberInput
          name={`${prefix}Multiplier`}
          value={multiplier}
          onChange={onMultiplierChange}
          allowDecimal
          className={fieldClass}
        />
      </label>
      <label className={labelClass}>
        <HintLabel text="Timeframe" required />
        <select
          name={`${prefix}Timeframe`}
          value={timeframe}
          onChange={(event) =>
            onTimeframeChange(event.target.value as DcaIndicatorTimeframe)
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
      <label className={labelClass}>
        <HintLabel text="When" required />
        <select
          name={`${prefix}Compare`}
          value={dcaIndicatorWhenValue(trendKind, side, compare)}
          onChange={(event) => onCompareChange(event.target.value)}
          className={fieldClass}
        >
          {whenOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
