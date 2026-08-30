"use client";

import type { BacktestRecipe } from "@/lib/backtest/model";
import {
  userBacktestFieldIssues,
  type BacktestFieldIssue,
} from "@/lib/backtest/library";
import { emptyFuturesTpsl } from "@/lib/futures/tpsl";

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

function optionalNumber(raw: string): number | null {
  const text = raw.trim();
  if (text === "") {
    return null;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function BacktestRecipeFields({
  recipe,
  onChange,
}: {
  recipe: BacktestRecipe;
  onChange: (next: BacktestRecipe) => void;
}) {
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
              <input
                inputMode="decimal"
                value={recipe.armTrigger?.price ?? ""}
                onChange={(event) =>
                  onChange({
                    ...recipe,
                    armTrigger: {
                      triggerBy: recipe.armTrigger?.triggerBy ?? "last",
                      compare: recipe.armTrigger?.compare ?? "gte",
                      price: Number(event.target.value) || 0,
                    },
                  })
                }
                className={
                  issueFor(issues, "armPrice") ? invalidFieldClass : fieldClass
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
              <input
                inputMode="decimal"
                value={recipe.indicatorLevel ?? ""}
                onChange={(event) =>
                  onChange({
                    ...recipe,
                    indicatorLevel: optionalNumber(event.target.value),
                  })
                }
                className={fieldClass}
              />
            </label>
          </>
        ) : null}
        <label className={labelClass}>
          Clip
          <input
            inputMode="decimal"
            value={recipe.clipSize}
            onChange={(event) =>
              onChange({ ...recipe, clipSize: Number(event.target.value) || 0 })
            }
            className={
              issueFor(issues, "clipSize") ? invalidFieldClass : fieldClass
            }
          />
          <FieldNote message={issueFor(issues, "clipSize")} />
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
        <label className={labelClass}>
          Size multiplier
          <input
            inputMode="decimal"
            value={recipe.sizeMultiplier}
            onChange={(event) =>
              onChange({
                ...recipe,
                sizeMultiplier: Number(event.target.value) || 1,
              })
            }
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Dip %
          <input
            inputMode="decimal"
            value={recipe.dipPct ?? ""}
            onChange={(event) =>
              onChange({ ...recipe, dipPct: optionalNumber(event.target.value) })
            }
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Max clips
          <input
            inputMode="numeric"
            value={recipe.maxClips ?? ""}
            onChange={(event) =>
              onChange({
                ...recipe,
                maxClips: optionalNumber(event.target.value),
              })
            }
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Take profit %
          <input
            inputMode="decimal"
            value={recipe.takeProfitPct ?? ""}
            onChange={(event) =>
              onChange({
                ...recipe,
                takeProfitPct: optionalNumber(event.target.value),
              })
            }
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Stop %
          <input
            inputMode="decimal"
            value={recipe.stopLossPct ?? ""}
            onChange={(event) =>
              onChange({
                ...recipe,
                stopLossPct: optionalNumber(event.target.value),
              })
            }
            className={fieldClass}
          />
        </label>
        <label className={labelClass}>
          Trailing %
          <input
            inputMode="decimal"
            value={recipe.trailingPct ?? ""}
            onChange={(event) =>
              onChange({
                ...recipe,
                trailingPct: optionalNumber(event.target.value),
              })
            }
            className={fieldClass}
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
        <input
          value={recipe.size}
          onChange={(event) => onChange({ ...recipe, size: event.target.value })}
          className={issueFor(issues, "size") ? invalidFieldClass : fieldClass}
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
        <input
          value={recipe.triggerPrice}
          onChange={(event) =>
            onChange({ ...recipe, triggerPrice: event.target.value })
          }
          className={
            issueFor(issues, "triggerPrice") ? invalidFieldClass : fieldClass
          }
        />
        <FieldNote message={issueFor(issues, "triggerPrice")} />
      </label>
        </>
      )}
      <label className={labelClass}>
        Take profit
        <input
          inputMode="decimal"
          value={recipe.tpsl?.takeProfit ?? ""}
          onChange={(event) =>
            onChange({
              ...recipe,
              tpsl: {
                ...(recipe.tpsl ?? emptyFuturesTpsl()),
                takeProfit: optionalNumber(event.target.value),
              },
            })
          }
          className={fieldClass}
        />
      </label>
      <label className={labelClass}>
        Stop
        <input
          inputMode="decimal"
          value={recipe.tpsl?.stopLoss ?? ""}
          onChange={(event) =>
            onChange({
              ...recipe,
              tpsl: {
                ...(recipe.tpsl ?? emptyFuturesTpsl()),
                stopLoss: optionalNumber(event.target.value),
              },
            })
          }
          className={fieldClass}
        />
      </label>
      <label className={labelClass}>
        Trailing
        <input
          inputMode="decimal"
          value={recipe.trailing?.distance ?? ""}
          onChange={(event) =>
            onChange({
              ...recipe,
              trailing:
                optionalNumber(event.target.value) == null
                  ? recipe.trailing
                  : {
                      distance: optionalNumber(event.target.value) ?? 0,
                      activePrice: recipe.trailing?.activePrice ?? null,
                      peak: recipe.trailing?.peak ?? null,
                    },
            })
          }
          className={fieldClass}
        />
      </label>
    </div>
  );
}
