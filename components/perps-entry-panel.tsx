"use client";

import { useEffect, useRef } from "react";
import { AppCheck } from "@/components/app-check";
import { AppSelect } from "@/components/app-select";
import {
  IndicatorStartFields,
  TrendStartFields,
} from "@/components/bot-indicator-fields";
import {
  BotField,
  BotFormGroup,
  HintLabel,
} from "@/components/bot-form-chrome";
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
  oppositeIndicatorCompare,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "@/lib/dca/indicators";
import type { DcaIndicatorStart } from "@/lib/dca/playbook";
import { parseDcaIndicatorCompare } from "@/lib/dca/indicators";
import type { FuturesAutomationFormValues } from "@/lib/futures/automation";
import { parseAutomationEntry } from "@/lib/futures/automation";
import type { PerpsEntryLeg } from "@/lib/futures/conditions";
import type { FuturesSide, FuturesTrigger } from "@/lib/futures/model";
import {
  confirmFromEntryStack,
  entryKindDisabled,
  entryWebhookIdDisabled,
  type EntryStack,
} from "@/lib/strategy/expr";

export type PerpsEntryDraft = {
  entrySource: FuturesAutomationFormValues["entrySource"];
  webhookId: string;
  triggerBy: FuturesTrigger;
  triggerCompare: "gte" | "lte";
  triggerPrice: string;
  skipIfOpen: boolean;
  indicatorKind: DcaIndicatorKind;
  indicatorTimeframe: DcaIndicatorTimeframe;
  indicatorCompare: string;
  indicatorLevel: string;
  indicatorPeriod: string;
  indicatorSlowPeriod: string;
  indicatorMultiplier: string;
  entryRows: EntryStackRow[];
};

function indicatorKindFor(source: string, kind?: DcaIndicatorKind | null): DcaIndicatorKind {
  if (source === "trend") {
    return "supertrend";
  }
  return kind && kind !== "supertrend" ? kind : "rsi";
}

