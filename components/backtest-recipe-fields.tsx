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
  DCA_INDICATOR_TIMEFRAMES,
  DCA_INDICATOR_TIMEFRAME_LABELS,
  indicatorCompareForDirection,
  oppositeRsiCompare,
  oppositeRsiLevel,
  parseDcaIndicatorCompare,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
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
  if (recipe.startKind === "indicator" && !recipe.shortIndicatorKind) {
    next.shortIndicatorKind = kind;
    next.shortIndicatorTimeframe = recipe.indicatorTimeframe ?? "15";
    next.shortIndicatorCompare =
      kind === "rsi"
        ? parseDcaIndicatorCompare(
            oppositeRsiCompare(compare ?? "cross_lte"),
          )
        : compare;
    next.shortIndicatorLevel =
      kind === "rsi" ? oppositeRsiLevel(recipe.indicatorLevel) : recipe.indicatorLevel;
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
): string {
  if (value == null) {
    return "";
  }
  return formatGroupedNumberInput(String(value), allowDecimal);
}

function RecipeNumberInput({
  value,
  onCommit,
  allowDecimal = true,
  emptyValue,
  skipEmptyCommit = false,
  className,
}: {
  value: number | null | undefined;
  onCommit: (next: number | null) => void;
  allowDecimal?: boolean;
  emptyValue: number | null;
  skipEmptyCommit?: boolean;
  className: string;
}) {
  const [text, setText] = useState(() => displayCommitted(value, allowDecimal));
  const lastSent = useRef(value);

  useEffect(() => {
    if (value === lastSent.current) {
      return;
    }
    lastSent.current = value;
    setText(displayCommitted(value, allowDecimal));
  }, [allowDecimal, value]);

  return (
    <GroupedNumberInput
      value={text}
      allowDecimal={allowDecimal}
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
  onChange,
}: {
  side: "long" | "short";
  kind: DcaIndicatorKind;
  timeframe: DcaIndicatorTimeframe;
  compare: DcaTemplateRecipe["indicatorCompare"];
  level: number | null | undefined;
  onChange: (patch: {
    indicatorKind: DcaIndicatorKind;
    indicatorTimeframe?: DcaIndicatorTimeframe;
    indicatorCompare: DcaTemplateRecipe["indicatorCompare"];
    indicatorLevel?: number | null;
  }) => void;
}) {
  return (
    <>
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
            });
          }}
          className={fieldClass}
        >
          <option value="rsi">RSI 14</option>
          <option value="macd">MACD</option>
          <option value="ema_cross">EMA 9/21</option>
        </select>
      </label>
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
          value={indicatorCompareForDirection(
            side,
            kind,
            kind === "ema_cross" && compare == null ? "pair" : (compare ?? ""),
          )}
          onChange={(event) => {
            const next = event.target.value;
            onChange({
              indicatorKind: kind,
              indicatorCompare:
                next === "pair" ? null : parseDcaIndicatorCompare(next),
              indicatorLevel: level ?? null,
            });
          }}
          className={fieldClass}
        >
          {kind === "rsi" && side === "long" ? (
            <>
              <option value="cross_lte">Crosses below</option>
              <option value="lte">At or below</option>
            </>
          ) : null}
          {kind === "rsi" && side === "short" ? (
            <>
              <option value="cross_gte">Crosses above</option>
              <option value="gte">At or above</option>
            </>
          ) : null}
          {kind === "macd" ? (
            <>
              <option value="cross_gte">Crosses zero</option>
              <option value="gte">Histogram sign</option>
            </>
          ) : null}
          {kind === "ema_cross" ? (
            <>
              <option value="pair">EMA 9/21 cross</option>
              <option value="cross_gte">EMA 21 crosses</option>
            </>
          ) : null}
        </select>
      </label>
      {kind === "rsi" || (kind === "ema_cross" && compare != null) ? (
        <label className={labelClass}>
          {kind === "ema_cross" ? "Level (price)" : "Level"}
          <RecipeNumberInput
            value={level}
            emptyValue={null}
            className={fieldClass}
            onCommit={(next) =>
              onChange({
                indicatorKind: kind,
                indicatorCompare: compare ?? null,
                indicatorLevel: next,
              })
            }
          />
        </label>
      ) : null}
    </>
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
              const kind = recipe.indicatorKind ?? "rsi";
              const nextCompare = indicatorCompareForDirection(
                direction,
                kind,
                recipe.indicatorKind === "ema_cross" &&
                  recipe.indicatorCompare == null
                  ? "pair"
                  : (recipe.indicatorCompare ?? ""),
              );
              onChange({
                ...recipe,
                direction,
                indicatorCompare:
                  nextCompare === "pair"
                    ? null
                    : (parseDcaIndicatorCompare(nextCompare) ??
                      recipe.indicatorCompare),
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
              const startKind = event.target.value as "price" | "indicator";
              const next = { ...recipe, startKind };
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
              onChange={(patch) =>
                onChange({
                  ...recipe,
                  shortIndicatorKind: patch.indicatorKind,
                  shortIndicatorTimeframe: patch.indicatorTimeframe,
                  shortIndicatorCompare: patch.indicatorCompare,
                  shortIndicatorLevel: patch.indicatorLevel,
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
            onChange={(patch) => onChange({ ...recipe, ...patch })}
          />
        ) : null}
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
          Deviation
          <RecipeNumberInput
            value={recipe.dipPct}
            emptyValue={null}
            className={fieldClass}
            onCommit={(next) => onChange({ ...recipe, dipPct: next })}
          />
        </label>
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
          Take profit %
          <RecipeNumberInput
            value={recipe.takeProfitPct}
            emptyValue={null}
            className={fieldClass}
            onCommit={(next) => onChange({ ...recipe, takeProfitPct: next })}
          />
        </label>
        <label className={labelClass}>
          Stop %
          <RecipeNumberInput
            value={recipe.stopLossPct}
            emptyValue={null}
            className={fieldClass}
            onCommit={(next) => onChange({ ...recipe, stopLossPct: next })}
          />
        </label>
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
