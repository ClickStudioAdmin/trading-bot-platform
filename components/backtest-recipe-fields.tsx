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

export function BacktestRecipeFields({
  recipe,
  onChange,
  onIssuesChange,
}: {
  recipe: BacktestRecipe;
  onChange: (next: BacktestRecipe) => void;
  onIssuesChange?: (issues: string[]) => void;
}) {
  const [maxValueMode, setMaxValueMode] = useState<"none" | "usdt" | "percent">(
    () =>
      recipe.kind === "dca" && recipe.maxValue != null
        ? recipe.maxValueKind === "percent"
          ? "percent"
          : "usdt"
        : "none",
  );
  const maxValueIssue =
    recipe.kind === "dca" &&
    maxValueMode !== "none" &&
    !(Number(recipe.maxValue) > 0)
      ? "Enter a max value."
      : null;
  useEffect(() => {
    onIssuesChange?.(maxValueIssue ? [maxValueIssue] : []);
  }, [maxValueIssue, onIssuesChange]);
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
            onChange={(event) =>
              onChange({
                ...recipe,
                direction: event.target.value as typeof recipe.direction,
              })
            }
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
            onChange={(event) =>
              onChange({
                ...recipe,
                startKind: event.target.value as "price" | "indicator",
              })
            }
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
        {recipe.startKind === "price" ? (
          <>
            <label className={labelClass}>
              When
              <select
                value={recipe.armTrigger?.compare ?? "gte"}
                onChange={(event) =>
                  onChange({
                    ...recipe,
                    armTrigger: {
                      triggerBy: recipe.armTrigger?.triggerBy ?? "last",
                      compare: event.target.value === "lte" ? "lte" : "gte",
                      price: recipe.armTrigger?.price ?? 0,
                    },
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
              <RecipeNumberInput
                value={recipe.armTrigger?.price ?? null}
                emptyValue={0}
                className={
                  issueFor(issues, "armPrice") ? invalidFieldClass : fieldClass
                }
                onCommit={(next) =>
                  onChange({
                    ...recipe,
                    armTrigger: {
                      triggerBy: recipe.armTrigger?.triggerBy ?? "last",
                      compare: recipe.armTrigger?.compare ?? "gte",
                      price: next ?? 0,
                    },
                  })
                }
              />
              <FieldNote message={issueFor(issues, "armPrice")} />
            </label>
          </>
        ) : null}
        {recipe.startKind === "indicator" ? (
          <>
            <label className={labelClass}>
              Indicator
              <select
                value={recipe.indicatorKind ?? "rsi"}
                onChange={(event) =>
                  onChange({
                    ...recipe,
                    indicatorKind: event.target.value as
                      | "rsi"
                      | "macd"
                      | "ema_cross",
                  })
                }
                className={fieldClass}
              >
                <option value="rsi">RSI 14</option>
                <option value="macd">MACD</option>
                <option value="ema_cross">EMA 9/21</option>
              </select>
            </label>
            <label className={labelClass}>
              Compare
              <select
                value={recipe.indicatorCompare ?? "lte"}
                onChange={(event) =>
                  onChange({
                    ...recipe,
                    indicatorCompare: event.target
                      .value as NonNullable<typeof recipe.indicatorCompare>,
                  })
                }
                className={fieldClass}
              >
                <option value="lte">At or below</option>
                <option value="gte">At or above</option>
                <option value="cross_lte">Crosses below</option>
                <option value="cross_gte">Crosses above</option>
                <option value="pair">9/21 cross</option>
              </select>
            </label>
            <label className={labelClass}>
              Level
              <RecipeNumberInput
                value={recipe.indicatorLevel}
                emptyValue={null}
                className={fieldClass}
                onCommit={(next) =>
                  onChange({ ...recipe, indicatorLevel: next })
                }
              />
            </label>
          </>
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
          Dip %
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
              const kind = next === "percent" ? "percent" : "usdt";
              setMaxValueMode(kind);
              onChange({ ...recipe, maxValueKind: kind });
            }}
            className={fieldClass}
          >
            <option value="usdt">Fixed USDT</option>
            <option value="percent">% of account</option>
            <option value="none">No max value</option>
          </select>
        </label>
        {maxValueMode !== "none" ? (
          <label className={labelClass}>
            {maxValueMode === "percent" ? "Percent" : "Amount"}
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
