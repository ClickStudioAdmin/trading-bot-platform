"use client";

import { useState } from "react";
import { AppSelect } from "@/components/app-select";
import {
  IndicatorStartFields,
  TrendStartFields,
} from "@/components/bot-indicator-fields";
import {
  BotField,
  BotFormGroup,
  OrderTypePill,
} from "@/components/bot-form-chrome";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import type { DcaIndicatorKind, DcaIndicatorTimeframe } from "@/lib/dca/indicators";
import {
  blankPerpsAddConditionDraft,
  perpsAddConditionDraftForType,
  type PerpsAddConditionType,
} from "@/lib/futures/perps-add-condition";

export type { PerpsAddConditionType };

export function PerpsAdditionalOrders({
  conditionType,
  onConditionType,
  size,
  onSize,
  sizeUnit,
  onSizeUnit,
  orderType,
  onOrderType,
  limitPrice,
  onLimitPrice,
  quoteLabel,
  baseCoin,
  fieldClass,
  gridClass,
  fieldsClass,
  side = "long",
  webhooks = [],
}: {
  conditionType: PerpsAddConditionType;
  onConditionType: (next: PerpsAddConditionType) => void;
  size: string;
  onSize: (next: string) => void;
  sizeUnit: "qty" | "usdt";
  onSizeUnit: (next: "qty" | "usdt") => void;
  orderType: "market" | "limit";
  onOrderType: (next: "market" | "limit") => void;
  limitPrice: string;
  onLimitPrice: (next: string) => void;
  quoteLabel: string;
  baseCoin: string;
  fieldClass: string;
  gridClass: string;
  fieldsClass?: string;
  side?: "long" | "short";
  webhooks?: readonly { id: string; name: string }[];
}) {
  const [draft, setDraft] = useState(() => blankPerpsAddConditionDraft(side));
  const conditionGrid = fieldsClass ?? gridClass;

  function chooseType(next: PerpsAddConditionType) {
    onConditionType(next);
    setDraft((current) => perpsAddConditionDraftForType(next, side, current));
  }

  function patchDraft(partial: Partial<typeof draft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  return (
    <div
      className="space-y-3"
      onChange={(event) => {
        event.stopPropagation();
      }}
    >
      <BotFormGroup>
        <div className={gridClass}>
          <BotField label="Condition Type" className="whitespace-nowrap">
            <AppSelect
              trackDirty={false}
              value={conditionType}
              onChange={(event) => {
                const next = event.target.value;
                chooseType(
                  next === "indicator" ||
                    next === "trend" ||
                    next === "price" ||
                    next === "webhook"
                    ? next
                    : "",
                );
              }}
              className={`${fieldClass} !min-w-72`}
            >
              <option value="">Select Condition Type</option>
              <option value="indicator">Indicator</option>
              <option value="trend">Trend</option>
              <option value="price">Price Cross</option>
              <option value="webhook">Signal Webhook</option>
            </AppSelect>
          </BotField>
        </div>
      </BotFormGroup>
      {conditionType === "indicator" ? (
        <BotFormGroup>
          <div className={conditionGrid}>
            <IndicatorStartFields
              side={side}
              prefix="addIndicator"
              kind={draft.kind}
              timeframe={draft.timeframe}
              compare={draft.compare}
              level={draft.level}
              period={draft.period}
              slowPeriod={draft.slowPeriod}
              multiplier={draft.multiplier}
              onKindChange={(kind) => patchDraft({ kind })}
              onTimeframeChange={(timeframe) => patchDraft({ timeframe })}
              onCompareChange={(compare) => patchDraft({ compare })}
              onLevelChange={(level) => patchDraft({ level })}
              onPeriodChange={(period) => patchDraft({ period })}
              onSlowPeriodChange={(slowPeriod) => patchDraft({ slowPeriod })}
              onMultiplierChange={(multiplier) => patchDraft({ multiplier })}
            />
          </div>
        </BotFormGroup>
      ) : null}
      {conditionType === "trend" ? (
        <BotFormGroup>
          <div className={conditionGrid}>
            <TrendStartFields
              side={side}
              prefix="addTrend"
              kind={draft.kind === "supertrend" ? draft.kind : "supertrend"}
              timeframe={draft.timeframe}
              compare={draft.compare}
              period={draft.period}
              multiplier={draft.multiplier}
              onKindChange={(kind: DcaIndicatorKind) => patchDraft({ kind })}
              onTimeframeChange={(timeframe: DcaIndicatorTimeframe) =>
                patchDraft({ timeframe })
              }
              onCompareChange={(compare) => patchDraft({ compare })}
              onPeriodChange={(period) => patchDraft({ period })}
              onMultiplierChange={(multiplier) => patchDraft({ multiplier })}
            />
          </div>
        </BotFormGroup>
      ) : null}
      {conditionType === "price" ? (
        <BotFormGroup>
          <div className={conditionGrid}>
            <BotField label="Price source" required>
              <AppSelect
                trackDirty={false}
                value={draft.triggerBy}
                onChange={(event) =>
                  patchDraft({
                    triggerBy:
                      event.target.value === "mark" ||
                      event.target.value === "index"
                        ? event.target.value
                        : "last",
                  })
                }
                className={fieldClass}
              >
                <option value="last">Last is</option>
                <option value="mark">Mark is</option>
                <option value="index">Index is</option>
              </AppSelect>
            </BotField>
            <BotField label="Compare" required>
              <AppSelect
                trackDirty={false}
                value={draft.triggerCompare}
                onChange={(event) =>
                  patchDraft({
                    triggerCompare: event.target.value === "lte" ? "lte" : "gte",
                  })
                }
                className={fieldClass}
              >
                <option value="gte">At or above</option>
                <option value="lte">At or below</option>
              </AppSelect>
            </BotField>
            <BotField label="Price" required>
              <GroupedNumberInput
                value={draft.triggerPrice}
                onChange={(triggerPrice) => patchDraft({ triggerPrice })}
                allowDecimal
                className={fieldClass}
              />
            </BotField>
          </div>
        </BotFormGroup>
      ) : null}
      {conditionType === "webhook" ? (
        <BotFormGroup>
          <div className={conditionGrid}>
            <BotField label="Webhook" className="lg:col-span-2" required>
              <AppSelect
                trackDirty={false}
                value={draft.webhookId}
                onChange={(event) =>
                  patchDraft({ webhookId: event.target.value })
                }
                className={fieldClass}
              >
                <option value="">
                  {webhooks.length === 0
                    ? "Create a Signal webhook first"
                    : "Pick a webhook"}
                </option>
                {webhooks.map((hook) => (
                  <option key={hook.id} value={hook.id}>
                    {hook.name}
                  </option>
                ))}
              </AppSelect>
            </BotField>
          </div>
        </BotFormGroup>
      ) : null}
      <BotFormGroup>
        <div className={gridClass}>
          <BotField label="Size">
            <span className="relative mt-1 block">
              {sizeUnit === "usdt" ? (
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
                  $
                </span>
              ) : null}
              <GroupedNumberInput
                value={size}
                onChange={onSize}
                allowDecimal
                className={`${fieldClass} ${sizeUnit === "usdt" ? "pl-7" : ""}`}
              />
            </span>
          </BotField>
          <BotField label="Unit">
            <AppSelect
              trackDirty={false}
              value={sizeUnit}
              onChange={(event) => {
                onSizeUnit(event.target.value === "qty" ? "qty" : "usdt");
                onSize("");
              }}
              className={fieldClass}
            >
              <option value="usdt">{quoteLabel}</option>
              <option value="qty">{baseCoin}</option>
            </AppSelect>
          </BotField>
          <BotField label="Order">
            <OrderTypePill value={orderType} onChange={onOrderType} />
          </BotField>
          {orderType === "limit" ? (
            <BotField label="Limit price">
              <GroupedNumberInput
                value={limitPrice}
                onChange={onLimitPrice}
                allowDecimal
                className={fieldClass}
              />
            </BotField>
          ) : null}
        </div>
      </BotFormGroup>
    </div>
  );
}
