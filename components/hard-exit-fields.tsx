"use client";

import { HintLabel } from "@/components/bot-form-chrome";
import { DcaFilterParamFields } from "@/components/dca-filter-fields";
import { AppSelect } from "@/components/app-select";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  DCA_FILTER_KIND_OPTIONS,
  dcaFilterSpecForKind,
  parseDcaFilterKind,
} from "@/lib/dca/filters";
import {
  hardExitForTrigger,
  type HardExitDraft,
  type HardExitTrigger,
} from "@/lib/dca/hard-exit";
import type { FuturesSide, FuturesTrigger } from "@/lib/futures/model";

const TRIGGER_OPTIONS: { value: HardExitTrigger; label: string }[] = [
  { value: "indicator", label: "Indicator" },
  { value: "trend", label: "Trend" },
  { value: "price", label: "Price Cross" },
  { value: "webhook", label: "Signal Webhook" },
];

const INDICATOR_OPTIONS = DCA_FILTER_KIND_OPTIONS.filter(
  (option) => option.value !== "supertrend",
);

export function HardExitFields({
  prefix,
  side,
  value,
  onChange,
  webhooks = [],
  gridClass,
  fieldClass,
  labelClass,
  named = true,
  disabledKinds = [],
  disabledWebhookIds = [],
}: {
  prefix: string;
  side: FuturesSide;
  value: HardExitDraft;
  onChange: (next: HardExitDraft) => void;
  webhooks?: { id: string; name: string }[];
  gridClass: string;
  fieldClass: string;
  labelClass: string;
  named?: boolean;
  disabledKinds?: HardExitTrigger[];
  disabledWebhookIds?: string[];
}) {
  const webhookChoices =
    value.trigger === "webhook" &&
    value.webhookId &&
    !webhooks.some((hook) => hook.id === value.webhookId)
      ? [...webhooks, { id: value.webhookId, name: "Webhook (removed)" }]
      : webhooks;
  return (
    <div className={gridClass}>
      <label className={labelClass}>
        <HintLabel text="Trigger" required />
        <AppSelect
          name={named ? `${prefix}Trigger` : undefined}
          value={value.trigger}
          onChange={(event) => {
            const trigger = event.target.value as HardExitTrigger;
            if (
              trigger !== "price" &&
              trigger !== "indicator" &&
              trigger !== "trend" &&
              trigger !== "webhook"
            ) {
              return;
            }
            onChange(hardExitForTrigger(trigger, side, value));
          }}
          className={fieldClass}
        >
          {TRIGGER_OPTIONS.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={
                option.value !== value.trigger &&
                disabledKinds.includes(option.value)
              }
            >
              {option.label}
            </option>
          ))}
        </AppSelect>
      </label>
      {value.trigger === "price" ? (
        <>
          <label className={labelClass}>
            <HintLabel text="Price source" required />
            <AppSelect
              name={named ? `${prefix}TriggerBy` : undefined}
              value={value.triggerBy}
              onChange={(event) =>
                onChange({
                  ...value,
                  triggerBy: event.target.value as FuturesTrigger,
                })
              }
              className={fieldClass}
            >
              <option value="last">Last is</option>
              <option value="mark">Mark is</option>
              <option value="index">Index is</option>
            </AppSelect>
          </label>
          <label className={labelClass}>
            <HintLabel text="Compare" required />
            <AppSelect
              name={named ? `${prefix}TriggerCompare` : undefined}
              value={value.compare}
              onChange={(event) =>
                onChange({
                  ...value,
                  compare: event.target.value === "lte" ? "lte" : "gte",
                })
              }
              className={fieldClass}
            >
              <option value="gte">At or above</option>
              <option value="lte">At or below</option>
            </AppSelect>
          </label>
          <label className={labelClass}>
            <HintLabel text="Price" required />
            <GroupedNumberInput
              name={named ? `${prefix}TriggerPrice` : undefined}
              value={value.price}
              onChange={(price) => onChange({ ...value, price })}
              allowDecimal
              className={fieldClass}
            />
          </label>
        </>
      ) : value.trigger === "webhook" ? (
        <label className={labelClass}>
          <HintLabel text="Webhook" required />
          <AppSelect
            name={named ? `${prefix}WebhookId` : undefined}
            value={value.webhookId}
            onChange={(event) =>
              onChange({ ...value, webhookId: event.target.value })
            }
            className={fieldClass}
          >
            <option value="">
              {webhooks.length === 0
                ? "Create a Signal webhook first"
                : "Pick a webhook"}
            </option>
            {webhookChoices.map((hook) => (
              <option
                key={hook.id}
                value={hook.id}
                disabled={
                  hook.id !== value.webhookId &&
                  disabledWebhookIds.includes(hook.id)
                }
              >
                {hook.name}
              </option>
            ))}
          </AppSelect>
        </label>
      ) : (
        <div className="col-span-full grid grid-cols-2 gap-4 lg:grid-cols-5">
          <label className={labelClass}>
            <HintLabel
              text={value.trigger === "trend" ? "Trend" : "Indicator"}
              required
            />
            <AppSelect
              name={named ? `${prefix}Kind` : undefined}
              value={value.spec.kind}
              onChange={(event) => {
                const kind = parseDcaFilterKind(event.target.value);
                if (!kind || (value.trigger === "trend" && kind !== "supertrend")) {
                  return;
                }
                if (value.trigger === "indicator" && kind === "supertrend") {
                  return;
                }
                const seeded = dcaFilterSpecForKind(kind, side);
                onChange({
                  ...value,
                  spec: { ...seeded, timeframe: value.spec.timeframe },
                });
              }}
              className={fieldClass}
            >
              {(value.trigger === "trend"
                ? DCA_FILTER_KIND_OPTIONS.filter(
                    (option) => option.value === "supertrend",
                  )
                : INDICATOR_OPTIONS
              ).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AppSelect>
          </label>
          <DcaFilterParamFields
            prefix={prefix}
            side={side}
            spec={value.spec}
            onChange={(spec) => onChange({ ...value, spec })}
            named={named}
            fieldClass={fieldClass}
            labelClass={labelClass}
            bare
            whenClass="min-w-0"
          />
        </div>
      )}
    </div>
  );
}
