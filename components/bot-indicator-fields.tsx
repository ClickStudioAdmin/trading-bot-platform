"use client";

import {
  HintLabel,
  botFieldClass,
  botCompactRowClass,
  botLabelClass,
  useBotColumnLayout,
} from "@/components/bot-form-chrome";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  DCA_INDICATOR_KIND_OPTIONS,
  DCA_TREND_KIND_OPTIONS,
  DEFAULT_DCA_ATR_BAND_MULT,
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
import { indicatorClaim } from "@/lib/strategy/conflicts";
import {
  choiceConflicts,
  type EntryConflictSlot,
} from "@/lib/strategy/expr";
import { AppSelect } from "@/components/app-select";

const fieldClass = botFieldClass;
const labelClass = botLabelClass;

type SeriesProps = {
  seriesSlots?: readonly EntryConflictSlot[];
  seriesIndex?: number;
};

function seededEntryClaim(
  side: "long" | "short",
  kind: DcaIndicatorKind,
  timeframe: DcaIndicatorTimeframe,
) {
  return indicatorClaim({
    surface: "entry",
    kind,
    timeframe,
    compare: indicatorCompareForDirection(side, kind, ""),
    level: kind === "rsi" ? "30" : kind === "macd" ? "0" : "",
    period: defaultDcaIndicatorPeriod(kind),
    slowPeriod: defaultDcaIndicatorSlowPeriod(kind),
    multiplier: kind === "atr_band" ? DEFAULT_DCA_ATR_BAND_MULT : "",
  });
}

function entrySeriesClaim(input: {
  kind: string;
  timeframe: unknown;
  compare: unknown;
  level?: unknown;
  period?: unknown;
  slowPeriod?: unknown;
  multiplier?: unknown;
}) {
  const compare = input.compare === "legacy" ? "cross_gte" : input.compare;
  const level =
    input.compare === "legacy" && String(input.level ?? "").trim() === ""
      ? "1"
      : input.level;
  return indicatorClaim({
    surface: "entry",
    kind: input.kind,
    timeframe: input.timeframe,
    compare,
    level,
    period: input.period,
    slowPeriod: input.slowPeriod,
    multiplier: input.multiplier,
  });
}

