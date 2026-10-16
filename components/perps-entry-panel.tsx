"use client";

import { useEffect, useRef } from "react";
import { AppSelect } from "@/components/app-select";
import {
  IndicatorStartFields,
  TrendStartFields,
} from "@/components/bot-indicator-fields";
import {
  BotField,
  BotFormGroup,
  botFieldInvalidClass,
  conditionFieldClass,
  useBotColumnLayout,
} from "@/components/bot-form-chrome";
import {
  entryGroupOrderKey,
  GroupPositionSizing,
  PerpsGroupOrderFields,
  useExtraGroupOrders,
} from "@/components/entry-group-order";
import {
  EntryConditionStack,
  entryConflictSlots,
  entryDraftComplete,
  entryRowsFromSources,
  entryStackFromRows,
  type EntryStackRow,
  type EntryWebhookOption,
} from "@/components/entry-condition-stack";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  DEFAULT_DCA_RSI_PERIOD,
  DEFAULT_DCA_SUPERTREND_MULTIPLIER,
  DEFAULT_DCA_SUPERTREND_PERIOD,
  indicatorCompareForDirection,
  indicatorDraftMissing,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import type { DcaIndicatorStart } from "@/lib/dca/playbook";
import { parseDcaIndicatorCompare } from "@/lib/dca/indicators";
import type { FuturesAutomationFormValues } from "@/lib/futures/automation";
import { parseAutomationEntry } from "@/lib/futures/automation";
import type { PerpsEntryLeg } from "@/lib/futures/conditions";
import type { PerpsAddOrderValues } from "@/lib/futures/perps-add-condition";
import type { FuturesSide, FuturesTrigger } from "@/lib/futures/model";
import { indicatorClaim, priceClaim } from "@/lib/strategy/conflicts";
import {
  confirmFromEntryStack,
  entryKindDisabled,
  entryWebhookIdDisabled,
  priceChoiceConflicts,
  type EntryStack,
} from "@/lib/strategy/expr";

export type PerpsEntryDraft = {
  entrySource: FuturesAutomationFormValues["entrySource"] | "";
  webhookId: string;
  triggerBy: FuturesTrigger;
  triggerCompare: "gte" | "lte";
  triggerPrice: string;
  skipIfOpen: boolean;
  indicatorKind: DcaIndicatorKind | "";
  indicatorTimeframe: DcaIndicatorTimeframe;
  indicatorCompare: string;
  indicatorLevel: string;
  indicatorPeriod: string;
  indicatorSlowPeriod: string;
  indicatorMultiplier: string;
  entryRows: EntryStackRow[];
};

function indicatorKindFor(
  source: string,
  kind?: DcaIndicatorKind | null,
): DcaIndicatorKind | "" {
  if (source === "" ) {
    return "";
  }
  if (source === "trend") {
    return "supertrend";
  }
  if (source === "indicator") {
    return kind && kind !== "supertrend" ? kind : "";
  }
  return kind && kind !== "supertrend" ? kind : "rsi";
}

function blankPerpsEntry(layer: FuturesAutomationFormValues): boolean {
  return (
    !layer.id &&
    layer.entrySource === "price" &&
    !layer.webhookId &&
    layer.indicator == null &&
    !String(layer.triggerPrice ?? "").trim() &&
    (layer.entryStack == null || layer.entryStack.leaves.length === 0)
  );
}

export function perpsEntryDraftFromLayer(
  layer: FuturesAutomationFormValues,
  side: FuturesSide,
  blank = false,
): PerpsEntryDraft {
  const entrySource = blank ? "" : layer.entrySource;
  const kind = indicatorKindFor(entrySource, layer.indicator?.kind);
  return {
    entrySource,
    webhookId: layer.webhookId,
    triggerBy: layer.triggerBy,
    triggerCompare: layer.triggerCompare,
    triggerPrice: layer.triggerPrice,
    skipIfOpen: layer.skipIfOpen,
    indicatorKind: kind,
    indicatorTimeframe: layer.indicator?.timeframe ?? "15",
    indicatorCompare:
      layer.indicator?.compare ??
      (kind ? indicatorCompareForDirection(side, kind, "") : ""),
    indicatorLevel:
      layer.indicator?.level != null
        ? String(layer.indicator.level)
        : side === "short"
          ? "70"
          : "30",
    indicatorPeriod: String(
      layer.indicator?.period ??
        (layer.entrySource === "trend"
          ? DEFAULT_DCA_SUPERTREND_PERIOD
          : DEFAULT_DCA_RSI_PERIOD),
    ),
    indicatorSlowPeriod:
      layer.indicator?.slowPeriod != null
        ? String(layer.indicator.slowPeriod)
        : "",
    indicatorMultiplier: String(
      layer.indicator?.multiplier ?? DEFAULT_DCA_SUPERTREND_MULTIPLIER,
    ),
    entryRows: entryRowsFromSources(layer.entryStack, layer.confirm),
  };
}

