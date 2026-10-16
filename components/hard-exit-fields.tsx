"use client";

import {
  HintLabel,
  conditionFieldClass,
  useBotColumnLayout,
} from "@/components/bot-form-chrome";
import { DcaFilterParamFields } from "@/components/dca-filter-fields";
import { AppSelect } from "@/components/app-select";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  DCA_FILTER_KIND_OPTIONS,
  dcaFilterSpecForKind,
  parseDcaFilterKind,
  type DcaFilterSpec,
} from "@/lib/dca/filters";
import {
  hardExitForTrigger,
  type HardExitDraft,
  type HardExitTrigger,
} from "@/lib/dca/hard-exit";
import { indicatorClaim } from "@/lib/strategy/conflicts";
import {
  choiceConflicts,
  priceChoiceConflicts,
  type EntryConflictSlot,
} from "@/lib/strategy/expr";
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

/** When takes the spare width. Period, multiplier, timeframe, and level stay short. */
function hardExitParamGrid(spec: DcaFilterSpec): string {
  const base =
    "col-span-full grid min-w-0 grid-cols-2 gap-x-3 gap-y-2 [&>*]:min-w-0";
  const multiplier = spec.kind === "supertrend" || spec.kind === "atr_band";
  const pair = spec.kind === "ema_cross" || spec.kind === "sma_cross";
  const macd = spec.kind === "macd";
  const level = spec.kind === "rsi" && spec.compare !== "between";
  const range = spec.kind === "rsi" && spec.compare === "between";
  if (multiplier) {
    return `${base} lg:grid-cols-[minmax(0,1.1fr)_6.5rem_6.5rem_6.5rem_minmax(0,2.4fr)]`;
  }
  if (pair) {
    return `${base} lg:grid-cols-[minmax(0,1.1fr)_6.5rem_6.5rem_minmax(0,2fr)_6.5rem]`;
  }
  if (macd) {
    return `${base} lg:grid-cols-[minmax(0,1.1fr)_6.5rem_minmax(0,2fr)_6.5rem]`;
  }
  if (range) {
    return `${base} lg:grid-cols-[minmax(0,1.1fr)_6.5rem_6.5rem_minmax(0,2fr)_6.5rem_6.5rem]`;
  }
  if (level) {
    return `${base} lg:grid-cols-[minmax(0,1.1fr)_6.5rem_6.5rem_minmax(0,2fr)_6.5rem]`;
  }
  return `${base} lg:grid-cols-[minmax(0,1.1fr)_6.5rem_6.5rem_minmax(0,2.4fr)]`;
}

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
  seriesSlots,
  seriesIndex,
  disabledKinds = [],
  disabledWebhookIds = [],
  lead = true,
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
  seriesSlots?: readonly EntryConflictSlot[];
  seriesIndex?: number;
  disabledKinds?: HardExitTrigger[];
  disabledWebhookIds?: string[];
  /** First row of the Condition Builder. Added rows stay Trigger. */
  lead?: boolean;
}) {
  const column = useBotColumnLayout();
  const webhookChoices =
    value.trigger === "webhook" &&
    value.webhookId &&
    !webhooks.some((hook) => hook.id === value.webhookId)
      ? [...webhooks, { id: value.webhookId, name: "Webhook (removed)" }]
      : webhooks;
  return (
    <div className={gridClass}>
      <label className={lead ? `${labelClass} whitespace-nowrap` : labelClass}>
        <HintLabel text={lead ? "Condition Type" : "Trigger"} required />
        <AppSelect
          name={named ? `${prefix}Trigger` : undefined}
          value={value.trigger === "unset" ? "" : value.trigger}
          onChange={(event) => {
            const trigger = event.target.value as HardExitTrigger;
            if (
              trigger !== "price" &&
              trigger !== "indicator" &&
              trigger !== "trend" &&
              trigger !== "webhook"
            ) {
              onChange({ trigger: "unset" });
              return;
            }
            onChange(hardExitForTrigger(trigger, side, value));
          }}
          className={lead ? conditionFieldClass(fieldClass, column) : fieldClass}
        >
          <option value="">{lead ? "Select Condition Type" : "Select Trigger"}</option>
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
              {(["last", "mark", "index"] as const).map((source) => (
                <option
                  key={source}
                  value={source}
                  disabled={priceChoiceConflicts(
                    seriesSlots,
                    seriesIndex,
                    {
                      source: value.triggerBy,
                      compare: value.compare,
                      price: value.price,
                    },
                    { source },
                  )}
                >
                  {source === "last"
                    ? "Last is"
                    : source === "mark"
                      ? "Mark is"
                      : "Index is"}
                </option>
              ))}
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
              {(["gte", "lte"] as const).map((compare) => (
                <option
                  key={compare}
                  value={compare}
                  disabled={priceChoiceConflicts(
                    seriesSlots,
                    seriesIndex,
                    {
                      source: value.triggerBy,
                      compare: value.compare,
                      price: value.price,
                    },
                    { compare },
                  )}
                >
                  {compare === "gte" ? "At or above" : "At or below"}
                </option>
              ))}
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
      ) : value.trigger === "unset" ? null : value.spec == null ? (
        <label className={labelClass}>
          <HintLabel text="Indicator" required />
          <AppSelect
            name={named ? `${prefix}Kind` : undefined}
            value=""
            onChange={(event) => {
              const kind = parseDcaFilterKind(event.target.value);
              if (!kind || kind === "supertrend") {
                return;
              }
              onChange({
                trigger: "indicator",
                spec: dcaFilterSpecForKind(kind, side),
              });
            }}
            className={fieldClass}
          >
            <option value="">Select Indicator</option>
            {INDICATOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </AppSelect>
        </label>
      ) : (
        <div className={hardExitParamGrid(value.spec)}>
          <label className={`${labelClass} min-w-0`}>
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
                const current = value.spec;
                if (!current) {
                  return;
                }
                onChange({
                  ...value,
                  spec: { ...seeded, timeframe: current.timeframe },
                });
              }}
              className={fieldClass}
            >
              {(value.trigger === "trend"
                ? DCA_FILTER_KIND_OPTIONS.filter(
                    (option) => option.value === "supertrend",
                  )
                : INDICATOR_OPTIONS
              ).map((option) => {
                const seeded = dcaFilterSpecForKind(option.value, side);
                return (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={choiceConflicts(
                      seriesSlots,
                      seriesIndex,
                      indicatorClaim({
                        surface: "filter",
                        kind: option.value,
                        timeframe: value.spec?.timeframe ?? "240",
                        compare: seeded.compare,
                        level: seeded.level,
                        levelTo: seeded.levelTo,
                        period: seeded.period,
                        slowPeriod: seeded.slowPeriod,
                        multiplier: seeded.multiplier,
                      }),
                      option.value === value.spec?.kind,
                    )}
                  >
                    {option.label}
                  </option>
                );
              })}
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
            seriesSlots={seriesSlots}
            seriesIndex={seriesIndex}
          />
        </div>
      )}
    </div>
  );
}
