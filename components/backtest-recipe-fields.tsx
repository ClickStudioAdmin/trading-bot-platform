"use client";

import { useEffect, useRef, useState } from "react";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import type { BacktestRecipe } from "@/lib/backtest/model";
import {
  userBacktestFieldIssues,
  type BacktestFieldIssue,
} from "@/lib/backtest/library";
import { emptyFuturesTpsl } from "@/lib/futures/tpsl";
import {
  DCA_INDICATOR_KIND_OPTIONS,
  DCA_TREND_KIND_OPTIONS,
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DEFAULT_DCA_SUPERTREND_PERIOD,
  DCA_INDICATOR_TIMEFRAMES,
  DCA_INDICATOR_TIMEFRAME_LABELS,
  defaultDcaIndicatorLevel,
  defaultDcaIndicatorPeriod,
  defaultDcaIndicatorSlowPeriod,
  dcaIndicatorIsLegacyEmaPrice,
  dcaIndicatorShowsLevel,
  dcaIndicatorUsesPairPeriods,
  dcaIndicatorUsesPeriod,
  dcaIndicatorWhenOptions,
  dcaIndicatorWhenValue,
  indicatorCompareForDirection,
  oppositeIndicatorCompare,
  oppositeRsiCompare,
  oppositeRsiLevel,
  parseDcaIndicatorCompare,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import { DcaFilterBlock } from "@/components/dca-filter-fields";
import type { DcaTemplateRecipe } from "@/lib/templates/recipe";
import {
  formatGroupedNumberInput,
  parseTypedDecimalInput,
} from "@/lib/paper/open";

const fieldClass =
  "mt-1 w-full rounded-control border border-line bg-canvas px-3 py-2 text-sm text-ink";
const invalidFieldClass = `${fieldClass} border-danger`;
const labelClass = "block text-xs text-ink-muted";

function issueFor(
  issues: BacktestFieldIssue[],
  field: BacktestFieldIssue["field"],
): string | null {
  return issues.find((row) => row.field === field)?.message ?? null;
}

function seedBothStarts(recipe: DcaTemplateRecipe): Partial<DcaTemplateRecipe> {
  const kind = recipe.indicatorKind ?? "rsi";
  const compare = recipe.indicatorCompare ?? null;
  const next: Partial<DcaTemplateRecipe> = {};
  if (recipe.startKind === "price" && recipe.armTrigger && !recipe.shortArmTrigger) {
    next.shortArmTrigger = {
      triggerBy: recipe.armTrigger.triggerBy,
      compare: recipe.armTrigger.compare === "gte" ? "lte" : "gte",
      price: recipe.armTrigger.price,
    };
  }
  if (
    (recipe.startKind === "indicator" || recipe.startKind === "trend") &&
    !recipe.shortIndicatorKind
  ) {
    next.shortIndicatorKind = kind;
    next.shortIndicatorTimeframe = recipe.indicatorTimeframe ?? "15";
    next.shortIndicatorCompare = parseDcaIndicatorCompare(
      oppositeIndicatorCompare(kind, compare ?? ""),
    );
    next.shortIndicatorLevel =
      kind === "rsi" ? oppositeRsiLevel(recipe.indicatorLevel) : recipe.indicatorLevel;
    next.shortIndicatorPeriod =
      dcaIndicatorUsesPeriod(kind) || dcaIndicatorUsesPairPeriods(kind)
        ? (recipe.indicatorPeriod ?? defaultDcaIndicatorPeriod(kind))
        : recipe.indicatorPeriod;
    next.shortIndicatorSlowPeriod = dcaIndicatorUsesPairPeriods(kind)
      ? (recipe.indicatorSlowPeriod ?? defaultDcaIndicatorSlowPeriod(kind))
      : recipe.indicatorSlowPeriod;
    next.shortIndicatorMultiplier =
      kind === "supertrend"
        ? (recipe.indicatorMultiplier ?? DEFAULT_DCA_SUPERTREND_MULTIPLIER)
        : recipe.indicatorMultiplier;
  }
  return next;
}

function FieldNote({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return <span className="mt-1 block text-xs text-danger">{message}</span>;
}

function displayCommitted(
  value: number | null | undefined,
  allowDecimal: boolean,
  allowNegative = false,
): string {
  if (value == null) {
    return "";
  }
  return formatGroupedNumberInput(String(value), allowDecimal, allowNegative);
}

function RecipeNumberInput({
  value,
  onCommit,
  allowDecimal = true,
  allowNegative = false,
  emptyValue,
  skipEmptyCommit = false,
  className,
}: {
  value: number | null | undefined;
  onCommit: (next: number | null) => void;
  allowDecimal?: boolean;
  allowNegative?: boolean;
  emptyValue: number | null;
  skipEmptyCommit?: boolean;
  className: string;
}) {
  const [text, setText] = useState(() =>
    displayCommitted(value, allowDecimal, allowNegative),
  );
  const lastSent = useRef(value);

  useEffect(() => {
    if (value === lastSent.current) {
      return;
    }
    lastSent.current = value;
    setText(displayCommitted(value, allowDecimal, allowNegative));
  }, [allowDecimal, allowNegative, value]);

  return (
    <GroupedNumberInput
      value={text}
      allowDecimal={allowDecimal}
      allowNegative={allowNegative}
      className={className}
      onChange={(next) => {
        setText(next);
        const parsed = parseTypedDecimalInput(next);
        if (parsed.incomplete) {
          return;
        }
        if (parsed.value == null) {
          if (skipEmptyCommit) {
            return;
          }
          lastSent.current = emptyValue;
          onCommit(emptyValue);
          return;
        }
        lastSent.current = parsed.value;
        onCommit(parsed.value);
      }}
    />
  );
}

function BacktestPriceStartFields({
  compare,
  price,
  priceIssue,
  onCompare,
  onPrice,
}: {
  compare: "gte" | "lte";
  price: number | null;
  priceIssue: string | null;
  onCompare: (compare: "gte" | "lte") => void;
  onPrice: (price: number | null) => void;
}) {
  return (
    <>
      <label className={labelClass}>
        When
        <select
          value={compare}
          onChange={(event) =>
            onCompare(event.target.value === "lte" ? "lte" : "gte")
          }
          className={fieldClass}
        >
          <option value="gte">Price ≥</option>
          <option value="lte">Price ≤</option>
        </select>
      </label>
      <label className={labelClass}>
        Price
        <RecipeNumberInput
          value={price}
          emptyValue={0}
          className={priceIssue ? invalidFieldClass : fieldClass}
          onCommit={onPrice}
        />
        <FieldNote message={priceIssue} />
      </label>
    </>
  );
}

function BacktestIndicatorStartFields({
  side,
  kind,
  timeframe,
  compare,
  level,
  period,
  slowPeriod,
  onChange,
}: {
  side: "long" | "short";
  kind: DcaIndicatorKind;
  timeframe: DcaIndicatorTimeframe;
  compare: DcaTemplateRecipe["indicatorCompare"];
  level: number | null | undefined;
  period: number | null | undefined;
  slowPeriod: number | null | undefined;
  onChange: (patch: {
    indicatorKind: DcaIndicatorKind;
    indicatorTimeframe?: DcaIndicatorTimeframe;
    indicatorCompare: DcaTemplateRecipe["indicatorCompare"];
    indicatorLevel?: number | null;
    indicatorPeriod?: number | null;
    indicatorSlowPeriod?: number | null;
  }) => void;
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
      When
      <select
        value={dcaIndicatorWhenValue(kind, side, compare, level)}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "legacy") {
            onChange({
              indicatorKind: kind,
              indicatorCompare: "cross_gte",
              indicatorLevel: level ?? null,
              indicatorPeriod: period ?? null,
              indicatorSlowPeriod: null,
            });
            return;
          }
          onChange({
            indicatorKind: kind,
            indicatorCompare: parseDcaIndicatorCompare(next),
            indicatorLevel: kind === "ema_cross" ? null : (level ?? null),
            indicatorPeriod: period ?? null,
            indicatorSlowPeriod: slowPeriod ?? null,
          });
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
      Indicator
      <select
        value={kind}
        onChange={(event) => {
          const indicatorKind = event.target.value as DcaIndicatorKind;
          const nextCompare = indicatorCompareForDirection(
            side,
            indicatorKind,
            "",
          );
          onChange({
            indicatorKind,
            indicatorCompare:
              nextCompare === "pair"
                ? null
                : parseDcaIndicatorCompare(nextCompare),
            indicatorLevel: defaultDcaIndicatorLevel(indicatorKind),
            indicatorPeriod:
              dcaIndicatorUsesPeriod(indicatorKind) ||
              dcaIndicatorUsesPairPeriods(indicatorKind)
                ? defaultDcaIndicatorPeriod(indicatorKind)
                : null,
            indicatorSlowPeriod: defaultDcaIndicatorSlowPeriod(indicatorKind),
          });
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
      Timeframe
      <select
        value={timeframe}
        onChange={(event) =>
          onChange({
            indicatorKind: kind,
            indicatorTimeframe: event.target.value as DcaIndicatorTimeframe,
            indicatorCompare: compare ?? null,
            indicatorLevel: level ?? null,
            indicatorPeriod: period ?? null,
            indicatorSlowPeriod: slowPeriod ?? null,
          })
        }
        className={fieldClass}
      >
        {DCA_INDICATOR_TIMEFRAMES.map((row) => (
          <option key={row} value={row}>
            {DCA_INDICATOR_TIMEFRAME_LABELS[row]}
          </option>
        ))}
      </select>
    </label>
  );
  const pairFields = (
    <>
      <label className={labelClass}>
        Fast
        <RecipeNumberInput
          value={period}
          emptyValue={defaultDcaIndicatorPeriod(kind)}
          allowDecimal={false}
          className={fieldClass}
          onCommit={(next) =>
            onChange({
              indicatorKind: kind,
              indicatorCompare: compare ?? null,
              indicatorPeriod: next ?? defaultDcaIndicatorPeriod(kind),
              indicatorSlowPeriod: slowPeriod ?? defaultDcaIndicatorSlowPeriod(kind),
            })
          }
        />
      </label>
      {whenField}
      <label className={labelClass}>
        Slow
        <RecipeNumberInput
          value={slowPeriod}
          emptyValue={defaultDcaIndicatorSlowPeriod(kind)}
          allowDecimal={false}
          className={fieldClass}
          onCommit={(next) =>
            onChange({
              indicatorKind: kind,
              indicatorCompare: compare ?? null,
              indicatorPeriod: period ?? defaultDcaIndicatorPeriod(kind),
              indicatorSlowPeriod:
                next ?? defaultDcaIndicatorSlowPeriod(kind),
            })
          }
        />
      </label>
    </>
  );
  const periodField = dcaIndicatorUsesPeriod(kind) ? (
    <label className={labelClass}>
      Period
      <RecipeNumberInput
        value={period}
        emptyValue={defaultDcaIndicatorPeriod(kind)}
        allowDecimal={false}
        className={fieldClass}
        onCommit={(next) =>
          onChange({
            indicatorKind: kind,
            indicatorCompare: compare ?? null,
            indicatorPeriod: next ?? defaultDcaIndicatorPeriod(kind),
            indicatorSlowPeriod: null,
          })
        }
      />
    </label>
  ) : null;
  const levelField = dcaIndicatorShowsLevel(kind, compare, level) ? (
    <label className={labelClass}>
      {kind === "ema_cross" ? "Level (price)" : "Level"}
      <RecipeNumberInput
        value={level}
        emptyValue={kind === "macd" ? 0 : null}
        allowNegative={kind === "macd"}
        className={fieldClass}
        onCommit={(next) =>
          onChange({
            indicatorKind: kind,
            indicatorCompare: compare ?? null,
            indicatorLevel: next ?? (kind === "macd" ? 0 : null),
            indicatorPeriod: period ?? null,
            indicatorSlowPeriod: slowPeriod ?? null,
          })
        }
      />
    </label>
  ) : null;
  return (
    <>
      {showPairPeriods ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:col-span-2 sm:grid-cols-5">
          {indicatorField}
          {timeframeField}
          {pairFields}
        </div>
      ) : kind === "rsi" ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:col-span-2 sm:grid-cols-5">
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

function BacktestTrendStartFields({
  side,
  timeframe,
  compare,
  period,
  multiplier,
  onChange,
}: {
  side: "long" | "short";
  timeframe: DcaIndicatorTimeframe;
  compare: DcaTemplateRecipe["indicatorCompare"];
  period: number | null | undefined;
  multiplier: number | null | undefined;
  onChange: (patch: Partial<DcaTemplateRecipe>) => void;
}) {
  const whenOptions = dcaIndicatorWhenOptions("supertrend", side, false);
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:col-span-2 sm:grid-cols-5">
      <label className={labelClass}>
        Trend
        <select
          value="supertrend"
          onChange={() => undefined}
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
        Period
        <RecipeNumberInput
          value={period}
          emptyValue={DEFAULT_DCA_SUPERTREND_PERIOD}
          allowDecimal={false}
          className={fieldClass}
          onCommit={(next) =>
            onChange({
              indicatorKind: "supertrend",
              indicatorPeriod: next ?? DEFAULT_DCA_SUPERTREND_PERIOD,
              indicatorMultiplier:
                multiplier ?? DEFAULT_DCA_SUPERTREND_MULTIPLIER,
            })
          }
        />
      </label>
      <label className={labelClass}>
        Multiplier
        <RecipeNumberInput
          value={multiplier}
          emptyValue={DEFAULT_DCA_SUPERTREND_MULTIPLIER}
          className={fieldClass}
          onCommit={(next) =>
            onChange({
              indicatorKind: "supertrend",
              indicatorPeriod: period ?? DEFAULT_DCA_SUPERTREND_PERIOD,
              indicatorMultiplier:
                next ?? DEFAULT_DCA_SUPERTREND_MULTIPLIER,
            })
          }
        />
      </label>
      <label className={labelClass}>
        Timeframe
        <select
          value={timeframe}
          onChange={(event) =>
            onChange({
              indicatorKind: "supertrend",
              indicatorTimeframe: event.target.value as DcaIndicatorTimeframe,
            })
          }
          className={fieldClass}
        >
          {DCA_INDICATOR_TIMEFRAMES.map((row) => (
            <option key={row} value={row}>
              {DCA_INDICATOR_TIMEFRAME_LABELS[row]}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        When
        <select
          value={dcaIndicatorWhenValue("supertrend", side, compare)}
          onChange={(event) =>
            onChange({
              indicatorKind: "supertrend",
              indicatorCompare: parseDcaIndicatorCompare(event.target.value),
            })
          }
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

export function BacktestRecipeFields({
  recipe,
  onChange,
  onIssuesChange,
}: {
  recipe: BacktestRecipe;
  onChange: (next: BacktestRecipe) => void;
  onIssuesChange?: (issues: string[]) => void;
}) {
  const [maxValueMode, setMaxValueMode] = useState<
    "none" | "usdt" | "percent" | "margin"
  >(
    () =>
      recipe.kind === "dca" && recipe.maxValue != null
        ? recipe.maxValueKind === "percent" || recipe.maxValueKind === "margin"
          ? recipe.maxValueKind
          : "usdt"
        : "none",
  );
  const maxValueIssue =
    recipe.kind === "dca" &&
    maxValueMode !== "none" &&
    !(Number(recipe.maxValue) > 0)
      ? "Enter a max value."
      : recipe.kind === "dca" &&
          (maxValueMode === "percent" || maxValueMode === "margin") &&
          Number(recipe.maxValue) > 100
        ? "Percent must be 100 or less."
        : null;
  useEffect(() => {
    onIssuesChange?.(maxValueIssue ? [maxValueIssue] : []);
  }, [maxValueIssue, onIssuesChange]);
  useEffect(() => {
    if (recipe.kind !== "dca" || recipe.direction !== "both") {
      return;
    }
    const seeded = seedBothStarts(recipe);
    if (Object.keys(seeded).length === 0) {
      return;
    }
    onChange({ ...recipe, ...seeded });
  }, [onChange, recipe]);
  const issues = userBacktestFieldIssues(recipe);
  if (recipe.kind === "dca") {
    const startBlocked =
      recipe.startKind === "immediate" || recipe.startKind === "webhook";
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`${labelClass} sm:col-span-2`}>
          Name
          <input
            value={recipe.name}
            onChange={(event) =>
              onChange({ ...recipe, name: event.target.value })
            }
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Direction
          <select
            value={recipe.direction}
            onChange={(event) => {
              const direction = event.target
                .value as typeof recipe.direction;
              if (direction === "both") {
                onChange({
                  ...recipe,
                  direction,
                  ...seedBothStarts(recipe),
                });
                return;
              }
              onChange({
                ...recipe,
                direction,
              });
            }}
            className={fieldClass}
          >
            <option value="long">Long</option>
            <option value="short">Short</option>
            <option value="both">Both</option>
          </select>
        </label>
        <label className={labelClass}>
          Start
          <select
            value={startBlocked ? "" : recipe.startKind}
            onChange={(event) => {
              const startKind = event.target.value as
                | "price"
                | "indicator"
                | "trend";
              const next = {
                ...recipe,
                startKind,
                ...(startKind === "trend"
                  ? {
                      indicatorKind: "supertrend" as const,
                      indicatorPeriod: DEFAULT_DCA_SUPERTREND_PERIOD,
                      indicatorMultiplier: DEFAULT_DCA_SUPERTREND_MULTIPLIER,
                      indicatorCompare: "cross_gte" as const,
                      indicatorLevel: null,
                    }
                  : {}),
              };
              onChange({
                ...next,
                ...(recipe.direction === "both" ? seedBothStarts(next) : {}),
              });
            }}
            className={
              issueFor(issues, "startKind") ? invalidFieldClass : fieldClass
            }
          >
            {startBlocked ? (
              <option value="">Select a start</option>
            ) : null}
            <option value="price">Price</option>
            <option value="indicator">Indicator</option>
            <option value="trend">Trend</option>
          </select>
          <FieldNote message={issueFor(issues, "startKind")} />
        </label>
        {recipe.startKind === "price" && recipe.direction === "both" ? (
          <>
            <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint sm:col-span-2">
              Long start
            </p>
            <BacktestPriceStartFields
              compare={recipe.armTrigger?.compare ?? "gte"}
              price={recipe.armTrigger?.price ?? null}
              priceIssue={issueFor(issues, "armPrice")}
              onCompare={(compare) =>
                onChange({
                  ...recipe,
                  armTrigger: {
                    triggerBy: recipe.armTrigger?.triggerBy ?? "last",
                    compare,
                    price: recipe.armTrigger?.price ?? 0,
                  },
                })
              }
              onPrice={(price) =>
                onChange({
                  ...recipe,
                  armTrigger: {
                    triggerBy: recipe.armTrigger?.triggerBy ?? "last",
                    compare: recipe.armTrigger?.compare ?? "gte",
                    price: price ?? 0,
                  },
                })
              }
            />
            <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint sm:col-span-2">
              Short start
            </p>
            <BacktestPriceStartFields
              compare={
                recipe.shortArmTrigger?.compare ??
                (recipe.armTrigger?.compare === "gte" ? "lte" : "gte")
              }
              price={
                recipe.shortArmTrigger?.price ??
                recipe.armTrigger?.price ??
                null
              }
              priceIssue={issueFor(issues, "shortArmPrice")}
              onCompare={(compare) =>
                onChange({
                  ...recipe,
                  shortArmTrigger: {
                    triggerBy:
                      recipe.shortArmTrigger?.triggerBy ??
                      recipe.armTrigger?.triggerBy ??
                      "last",
                    compare,
                    price: recipe.shortArmTrigger?.price ?? 0,
                  },
                })
              }
              onPrice={(price) =>
                onChange({
                  ...recipe,
                  shortArmTrigger: {
                    triggerBy:
                      recipe.shortArmTrigger?.triggerBy ??
                      recipe.armTrigger?.triggerBy ??
                      "last",
                    compare: recipe.shortArmTrigger?.compare ?? "lte",
                    price: price ?? 0,
                  },
                })
              }
            />
          </>
        ) : null}
        {recipe.startKind === "price" && recipe.direction !== "both" ? (
          <BacktestPriceStartFields
            compare={recipe.armTrigger?.compare ?? "gte"}
            price={recipe.armTrigger?.price ?? null}
            priceIssue={issueFor(issues, "armPrice")}
            onCompare={(compare) =>
              onChange({
                ...recipe,
                armTrigger: {
                  triggerBy: recipe.armTrigger?.triggerBy ?? "last",
                  compare,
                  price: recipe.armTrigger?.price ?? 0,
                },
              })
            }
            onPrice={(price) =>
              onChange({
                ...recipe,
                armTrigger: {
                  triggerBy: recipe.armTrigger?.triggerBy ?? "last",
                  compare: recipe.armTrigger?.compare ?? "gte",
                  price: price ?? 0,
                },
              })
            }
          />
        ) : null}
        {recipe.startKind === "indicator" && recipe.direction === "both" ? (
          <>
            <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint sm:col-span-2">
              Long start
            </p>
            <BacktestIndicatorStartFields
              side="long"
              kind={recipe.indicatorKind ?? "rsi"}
              timeframe={recipe.indicatorTimeframe ?? "15"}
              compare={recipe.indicatorCompare}
              level={recipe.indicatorLevel}
              period={recipe.indicatorPeriod}
              slowPeriod={recipe.indicatorSlowPeriod}
              onChange={(patch) => onChange({ ...recipe, ...patch })}
            />
            <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint sm:col-span-2">
              Short start
            </p>
            <BacktestIndicatorStartFields
              side="short"
              kind={recipe.shortIndicatorKind ?? recipe.indicatorKind ?? "rsi"}
              timeframe={
                recipe.shortIndicatorTimeframe ??
                recipe.indicatorTimeframe ??
                "15"
              }
              compare={
                recipe.shortIndicatorCompare ??
                (recipe.indicatorKind === "rsi"
                  ? parseDcaIndicatorCompare(
                      oppositeRsiCompare(
                        recipe.indicatorCompare ?? "cross_lte",
                      ),
                    )
                  : recipe.indicatorCompare)
              }
              level={
                recipe.shortIndicatorLevel ??
                (recipe.indicatorKind === "rsi"
                  ? oppositeRsiLevel(recipe.indicatorLevel)
                  : recipe.indicatorLevel)
              }
              period={
                recipe.shortIndicatorPeriod ?? recipe.indicatorPeriod
              }
              slowPeriod={
                recipe.shortIndicatorSlowPeriod ?? recipe.indicatorSlowPeriod
              }
              onChange={(patch) =>
                onChange({
                  ...recipe,
                  shortIndicatorKind: patch.indicatorKind,
                  shortIndicatorTimeframe: patch.indicatorTimeframe,
                  shortIndicatorCompare: patch.indicatorCompare,
                  shortIndicatorLevel: patch.indicatorLevel,
                  shortIndicatorPeriod: patch.indicatorPeriod,
                  shortIndicatorSlowPeriod: patch.indicatorSlowPeriod,
                })
              }
            />
          </>
        ) : null}
        {recipe.startKind === "indicator" && recipe.direction !== "both" ? (
          <BacktestIndicatorStartFields
            side={recipe.direction === "short" ? "short" : "long"}
            kind={recipe.indicatorKind ?? "rsi"}
            timeframe={recipe.indicatorTimeframe ?? "15"}
            compare={recipe.indicatorCompare}
            level={recipe.indicatorLevel}
            period={recipe.indicatorPeriod}
            slowPeriod={recipe.indicatorSlowPeriod}
            onChange={(patch) => onChange({ ...recipe, ...patch })}
          />
        ) : null}
        {recipe.startKind === "trend" && recipe.direction === "both" ? (
          <>
            <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint sm:col-span-2">
              Long start
            </p>
            <BacktestTrendStartFields
              side="long"
              timeframe={recipe.indicatorTimeframe ?? "15"}
              compare={recipe.indicatorCompare}
              period={recipe.indicatorPeriod}
              multiplier={recipe.indicatorMultiplier}
              onChange={(patch) => onChange({ ...recipe, ...patch })}
            />
            <p className="text-[11px] uppercase tracking-[0.08em] text-ink-faint sm:col-span-2">
              Short start
            </p>
            <BacktestTrendStartFields
              side="short"
              timeframe={
                recipe.shortIndicatorTimeframe ??
                recipe.indicatorTimeframe ??
                "15"
              }
              compare={
                recipe.shortIndicatorCompare ?? recipe.indicatorCompare
              }
              period={
                recipe.shortIndicatorPeriod ?? recipe.indicatorPeriod
              }
              multiplier={
                recipe.shortIndicatorMultiplier ?? recipe.indicatorMultiplier
              }
              onChange={(patch) =>
                onChange({
                  ...recipe,
                  shortIndicatorKind: "supertrend",
                  shortIndicatorTimeframe: patch.indicatorTimeframe,
                  shortIndicatorCompare: patch.indicatorCompare,
                  shortIndicatorPeriod: patch.indicatorPeriod,
                  shortIndicatorMultiplier: patch.indicatorMultiplier,
                })
              }
            />
          </>
        ) : null}
        {recipe.startKind === "trend" && recipe.direction !== "both" ? (
          <BacktestTrendStartFields
            side={recipe.direction === "short" ? "short" : "long"}
            timeframe={recipe.indicatorTimeframe ?? "15"}
            compare={recipe.indicatorCompare}
            period={recipe.indicatorPeriod}
            multiplier={recipe.indicatorMultiplier}
            onChange={(patch) =>
              onChange({ ...recipe, indicatorKind: "supertrend", ...patch })
            }
          />
        ) : null}
        {recipe.direction === "both" ? (
          <>
            <DcaFilterBlock
              label="Long confirm"
              prefix="confirm"
              side="long"
              spec={recipe.confirm ?? null}
              onChange={(next) => onChange({ ...recipe, confirm: next })}
              fieldClass={fieldClass}
              labelClass={labelClass}
            />
            <DcaFilterBlock
              label="Short confirm"
              prefix="shortConfirm"
              side="short"
              spec={recipe.shortConfirm ?? null}
              onChange={(next) => onChange({ ...recipe, shortConfirm: next })}
              fieldClass={fieldClass}
              labelClass={labelClass}
            />
          </>
        ) : (
          <DcaFilterBlock
            label="Confirm"
            prefix="confirm"
            side={recipe.direction === "short" ? "short" : "long"}
            spec={recipe.confirm ?? null}
            onChange={(next) => onChange({ ...recipe, confirm: next })}
            fieldClass={fieldClass}
            labelClass={labelClass}
          />
        )}
        {recipe.maxValue != null &&
        recipe.maxValue > 0 &&
        recipe.maxClips != null &&
        recipe.maxClips > 0 ? null : (
        <label className={labelClass}>
          Clip
          <RecipeNumberInput
            value={recipe.clipSize}
            emptyValue={0}
            className={
              issueFor(issues, "clipSize") ? invalidFieldClass : fieldClass
            }
            onCommit={(next) =>
              onChange({ ...recipe, clipSize: next ?? 0 })
            }
          />
          <FieldNote message={issueFor(issues, "clipSize")} />
        </label>
        )}
        <label className={labelClass}>
          Size unit
          <select
            value={recipe.sizeUnit}
            onChange={(event) =>
              onChange({
                ...recipe,
                sizeUnit: event.target.value === "usdt" ? "usdt" : "qty",
              })
            }
            className={fieldClass}
          >
            <option value="qty">Qty</option>
            <option value="usdt">USDT</option>
          </select>
        </label>
        <label className={labelClass}>
          Size multiplier
          <RecipeNumberInput
            value={recipe.sizeMultiplier}
            emptyValue={1}
            className={fieldClass}
            onCommit={(next) =>
              onChange({ ...recipe, sizeMultiplier: next ?? 1 })
            }
          />
        </label>
        <label className={labelClass}>
          Spacing
          <select
            value={recipe.spacingKind ?? "percent"}
            onChange={(event) =>
              onChange({
                ...recipe,
                spacingKind: event.target.value === "atr" ? "atr" : "percent",
                atrPeriod:
                  event.target.value === "atr"
                    ? (recipe.atrPeriod ?? 14)
                    : recipe.atrPeriod,
                atrSpacingMult:
                  event.target.value === "atr"
                    ? (recipe.atrSpacingMult ?? 1)
                    : recipe.atrSpacingMult,
              })
            }
            className={fieldClass}
          >
            <option value="percent">Percentage</option>
            <option value="atr">ATR</option>
          </select>
        </label>
        {(recipe.spacingKind ?? "percent") === "percent" ? (
        <label className={labelClass}>
          Deviation
          <RecipeNumberInput
            value={recipe.dipPct}
            emptyValue={null}
            className={fieldClass}
            onCommit={(next) => onChange({ ...recipe, dipPct: next })}
          />
        </label>
        ) : (
        <>
        <label className={labelClass}>
          ATR period
          <RecipeNumberInput
            value={recipe.atrPeriod}
            emptyValue={14}
            allowDecimal={false}
            className={fieldClass}
            onCommit={(next) =>
              onChange({
                ...recipe,
                atrPeriod: next == null ? 14 : Math.trunc(next),
              })
            }
          />
        </label>
        <label className={labelClass}>
          ATR spacing
          <RecipeNumberInput
            value={recipe.atrSpacingMult}
            emptyValue={1}
            className={fieldClass}
            onCommit={(next) =>
              onChange({ ...recipe, atrSpacingMult: next ?? 1 })
            }
          />
        </label>
        </>
        )}
        <label className={labelClass}>
          Max clips
          <RecipeNumberInput
            value={recipe.maxClips}
            emptyValue={null}
            allowDecimal={false}
            className={fieldClass}
            onCommit={(next) =>
              onChange({
                ...recipe,
                maxClips: next == null ? null : Math.trunc(next),
              })
            }
          />
        </label>
        <label className={labelClass}>
          Max value
          <select
            value={maxValueMode}
            onChange={(event) => {
              const next = event.target.value;
              if (next === "none") {
                setMaxValueMode("none");
                onChange({
                  ...recipe,
                  maxValue: null,
                  maxValueKind: "usdt",
                });
                return;
              }
              const kind =
                next === "percent" || next === "margin" ? next : "usdt";
              setMaxValueMode(kind);
              onChange({ ...recipe, maxValueKind: kind });
            }}
            className={fieldClass}
          >
            <option value="usdt">Fixed USDT</option>
            <option value="percent">% of account</option>
            <option value="margin">% of available margin</option>
            <option value="none">No max value</option>
          </select>
        </label>
        {maxValueMode !== "none" ? (
          <label className={labelClass}>
            {maxValueMode === "percent" || maxValueMode === "margin"
              ? "Percent"
              : "Amount"}
            <RecipeNumberInput
              value={recipe.maxValue}
              emptyValue={null}
              className={maxValueIssue ? invalidFieldClass : fieldClass}
              onCommit={(next) => onChange({ ...recipe, maxValue: next })}
            />
            <FieldNote message={maxValueIssue} />
          </label>
        ) : null}
        <label className={labelClass}>
          Take profit
          <select
            value={recipe.takeProfitKind ?? "percent"}
            onChange={(event) =>
              onChange({
                ...recipe,
                takeProfitKind:
                  event.target.value === "atr" ? "atr" : "percent",
                atrPeriod:
                  event.target.value === "atr"
                    ? (recipe.atrPeriod ?? 14)
                    : recipe.atrPeriod,
                takeProfitAtrMult:
                  event.target.value === "atr"
                    ? (recipe.takeProfitAtrMult ?? 2)
                    : recipe.takeProfitAtrMult,
              })
            }
            className={fieldClass}
          >
            <option value="percent">Percentage</option>
            <option value="atr">ATR × multiplier</option>
          </select>
        </label>
        {(recipe.takeProfitKind ?? "percent") === "percent" ? (
        <label className={labelClass}>
          Take profit %
          <RecipeNumberInput
            value={recipe.takeProfitPct}
            emptyValue={null}
            className={fieldClass}
            onCommit={(next) => onChange({ ...recipe, takeProfitPct: next })}
          />
        </label>
        ) : (
        <>
        <label className={labelClass}>
          TP ATR multiple
          <RecipeNumberInput
            value={recipe.takeProfitAtrMult}
            emptyValue={2}
            className={fieldClass}
            onCommit={(next) =>
              onChange({ ...recipe, takeProfitAtrMult: next ?? 2 })
            }
          />
        </label>
        {(recipe.spacingKind ?? "percent") !== "atr" ? (
        <label className={labelClass}>
          ATR period
          <RecipeNumberInput
            value={recipe.atrPeriod}
            emptyValue={14}
            allowDecimal={false}
            className={fieldClass}
            onCommit={(next) =>
              onChange({
                ...recipe,
                atrPeriod: next == null ? 14 : Math.trunc(next),
              })
            }
          />
        </label>
        ) : null}
        </>
        )}
        <label className={labelClass}>
          Stop %
          <RecipeNumberInput
            value={recipe.stopLossPct}
            emptyValue={null}
            className={fieldClass}
            onCommit={(next) => onChange({ ...recipe, stopLossPct: next })}
          />
        </label>
        {recipe.direction === "both" ? (
          <>
            <DcaFilterBlock
              label="Long Exit-if"
              prefix="exitIf"
              side="long"
              spec={recipe.exitIf ?? null}
              onChange={(next) => onChange({ ...recipe, exitIf: next })}
              fieldClass={fieldClass}
              labelClass={labelClass}
            />
            <DcaFilterBlock
              label="Short Exit-if"
              prefix="shortExitIf"
              side="short"
              spec={recipe.shortExitIf ?? null}
              onChange={(next) => onChange({ ...recipe, shortExitIf: next })}
              fieldClass={fieldClass}
              labelClass={labelClass}
            />
          </>
        ) : (
          <DcaFilterBlock
            label="Exit-if"
            prefix="exitIf"
            side={recipe.direction === "short" ? "short" : "long"}
            spec={recipe.exitIf ?? null}
            onChange={(next) => onChange({ ...recipe, exitIf: next })}
            fieldClass={fieldClass}
            labelClass={labelClass}
          />
        )}
        <label className={labelClass}>
          Trailing %
          <RecipeNumberInput
            value={recipe.trailingPct}
            emptyValue={null}
            className={fieldClass}
            onCommit={(next) => onChange({ ...recipe, trailingPct: next })}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={`${labelClass} sm:col-span-2`}>
        Name
        <input
          value={recipe.name}
          onChange={(event) => onChange({ ...recipe, name: event.target.value })}
          className={fieldClass}
        />
      </label>
      <label className={labelClass}>
        Action
        <select
          value={
            recipe.formAction === "close_long" ||
            recipe.formAction === "close_short"
              ? ""
              : recipe.formAction
          }
          onChange={(event) =>
            onChange({
              ...recipe,
              formAction: event.target.value as typeof recipe.formAction,
            })
          }
          className={
            issueFor(issues, "formAction") ? invalidFieldClass : fieldClass
          }
        >
          {recipe.formAction === "close_long" ||
          recipe.formAction === "close_short" ? (
            <option value="">Select an action</option>
          ) : null}
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
        <FieldNote message={issueFor(issues, "formAction")} />
      </label>
      {recipe.entrySource === "webhook" ? (
        <label className={labelClass}>
          When
          <select
            value=""
            onChange={() => onChange({ ...recipe, entrySource: "price" })}
            className={invalidFieldClass}
          >
            <option value="">Select a When</option>
            <option value="price">Price</option>
          </select>
          <FieldNote message={issueFor(issues, "entrySource")} />
        </label>
      ) : null}
      <label className={labelClass}>
        Size
        <GroupedNumberInput
          value={formatGroupedNumberInput(recipe.size, true)}
          allowDecimal
          className={issueFor(issues, "size") ? invalidFieldClass : fieldClass}
          onChange={(next) =>
            onChange({ ...recipe, size: next.replace(/,/g, "") })
          }
        />
        <FieldNote message={issueFor(issues, "size")} />
      </label>
      <label className={labelClass}>
        Size unit
        <select
          value={recipe.sizeUnit}
          onChange={(event) =>
            onChange({
              ...recipe,
              sizeUnit: event.target.value === "usdt" ? "usdt" : "qty",
            })
          }
          className={fieldClass}
        >
          <option value="qty">Qty</option>
          <option value="usdt">USDT</option>
        </select>
      </label>
      {recipe.entrySource === "webhook" ? null : (
        <>
      <label className={labelClass}>
        When
        <select
          value={recipe.triggerCompare}
          onChange={(event) =>
            onChange({
              ...recipe,
              triggerCompare: event.target.value === "lte" ? "lte" : "gte",
            })
          }
          className={fieldClass}
        >
          <option value="gte">Price ≥</option>
          <option value="lte">Price ≤</option>
        </select>
      </label>
      <label className={labelClass}>
        Price
        <GroupedNumberInput
          value={formatGroupedNumberInput(recipe.triggerPrice, true)}
          allowDecimal
          className={
            issueFor(issues, "triggerPrice") ? invalidFieldClass : fieldClass
          }
          onChange={(next) =>
            onChange({ ...recipe, triggerPrice: next.replace(/,/g, "") })
          }
        />
        <FieldNote message={issueFor(issues, "triggerPrice")} />
      </label>
        </>
      )}
      <label className={labelClass}>
        Take profit
        <RecipeNumberInput
          value={recipe.tpsl?.takeProfit}
          emptyValue={null}
          className={fieldClass}
          onCommit={(next) =>
            onChange({
              ...recipe,
              tpsl: {
                ...(recipe.tpsl ?? emptyFuturesTpsl()),
                takeProfit: next,
              },
            })
          }
        />
      </label>
      <label className={labelClass}>
        Stop
        <RecipeNumberInput
          value={recipe.tpsl?.stopLoss}
          emptyValue={null}
          className={fieldClass}
          onCommit={(next) =>
            onChange({
              ...recipe,
              tpsl: {
                ...(recipe.tpsl ?? emptyFuturesTpsl()),
                stopLoss: next,
              },
            })
          }
        />
      </label>
      <label className={labelClass}>
        Trailing
        <RecipeNumberInput
          value={recipe.trailing?.distance}
          emptyValue={null}
          skipEmptyCommit
          className={fieldClass}
          onCommit={(next) => {
            if (next == null) {
              return;
            }
            onChange({
              ...recipe,
              trailing: {
                distance: next,
                activePrice: recipe.trailing?.activePrice ?? null,
                peak: recipe.trailing?.peak ?? null,
              },
            });
          }}
        />
      </label>
    </div>
  );
}