/** A side the user has not configured. Side defaults only — nothing copied across. */
export function emptyPerpsEntryDraft(side: FuturesSide): PerpsEntryDraft {
  return {
    entrySource: "",
    webhookId: "",
    triggerBy: "last",
    triggerCompare: side === "short" ? "lte" : "gte",
    triggerPrice: "",
    skipIfOpen: true,
    indicatorKind: "",
    indicatorTimeframe: "15",
    indicatorCompare: "",
    indicatorLevel: side === "short" ? "70" : "30",
    indicatorPeriod: String(DEFAULT_DCA_RSI_PERIOD),
    indicatorSlowPeriod: "",
    indicatorMultiplier: String(DEFAULT_DCA_SUPERTREND_MULTIPLIER),
    entryRows: [],
  };
}

export function initialPerpsEntryDrafts(layer: FuturesAutomationFormValues): {
  long: PerpsEntryDraft;
  short: PerpsEntryDraft;
} {
  const blank = blankPerpsEntry(layer);
  if (layer.direction === "both" && layer.shortEntry) {
    return {
      long: perpsEntryDraftFromLayer(layer, "long", blank),
      short: perpsEntryDraftFromLeg(layer.shortEntry, "short"),
    };
  }
  const shortSide =
    layer.formAction === "sell" || layer.formAction === "close_short";
  if (shortSide) {
    return {
      short: perpsEntryDraftFromLayer(layer, "short", blank),
      long: emptyPerpsEntryDraft("long"),
    };
  }
  return {
    long: perpsEntryDraftFromLayer(layer, "long", blank),
    short: emptyPerpsEntryDraft("short"),
  };
}

export function perpsEntryDraftFromLeg(
  leg: PerpsEntryLeg,
  side: FuturesSide,
): PerpsEntryDraft {
  return perpsEntryDraftFromLayer(
    {
      entrySource: leg.entrySource,
      webhookId: leg.webhookId ?? "",
      triggerBy: leg.triggerBy,
      triggerCompare: leg.triggerCompare,
      triggerPrice: String(leg.triggerPrice),
      skipIfOpen: leg.skipIfOpen,
      indicator: leg.indicator,
      confirm: leg.confirm,
      entryStack: leg.entryStack,
    } as FuturesAutomationFormValues,
    side,
  );
}

export function indicatorFromPerpsDraft(
  draft: PerpsEntryDraft,
): DcaIndicatorStart | null {
  if (
    (draft.entrySource !== "indicator" && draft.entrySource !== "trend") ||
    !draft.indicatorKind
  ) {
    return null;
  }
  return {
    kind: draft.indicatorKind,
    timeframe: draft.indicatorTimeframe,
    compare: parseDcaIndicatorCompare(draft.indicatorCompare),
    level: Number(draft.indicatorLevel) || null,
    period: Number(draft.indicatorPeriod) || null,
    slowPeriod: Number(draft.indicatorSlowPeriod) || null,
    multiplier: Number(draft.indicatorMultiplier) || null,
  };
}

export function perpsEntryLegFromDraft(
  draft: PerpsEntryDraft,
  closing: boolean,
): PerpsEntryLeg {
  const entrySource =
    draft.entrySource === "" ||
    (closing &&
      (draft.entrySource === "indicator" || draft.entrySource === "trend"))
      ? "price"
      : draft.entrySource;
  const entryStack: EntryStack = closing
    ? { leaves: [], joins: [] }
    : entryStackFromRows(draft.entryRows);
  return {
    entrySource,
    webhookId: entrySource === "webhook" ? draft.webhookId.trim() || null : null,
    triggerBy: draft.triggerBy,
    triggerCompare: draft.triggerCompare,
    triggerPrice: Number(draft.triggerPrice.replace(/,/g, "")) || 0,
    skipIfOpen: draft.skipIfOpen,
    indicator: closing ? null : indicatorFromPerpsDraft(draft),
    confirm: closing ? null : confirmFromEntryStack(entryStack),
    entryStack,
  };
}

