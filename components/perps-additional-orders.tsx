"use client";

import { AppSelect } from "@/components/app-select";
import {
  BotField,
  BotFormGroup,
  OrderTypePill,
} from "@/components/bot-form-chrome";
import { GroupedNumberInput } from "@/components/usdt-size-input";

/** First slice of the Perps add builder. More condition types come later. */
export type PerpsAddConditionType = "" | "indicator" | "trend" | "price" | "webhook";

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
}) {
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
                onConditionType(
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