export function IndicatorStartFields({
  side,
  prefix,
  kind,
  timeframe,
  compare,
  level,
  period,
  slowPeriod,
  multiplier,
  onKindChange,
  onTimeframeChange,
  onCompareChange,
  onLevelChange,
  onPeriodChange,
  onSlowPeriodChange,
  onMultiplierChange,
  seriesSlots,
  seriesIndex,
}: {
  side: "long" | "short";
  prefix: string;
  kind: DcaIndicatorKind;
  timeframe: DcaIndicatorTimeframe;
  compare: string;
  level: string;
  period: string;
  slowPeriod: string;
  multiplier: string;
  onKindChange: (next: DcaIndicatorKind) => void;
  onTimeframeChange: (next: DcaIndicatorTimeframe) => void;
  onCompareChange: (next: string) => void;
  onLevelChange: (next: string) => void;
  onPeriodChange: (next: string) => void;
  onSlowPeriodChange: (next: string) => void;
  onMultiplierChange: (next: string) => void;
} & SeriesProps) {
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
  const currentWhen = dcaIndicatorWhenValue(kind, side, compare, level);
  function entryDisabled(
    claim: ReturnType<typeof indicatorClaim>,
    selected: boolean,
  ) {
    return choiceConflicts(seriesSlots, seriesIndex, claim, selected);
  }
  const showPairPeriods =
    dcaIndicatorUsesPairPeriods(kind) && !includeLegacyEmaPrice;
  const whenField = (
    <label className={labelClass}>
      <HintLabel text="When" required />
      <AppSelect
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
          <option
            key={option.value}
            value={option.value}
            disabled={entryDisabled(
              entrySeriesClaim({
                kind,
                timeframe,
                compare: option.value,
                level,
                period,
                slowPeriod,
                multiplier,
              }),
              option.value === currentWhen,
            )}
          >
            {option.label}
          </option>
        ))}
      </AppSelect>
    </label>
  );
  const indicatorField = (
    <label className={labelClass}>
      <HintLabel text="Indicator" required />
      <AppSelect
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
          if (next === "atr_band") {
            onPeriodChange(String(defaultDcaIndicatorPeriod(next)));
            onMultiplierChange(String(DEFAULT_DCA_ATR_BAND_MULT));
            onSlowPeriodChange("");
          } else if (dcaIndicatorUsesPairPeriods(next)) {
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
          <option
            key={option.value}
            value={option.value}
            disabled={entryDisabled(
              seededEntryClaim(side, option.value, timeframe),
              option.value === kind,
            )}
          >
            {option.label}
          </option>
        ))}
      </AppSelect>
    </label>
  );
  const timeframeField = (
    <label className={labelClass}>
      <HintLabel text="Timeframe" required />
      <AppSelect
        name={`${prefix}Timeframe`}
        value={timeframe}
        onChange={(event) =>
          onTimeframeChange(event.target.value as DcaIndicatorTimeframe)
        }
        className={fieldClass}
      >
        {DCA_INDICATOR_TIMEFRAMES.map((interval) => (
          <option
            key={interval}
            value={interval}
            disabled={entryDisabled(
              entrySeriesClaim({
                kind,
                timeframe: interval,
                compare,
                level,
                period,
                slowPeriod,
                multiplier,
              }),
              interval === timeframe,
            )}
          >
            {DCA_INDICATOR_TIMEFRAME_LABELS[interval]}
          </option>
        ))}
      </AppSelect>
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
  const column = useBotColumnLayout();
  const compactGrid = `col-span-full ${botCompactRowClass}`;
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
  const multiplierField = kind === "atr_band" ? (
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
  ) : null;
  return (
    <>
      {showPairPeriods ? (
        <div
          className={
            column
              ? compactGrid
              : "col-span-full grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-[minmax(0,1.1fr)_6.5rem_6.5rem_minmax(16rem,2fr)_6.5rem]"
          }
        >
          {indicatorField}
          {timeframeField}
          {pairFields}
        </div>
      ) : kind === "atr_band" ? (
        <div
          className={
            column
              ? compactGrid
              : "col-span-full grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-[minmax(0,1.1fr)_6.5rem_6.5rem_6.5rem_minmax(0,2.4fr)]"
          }
        >
          {indicatorField}
          {periodField}
          {multiplierField}
          {timeframeField}
          {whenField}
        </div>
      ) : kind === "rsi" ? (
        <div
          className={
            column
              ? compactGrid
              : "col-span-full grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-[minmax(0,1.1fr)_6.5rem_6.5rem_minmax(16rem,2fr)_6.5rem]"
          }
        >
          {indicatorField}
          {periodField}
          {timeframeField}
          {whenField}
          {levelField}
        </div>
      ) : (
        <div
          className={
            column
              ? compactGrid
              : levelField && !periodField
                ? "col-span-full grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-[minmax(0,1.1fr)_6.5rem_minmax(12rem,1.6fr)_6.5rem]"
                : levelField
                  ? "col-span-full grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-[minmax(0,1.1fr)_6.5rem_6.5rem_minmax(16rem,2fr)_6.5rem]"
                  : "col-span-full grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-[minmax(0,1.1fr)_6.5rem_6.5rem_minmax(16rem,2.4fr)]"
          }
        >
          {indicatorField}
          {periodField}
          {timeframeField}
          {whenField}
          {levelField}
        </div>
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
  seriesSlots,
  seriesIndex,
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
} & SeriesProps) {
  const trendKind = kind === "supertrend" ? kind : "supertrend";
  const column = useBotColumnLayout();
  const whenOptions = dcaIndicatorWhenOptions(trendKind, side, false);
  const currentWhen = dcaIndicatorWhenValue(trendKind, side, compare);
  function trendDisabled(
    claim: ReturnType<typeof indicatorClaim>,
    selected: boolean,
  ) {
    return choiceConflicts(seriesSlots, seriesIndex, claim, selected);
  }
  return (
    <div
      className={
        column
          ? `col-span-full ${botCompactRowClass}`
          : "col-span-full grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-[minmax(0,1.1fr)_6.5rem_6.5rem_6.5rem_minmax(16rem,2fr)]"
      }
    >
      <label className={labelClass}>
        <HintLabel text="Trend" required />
        <AppSelect
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
        </AppSelect>
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
        <AppSelect
          name={`${prefix}Timeframe`}
          value={timeframe}
          onChange={(event) =>
            onTimeframeChange(event.target.value as DcaIndicatorTimeframe)
          }
          className={fieldClass}
        >
          {DCA_INDICATOR_TIMEFRAMES.map((interval) => (
            <option
              key={interval}
              value={interval}
              disabled={trendDisabled(
                entrySeriesClaim({
                  kind: trendKind,
                  timeframe: interval,
                  compare,
                  period,
                  multiplier,
                }),
                interval === timeframe,
              )}
            >
              {DCA_INDICATOR_TIMEFRAME_LABELS[interval]}
            </option>
          ))}
        </AppSelect>
      </label>
      <label className={labelClass}>
        <HintLabel text="When" required />
        <AppSelect
          name={`${prefix}Compare`}
          value={currentWhen}
          onChange={(event) => onCompareChange(event.target.value)}
          className={fieldClass}
        >
          {whenOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={trendDisabled(
                entrySeriesClaim({
                  kind: trendKind,
                  timeframe,
                  compare: option.value,
                  period,
                  multiplier,
                }),
                option.value === currentWhen,
              )}
            >
              {option.label}
            </option>
          ))}
        </AppSelect>
      </label>
    </div>
  );
}