export function perpsEntryDraftMissing(
  draft: PerpsEntryDraft,
  closing: boolean,
): boolean {
  if (closing) {
    return false;
  }
  if (draft.entrySource === "") {
    return true;
  }
  if (draft.entrySource === "price") {
    const price = Number(draft.triggerPrice.replace(/,/g, "").trim());
    if (!(price > 0)) {
      return true;
    }
  }
  if (draft.entrySource === "webhook" && draft.webhookId.trim() === "") {
    return true;
  }
  if (draft.entrySource === "indicator" || draft.entrySource === "trend") {
    if (
      indicatorDraftMissing({
        family: draft.entrySource,
        kind: draft.indicatorKind,
        compare: draft.indicatorCompare,
        level: draft.indicatorLevel,
        period: draft.indicatorPeriod,
        slowPeriod: draft.indicatorSlowPeriod,
        multiplier: draft.indicatorMultiplier,
      })
    ) {
      return true;
    }
  }
  return draft.entryRows.some((row) => !entryDraftComplete(row.draft));
}

export function PerpsEntryPanel({
  prefix,
  side,
  closing,
  draft,
  onChange,
  webhooks,
  fieldRow,
  fieldRow5,
  pairSpan,
  fieldClass,
  labelClass,
  showErrors = false,
  order,
  onOrderChange,
  orderNamed = false,
  quoteLabel,
  baseCoin,
  orderSizeInvalid = false,
  orderLimitInvalid = false,
}: {
  prefix: string;
  side: FuturesSide;
  closing: boolean;
  draft: PerpsEntryDraft;
  onChange: (next: PerpsEntryDraft) => void;
  webhooks: EntryWebhookOption[];
  fieldRow: string;
  fieldRow5: string;
  pairSpan: string;
  fieldClass: string;
  labelClass: string;
  showErrors?: boolean;
  order?: PerpsAddOrderValues;
  onOrderChange?: (partial: Partial<PerpsAddOrderValues>) => void;
  orderNamed?: boolean;
  quoteLabel?: string;
  baseCoin?: string;
  orderSizeInvalid?: boolean;
  orderLimitInvalid?: boolean;
}) {
  const column = useBotColumnLayout();
  const extraOrders = useExtraGroupOrders();
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  function patch(partial: Partial<PerpsEntryDraft>) {
    const next = { ...draftRef.current, ...partial };
    draftRef.current = next;
    onChange(next);
  }
  const anchor = {
    kind:
      closing || draft.entrySource === "" ? "price" : draft.entrySource,
    webhookId: draft.webhookId,
    claim: closing
      ? null
      : draft.entrySource === "price"
        ? priceClaim({
            source: draft.triggerBy,
            compare: draft.triggerCompare,
            price: draft.triggerPrice,
          })
        : draft.entrySource === "indicator" || draft.entrySource === "trend"
          ? indicatorClaim({
              surface: "entry",
              kind: draft.indicatorKind,
              timeframe: draft.indicatorTimeframe,
              compare: draft.indicatorCompare,
              level: draft.indicatorLevel,
              period: draft.indicatorPeriod,
              slowPeriod: draft.indicatorSlowPeriod,
              multiplier: draft.indicatorMultiplier,
            })
          : null,
  };
  const entrySlots = entryConflictSlots(anchor, closing ? [] : draft.entryRows);
  const webhookIds = webhooks.map((hook) => hook.id);
  const whenWebhooks =
    draft.webhookId && !webhooks.some((hook) => hook.id === draft.webhookId)
      ? [...webhooks, { id: draft.webhookId, name: "Webhook (removed)" }]
      : webhooks;
  const triggerFields = (
    <>
      <BotFormGroup>
        <div className={fieldRow}>
          <BotField label="Condition Type" required>
            <input
              type="hidden"
              name={`${prefix}entrySource`}
              value={
                closing &&
                (draft.entrySource === "indicator" ||
                  draft.entrySource === "trend")
                  ? "price"
                  : draft.entrySource
              }
            />
            <AppSelect
              value={
                closing &&
                (draft.entrySource === "indicator" ||
                  draft.entrySource === "trend")
                  ? "price"
                  : draft.entrySource
              }
              onChange={(event) => {
                if (event.target.value === "") {
                  patch({ entrySource: "" });
                  return;
                }
                const next = parseAutomationEntry(event.target.value);
                const partial: Partial<PerpsEntryDraft> = { entrySource: next };
                if (next === "indicator" && draft.entrySource !== "indicator") {
                  partial.indicatorKind = "";
                }
                if (next === "trend") {
                  partial.indicatorKind = "supertrend";
                  partial.indicatorCompare = indicatorCompareForDirection(
                    side,
                    "supertrend",
                    "",
                  );
                  partial.indicatorPeriod = String(DEFAULT_DCA_SUPERTREND_PERIOD);
                  partial.indicatorMultiplier = String(
                    DEFAULT_DCA_SUPERTREND_MULTIPLIER,
                  );
                }
                patch(partial);
              }}
              className={conditionFieldClass(fieldClass, column)}
            >
              {closing ? null : <option value="">Select Condition Type</option>}
              {closing ? null : <option value="indicator">Indicator</option>}
              {closing ? null : <option value="trend">Trend</option>}
              <option
                value="price"
                disabled={entryKindDisabled({
                  slots: entrySlots,
                  index: 0,
                  kind: "price",
                  webhookIds,
                })}
              >
                Price Cross
              </option>
              <option
                value="webhook"
                disabled={entryKindDisabled({
                  slots: entrySlots,
                  index: 0,
                  kind: "webhook",
                  webhookIds,
                })}
              >
                Signal Webhook
              </option>
            </AppSelect>
          </BotField>
        </div>
      </BotFormGroup>
      {draft.entrySource === "" && !closing ? null : (
      <BotFormGroup>
        <div className={fieldRow5}>
          {draft.entrySource === "indicator" && !closing ? (
            <IndicatorStartFields
              side={side}
              prefix={`${prefix}indicator`}
              kind={draft.indicatorKind}
              timeframe={draft.indicatorTimeframe}
              compare={draft.indicatorCompare}
              level={draft.indicatorLevel}
              period={draft.indicatorPeriod}
              slowPeriod={draft.indicatorSlowPeriod}
              multiplier={draft.indicatorMultiplier}
              onKindChange={(indicatorKind) => patch({ indicatorKind })}
              onTimeframeChange={(indicatorTimeframe) =>
                patch({ indicatorTimeframe })
              }
              onCompareChange={(indicatorCompare) => patch({ indicatorCompare })}
              onLevelChange={(indicatorLevel) => patch({ indicatorLevel })}
              onPeriodChange={(indicatorPeriod) => patch({ indicatorPeriod })}
              onSlowPeriodChange={(indicatorSlowPeriod) =>
                patch({ indicatorSlowPeriod })
              }
              onMultiplierChange={(indicatorMultiplier) =>
                patch({ indicatorMultiplier })
              }
              seriesSlots={entrySlots}
              seriesIndex={0}
            />
          ) : draft.entrySource === "trend" && !closing ? (
            <TrendStartFields
              side={side}
              prefix={`${prefix}indicator`}
              kind={draft.indicatorKind || "supertrend"}
              timeframe={draft.indicatorTimeframe}
              compare={draft.indicatorCompare}
              period={draft.indicatorPeriod}
              multiplier={draft.indicatorMultiplier}
              onKindChange={(indicatorKind) => patch({ indicatorKind })}
              onTimeframeChange={(indicatorTimeframe) =>
                patch({ indicatorTimeframe })
              }
              onCompareChange={(indicatorCompare) => patch({ indicatorCompare })}
              onPeriodChange={(indicatorPeriod) => patch({ indicatorPeriod })}
              onMultiplierChange={(indicatorMultiplier) =>
                patch({ indicatorMultiplier })
              }
              seriesSlots={entrySlots}
              seriesIndex={0}
            />
          ) : draft.entrySource === "webhook" ? (
            <BotField label="Webhook" className={pairSpan} required>
              <AppSelect
                name={`${prefix}webhookId`}
                value={draft.webhookId}
                onChange={(event) => patch({ webhookId: event.target.value })}
                className={
                  showErrors && draft.webhookId.trim() === ""
                    ? botFieldInvalidClass
                    : fieldClass
                }
              >
                <option value="">
                  {webhooks.length === 0
                    ? "Create a Signal webhook first"
                    : "Pick a webhook"}
                </option>
                {whenWebhooks.map((hook) => (
                  <option
                    key={hook.id}
                    value={hook.id}
                    disabled={entryWebhookIdDisabled({
                      slots: entrySlots,
                      index: 0,
                      webhookId: hook.id,
                    })}
                  >
                    {hook.name}
                  </option>
                ))}
              </AppSelect>
            </BotField>
          ) : draft.entrySource === "price" || closing ? (
            <>
              <BotField label="Price source" required>
                <AppSelect
                  name={`${prefix}triggerBy`}
                  value={draft.triggerBy}
                  onChange={(event) =>
                    patch({
                      triggerBy:
                        event.target.value === "mark" ||
                        event.target.value === "index"
                          ? event.target.value
                          : "last",
                    })
                  }
                  className={fieldClass}
                >
                  {(["last", "mark", "index"] as const).map((source) => (
                    <option
                      key={source}
                      value={source}
                      disabled={priceChoiceConflicts(
                        entrySlots,
                        0,
                        {
                          source: draft.triggerBy,
                          compare: draft.triggerCompare,
                          price: draft.triggerPrice,
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
              </BotField>
              <BotField label="Compare" required>
                <AppSelect
                  name={`${prefix}triggerCompare`}
                  value={draft.triggerCompare}
                  onChange={(event) =>
                    patch({
                      triggerCompare:
                        event.target.value === "lte" ? "lte" : "gte",
                    })
                  }
                  className={fieldClass}
                >
                  {(["gte", "lte"] as const).map((compare) => (
                    <option
                      key={compare}
                      value={compare}
                      disabled={priceChoiceConflicts(
                        entrySlots,
                        0,
                        {
                          source: draft.triggerBy,
                          compare: draft.triggerCompare,
                          price: draft.triggerPrice,
                        },
                        { compare },
                      )}
                    >
                      {compare === "gte" ? "At or above" : "At or below"}
                    </option>
                  ))}
                </AppSelect>
              </BotField>
              <BotField label="Price" required>
                <GroupedNumberInput
                  name={`${prefix}triggerPrice`}
                  value={draft.triggerPrice}
                  onChange={(triggerPrice) => patch({ triggerPrice })}
                  allowDecimal
                  className={
                    showErrors &&
                    !(Number(draft.triggerPrice.replace(/,/g, "").trim()) > 0)
                      ? botFieldInvalidClass
                      : fieldClass
                  }
                />
              </BotField>
            </>
          ) : null}
        </div>
      </BotFormGroup>
      )}
    </>
  );
  if (closing) {
    return triggerFields;
  }
  return (
    <EntryConditionStack
      grouped
      lead={triggerFields}
      prefix={`${prefix}entry`}
      side={side}
      rows={draft.entryRows}
      onChange={(entryRows) => patch({ entryRows })}
      anchor={anchor}
      webhooks={whenWebhooks}
      triggerTimeframe={
        draft.entrySource === "indicator" || draft.entrySource === "trend"
          ? draft.indicatorTimeframe
          : null
      }
      gridClass={fieldRow5}
      fieldClass={fieldClass}
      labelClass={labelClass}
      groupFooter={
        order && onOrderChange
          ? (groupIndex) => {
              const key = entryGroupOrderKey(draft.entryRows, groupIndex);
              const lead = key === "lead";
              const values = lead ? order : extraOrders.orderFor(key);
              return (
                <GroupPositionSizing
                  groupIndex={groupIndex}
                  sameAsGroup1={lead || extraOrders.sharesLead(key)}
                  onSameAsGroup1={
                    lead
                      ? undefined
                      : (same) => extraOrders.setShares(key, same, order)
                  }
                >
                  <PerpsGroupOrderFields
                    order={values}
                    quoteLabel={quoteLabel ?? "USDT"}
                    baseCoin={baseCoin ?? "Token"}
                    fieldClass={fieldClass}
                    invalidFieldClass={botFieldInvalidClass}
                    gridClass={fieldRow}
                    named={lead && orderNamed}
                    namePrefix={prefix}
                    required={lead}
                    sizeInvalid={lead && orderSizeInvalid}
                    limitInvalid={lead && orderLimitInvalid}
                    onChange={(partial) => {
                      if (lead) {
                        onOrderChange(partial);
                        return;
                      }
                      extraOrders.patch(key, partial);
                    }}
                  />
                </GroupPositionSizing>
              );
            }
          : undefined
      }
    />
  );
}