export function perpsEntryDraftFromLayer(
  layer: FuturesAutomationFormValues,
  side: FuturesSide,
): PerpsEntryDraft {
  const kind = indicatorKindFor(layer.entrySource, layer.indicator?.kind);
  return {
    entrySource: layer.entrySource,
    webhookId: layer.webhookId,
    triggerBy: layer.triggerBy,
    triggerCompare: layer.triggerCompare,
    triggerPrice: layer.triggerPrice,
    skipIfOpen: layer.skipIfOpen,
    indicatorKind: kind,
    indicatorTimeframe: layer.indicator?.timeframe ?? "15",
    indicatorCompare:
      layer.indicator?.compare ??
      indicatorCompareForDirection(side, kind, ""),
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

export function initialPerpsEntryDrafts(layer: FuturesAutomationFormValues): {
  long: PerpsEntryDraft;
  short: PerpsEntryDraft;
} {
  if (layer.direction === "both" && layer.shortEntry) {
    return {
      long: perpsEntryDraftFromLayer(layer, "long"),
      short: perpsEntryDraftFromLeg(layer.shortEntry, "short"),
    };
  }
  const shortSide =
    layer.formAction === "sell" || layer.formAction === "close_short";
  if (shortSide) {
    const short = perpsEntryDraftFromLayer(layer, "short");
    return { short, long: oppositePerpsEntryDraft(short, "long") };
  }
  const long = perpsEntryDraftFromLayer(layer, "long");
  return { long, short: oppositePerpsEntryDraft(long, "short") };
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

function flipRows(rows: EntryStackRow[], side: FuturesSide): EntryStackRow[] {
  return rows.map((row) => {
    if (row.draft.kind === "price") {
      return {
        ...row,
        draft: {
          ...row.draft,
          compare: row.draft.compare === "gte" ? "lte" : "gte",
        },
      };
    }
    if (row.draft.kind === "indicator" || row.draft.kind === "trend") {
      return {
        ...row,
        draft: {
          ...row.draft,
          compare: indicatorCompareForDirection(
            side,
            row.draft.indicatorKind,
            "",
          ),
          level:
            row.draft.indicatorKind === "rsi"
              ? side === "short"
                ? "70"
                : "30"
              : row.draft.level,
        },
      };
    }
    return row;
  });
}

/** Copy a side and flip price and indicator direction so the other side starts opposite. */
export function oppositePerpsEntryDraft(
  draft: PerpsEntryDraft,
  side: FuturesSide,
): PerpsEntryDraft {
  const kind = draft.indicatorKind;
  return {
    ...draft,
    triggerCompare: draft.triggerCompare === "gte" ? "lte" : "gte",
    indicatorCompare:
      kind === "rsi"
        ? oppositeIndicatorCompare(kind, draft.indicatorCompare)
        : indicatorCompareForDirection(side, kind, ""),
    indicatorLevel:
      kind === "rsi"
        ? side === "short"
          ? "70"
          : "30"
        : draft.indicatorLevel,
    entryRows: flipRows(draft.entryRows, side),
  };
}

export function indicatorFromPerpsDraft(
  draft: PerpsEntryDraft,
): DcaIndicatorStart | null {
  if (draft.entrySource !== "indicator" && draft.entrySource !== "trend") {
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
    closing &&
    (draft.entrySource === "indicator" || draft.entrySource === "trend")
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
}) {
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  function patch(partial: Partial<PerpsEntryDraft>) {
    const next = { ...draftRef.current, ...partial };
    draftRef.current = next;
    onChange(next);
  }
  const entrySlots = entryConflictSlots(
    { kind: closing ? "price" : draft.entrySource, webhookId: draft.webhookId },
    closing ? [] : draft.entryRows,
  );
  const webhookIds = webhooks.map((hook) => hook.id);
  const whenWebhooks =
    draft.webhookId && !webhooks.some((hook) => hook.id === draft.webhookId)
      ? [...webhooks, { id: draft.webhookId, name: "Webhook (removed)" }]
      : webhooks;
  return (
    <>
      <BotFormGroup>
        <div className={fieldRow}>
          <BotField label="Initial Order Trigger" required>
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
                const next = parseAutomationEntry(event.target.value);
                const partial: Partial<PerpsEntryDraft> = { entrySource: next };
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
                if (next === "indicator" && draft.indicatorKind === "supertrend") {
                  partial.indicatorKind = "rsi";
                  partial.indicatorCompare = indicatorCompareForDirection(
                    side,
                    "rsi",
                    "",
                  );
                  partial.indicatorPeriod = String(DEFAULT_DCA_RSI_PERIOD);
                  partial.indicatorLevel = side === "short" ? "70" : "30";
                }
                patch(partial);
              }}
              className={fieldClass}
            >
              <option
                value="price"
                disabled={entryKindDisabled({
                  slots: entrySlots,
                  index: 0,
                  kind: "price",
                  webhookIds,
                })}
              >
                Price cross
              </option>
              {closing ? null : <option value="indicator">Indicator</option>}
              {closing ? null : <option value="trend">Trend</option>}
              <option
                value="webhook"
                disabled={entryKindDisabled({
                  slots: entrySlots,
                  index: 0,
                  kind: "webhook",
                  webhookIds,
                })}
              >
                Signal webhook
              </option>
            </AppSelect>
          </BotField>
          {closing ? null : (
            <label
              className={`flex items-center gap-2 self-end pb-0.5 text-sm text-ink ${pairSpan}`}
            >
              <AppCheck
                name={`${prefix}skipIfOpen`}
                value="on"
                checked={draft.skipIfOpen}
                onChange={(event) => patch({ skipIfOpen: event.target.checked })}
              />
              <HintLabel
                text="Skip if this side is already open"
                hint="Off means each new cross or trigger can add size to the same row."
              />
            </label>
          )}
        </div>
      </BotFormGroup>
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
            />
          ) : draft.entrySource === "trend" && !closing ? (
            <TrendStartFields
              side={side}
              prefix={`${prefix}indicator`}
              kind={draft.indicatorKind}
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
            />
          ) : draft.entrySource === "webhook" ? (
            <BotField label="Webhook" className={pairSpan} required>
              <AppSelect
                name={`${prefix}webhookId`}
                value={draft.webhookId}
                onChange={(event) => patch({ webhookId: event.target.value })}
                className={fieldClass}
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
          ) : (
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
                  <option value="last">Last is</option>
                  <option value="mark">Mark is</option>
                  <option value="index">Index is</option>
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
                  <option value="gte">At or above</option>
                  <option value="lte">At or below</option>
                </AppSelect>
              </BotField>
              <BotField label="Price" required>
                <GroupedNumberInput
                  name={`${prefix}triggerPrice`}
                  value={draft.triggerPrice}
                  onChange={(triggerPrice) => patch({ triggerPrice })}
                  allowDecimal
                  className={fieldClass}
                />
              </BotField>
            </>
          )}
        </div>
      </BotFormGroup>
      {closing ? null : (
        <EntryConditionStack
          prefix={`${prefix}entry`}
          side={side}
          rows={draft.entryRows}
          onChange={(entryRows) => patch({ entryRows })}
          anchor={{ kind: draft.entrySource, webhookId: draft.webhookId }}
          webhooks={whenWebhooks}
          triggerTimeframe={
            draft.entrySource === "indicator" || draft.entrySource === "trend"
              ? draft.indicatorTimeframe
              : null
          }
          gridClass={fieldRow5}
          fieldClass={fieldClass}
          labelClass={labelClass}
        />
      )}
    </>
  );
}
