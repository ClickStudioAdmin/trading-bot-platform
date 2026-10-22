"use client";

import { useEffect, useRef } from "react";
import { AppSelect } from "@/components/app-select";
import {
  IndicatorStartFields,
  TrendStartFields,
} from "@/components/bot-indicator-fields";
import {
  BotField,
  conditionFieldClass,
  useBotColumnLayout,
} from "@/components/bot-form-chrome";
import {
  AddConditionButton,
  RemoveConditionButton,
} from "@/components/condition-group";
import { CONDITION_GROUP_HELPER, JoinWord } from "@/components/condition-join";
import {
  claimFromEntryDraft,
  entryConflictSlots,
  type EntryConditionDraft,
  type EntryStackRow,
} from "@/components/entry-condition-stack";
import { ProtectionFields } from "@/components/protection-fields";
import { RetraceFields } from "@/components/retrace-fields";
import { useDeskFormStatus } from "@/components/stay-on-page-form";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import type { DcaIndicatorKind, DcaIndicatorTimeframe } from "@/lib/dca/indicators";
import {
  GroupPositionSizing,
  PerpsGroupOrderFields,
} from "@/components/entry-group-order";
import {
  appendPerpsAddCondition,
  appendPerpsAddOrderGroup,
  countPerpsAddConditions,
  perpsAddConditionDraftForType,
  positiveSizingText,
  revealGroupOrder,
  type PerpsAddCondition,
  type PerpsAddConditionDraft,
  type PerpsAddConditionType,
  type PerpsAddOrderGroup,
  type PerpsAddOrderValues,
} from "@/lib/futures/perps-add-condition";
import {
  STRATEGY_CONDITION_CAP,
  entryKindDisabled,
  entryWebhookIdDisabled,
  priceChoiceConflicts,
} from "@/lib/strategy/expr";

export type { PerpsAddConditionType, PerpsAddOrderGroup };

function entryDraftFromAdd(condition: PerpsAddCondition): EntryConditionDraft {
  if (condition.type === "retrace") {
    return {
      kind: "retrace",
      position: true,
      source: condition.draft.triggerBy,
      from: condition.draft.retraceFrom,
      pct: condition.draft.retracePct,
      lookback: condition.draft.retraceLookback,
      timeframe: condition.draft.timeframe,
    };
  }
  if (condition.type === "protection") {
    return { kind: "unset" };
  }
  if (condition.type === "price") {
    return {
      kind: "price",
      triggerBy: condition.draft.triggerBy,
      compare: condition.draft.triggerCompare,
      price: condition.draft.triggerPrice,
    };
  }
  if (condition.type === "webhook") {
    return { kind: "webhook", webhookId: condition.draft.webhookId };
  }
  if (condition.type === "indicator" || condition.type === "trend") {
    return {
      kind: condition.type,
      indicatorKind: condition.draft.kind,
      timeframe: condition.draft.timeframe,
      compare: condition.draft.compare,
      level: condition.draft.level,
      period: condition.draft.period,
      slowPeriod: condition.draft.slowPeriod,
      multiplier: condition.draft.multiplier,
      divergenceWhen: condition.draft.divergenceWhen,
      divergenceStyle: condition.draft.divergenceStyle,
      pivotBars: condition.draft.pivotBars,
      span: condition.draft.span,
      minPricePct: condition.draft.minPricePct,
      minRsi: condition.draft.minRsi,
    };
  }
  return { kind: "unset" };
}

function parseType(value: string): PerpsAddConditionType {
  return value === "indicator" ||
    value === "trend" ||
    value === "price" ||
    value === "retrace" ||
    value === "webhook" ||
    value === "protection"
    ? value
    : "";
}

export function PerpsAdditionalOrders({
  groups,
  onGroupsChange,
  quoteLabel,
  baseCoin,
  fieldClass,
  gridClass,
  fieldsClass,
  side = "long",
  webhooks = [],
  showErrors = false,
  invalidFieldClass,
}: {
  groups: PerpsAddOrderGroup[];
  onGroupsChange: (next: PerpsAddOrderGroup[]) => void;
  quoteLabel: string;
  baseCoin: string;
  fieldClass: string;
  gridClass: string;
  fieldsClass?: string;
  side?: "long" | "short";
  webhooks?: readonly { id: string; name: string }[];
  showErrors?: boolean;
  invalidFieldClass?: string;
}) {
  const { markDirty } = useDeskFormStatus();
  const column = useBotColumnLayout();
  const groupsRef = useRef(groups);
  const conditionGrid = fieldsClass ?? gridClass;
  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  function commit(next: PerpsAddOrderGroup[]) {
    groupsRef.current = next;
    onGroupsChange(next);
    markDirty();
  }

  function updateGroup(
    groupKey: string,
    update: (group: PerpsAddOrderGroup) => PerpsAddOrderGroup,
  ) {
    commit(
      groupsRef.current.map((group) =>
        group.key === groupKey ? update(group) : group,
      ),
    );
  }

  function patchCondition(
    group: PerpsAddOrderGroup,
    conditionKey: string,
    update: (condition: PerpsAddCondition) => PerpsAddCondition,
  ): PerpsAddOrderGroup {
    if (group.lead.key === conditionKey) {
      return { ...group, lead: update(group.lead) };
    }
    return {
      ...group,
      conditions: group.conditions.map((condition) =>
        condition.key === conditionKey ? update(condition) : condition,
      ),
    };
  }

  function chooseType(
    group: PerpsAddOrderGroup,
    condition: PerpsAddCondition,
    next: PerpsAddConditionType,
  ) {
    updateGroup(group.key, (current) =>
      patchCondition(current, condition.key, (item) => ({
        ...item,
        type: next,
        draft: perpsAddConditionDraftForType(next, side, item.draft),
      })),
    );
  }

  function patchDraft(
    group: PerpsAddOrderGroup,
    condition: PerpsAddCondition,
    partial: Partial<PerpsAddConditionDraft>,
  ) {
    updateGroup(group.key, (current) =>
      patchCondition(current, condition.key, (item) => ({
        ...item,
        draft: { ...item.draft, ...partial },
      })),
    );
  }

  function patchOrder(
    groupKey: string,
    partial: Partial<PerpsAddOrderValues>,
  ) {
    updateGroup(groupKey, (group) => ({
      ...group,
      order: { ...group.order, ...partial },
    }));
  }

  const canAdd = countPerpsAddConditions(groups) < STRATEGY_CONDITION_CAP;

  return (
    <div className="space-y-3">
      {groups.map((group, groupIndex) => {
        const rows: EntryStackRow[] = group.conditions.map((condition) => ({
          key: condition.key,
          join: "and",
          draft: entryDraftFromAdd(condition),
        }));
        const leadDraft = entryDraftFromAdd(group.lead);
        const slots = entryConflictSlots(
          {
            kind:
              leadDraft.kind === "unset" || leadDraft.kind === "filter"
                ? "price"
                : leadDraft.kind,
            webhookId: leadDraft.kind === "webhook" ? leadDraft.webhookId : "",
            claim: claimFromEntryDraft(leadDraft),
          },
          rows,
        );
        const webhookIds = webhooks.map((hook) => hook.id);
        return (
          <div key={group.key} className="space-y-3">
            {groupIndex > 0 ? <JoinWord label="Or" /> : null}
            <section className="condition-group space-y-4 rounded-card border border-line bg-canvas px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-sm font-semibold text-ink">
                  Group {groupIndex + 1}
                  <span className="ml-2 text-hint font-normal text-ink-muted">
                    - {CONDITION_GROUP_HELPER}
                  </span>
                </h3>
                {groupIndex > 0 ? (
                  <RemoveConditionButton
                    scope="group"
                    onClick={() =>
                      commit(groupsRef.current.filter((item) => item.key !== group.key))
                    }
                  />
                ) : null}
              </div>
              <ConditionFields
                condition={group.lead}
                label="Condition Type"
                slotIndex={0}
                slots={slots}
                webhookIds={webhookIds}
                webhooks={webhooks}
                side={side}
                fieldClass={fieldClass}
                gridClass={gridClass}
                conditionGrid={conditionGrid}
                column={column}
                showErrors={showErrors}
                invalidFieldClass={invalidFieldClass}
                onType={(next) => chooseType(group, group.lead, next)}
                onDraft={(partial) => patchDraft(group, group.lead, partial)}
              />
              {group.conditions.map((condition, index) => (
                <div key={condition.key} className="space-y-3">
                  <JoinWord label="And" />
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3">
                    <div className="min-w-0">
                      <ConditionFields
                        condition={condition}
                        label="Condition Type"
                        slotIndex={index + 1}
                        slots={slots}
                        webhookIds={webhookIds}
                        webhooks={webhooks}
                        side={side}
                        fieldClass={fieldClass}
                        gridClass={gridClass}
                        conditionGrid={conditionGrid}
                        column={column}
                        showErrors={showErrors}
                        invalidFieldClass={invalidFieldClass}
                        onType={(next) => chooseType(group, condition, next)}
                        onDraft={(partial) => patchDraft(group, condition, partial)}
                      />
                    </div>
                    <RemoveConditionButton
                      scope="condition"
                      onClick={() =>
                        updateGroup(group.key, (current) => ({
                          ...current,
                          conditions: current.conditions.filter(
                            (item) => item.key !== condition.key,
                          ),
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
              {canAdd ? (
                <AddConditionButton
                  onClick={() =>
                    updateGroup(group.key, (current) =>
                      appendPerpsAddCondition(current, side),
                    )
                  }
                />
              ) : null}
              {group.lead.type === "" ? null : (
              <OrderFields
                groupIndex={groupIndex}
                sameAsGroup1={group.sameAsGroup1 !== false}
                onSameAsGroup1={(same) => {
                  const leadOrder = groupsRef.current[0]?.order ?? group.order;
                  updateGroup(group.key, (current) => ({
                    ...current,
                    sameAsGroup1: same,
                    order: same
                      ? current.order
                      : revealGroupOrder(current.order, leadOrder),
                  }));
                }}
                order={group.order}
                quoteLabel={quoteLabel}
                baseCoin={baseCoin}
                fieldClass={fieldClass}
                gridClass={gridClass}
                showErrors={showErrors}
                invalidFieldClass={invalidFieldClass}
                onChange={(partial) => patchOrder(group.key, partial)}
              />
              )}
            </section>
          </div>
        );
      })}
      {canAdd ? (
        <AddConditionButton
          label="Add Condition Group"
          onClick={() => commit(appendPerpsAddOrderGroup(groupsRef.current, side))}
        />
      ) : null}
    </div>
  );
}

function ConditionFields({
  condition,
  label,
  slotIndex,
  slots,
  webhookIds,
  webhooks,
  side,
  fieldClass,
  gridClass,
  conditionGrid,
  column,
  showErrors = false,
  invalidFieldClass,
  onType,
  onDraft,
}: {
  condition: PerpsAddCondition;
  label: "Condition Type";
  slotIndex: number;
  slots: ReturnType<typeof entryConflictSlots>;
  webhookIds: string[];
  webhooks: readonly { id: string; name: string }[];
  side: "long" | "short";
  fieldClass: string;
  gridClass: string;
  conditionGrid: string;
  column: boolean;
  showErrors?: boolean;
  invalidFieldClass?: string;
  onType: (next: PerpsAddConditionType) => void;
  onDraft: (partial: Partial<PerpsAddConditionDraft>) => void;
}) {
  const { type, draft } = condition;
  const listed =
    type === "webhook" &&
    draft.webhookId &&
    !webhooks.some((hook) => hook.id === draft.webhookId)
      ? [...webhooks, { id: draft.webhookId, name: "Webhook (removed)" }]
      : webhooks;
  return (
    <div className="space-y-3">
      <div className={gridClass}>
        <BotField
          label={label}
          className="whitespace-nowrap"
        >
          <AppSelect
            value={type}
            onChange={(event) => onType(parseType(event.target.value))}
            className={conditionFieldClass(fieldClass, column)}
          >
            <option value="">Select Condition Type</option>
            <option
              value="indicator"
              disabled={entryKindDisabled({
                slots,
                index: slotIndex,
                kind: "indicator",
                webhookIds,
              })}
            >
              Indicator
            </option>
            <option
              value="trend"
              disabled={entryKindDisabled({
                slots,
                index: slotIndex,
                kind: "trend",
                webhookIds,
              })}
            >
              Trend
            </option>
            <option
              value="price"
              disabled={entryKindDisabled({
                slots,
                index: slotIndex,
                kind: "price",
                webhookIds,
              })}
            >
              Price Cross
            </option>
            <option value="retrace">Retrace</option>
            <option value="protection">Position protection</option>
            <option
              value="webhook"
              disabled={entryKindDisabled({
                slots,
                index: slotIndex,
                kind: "webhook",
                webhookIds,
              })}
            >
              Signal Webhook
            </option>
          </AppSelect>
        </BotField>
      </div>
      {type === "indicator" ? (
        <div className={conditionGrid}>
          <IndicatorStartFields
            side={side}
            prefix={`add-${condition.key}`}
            kind={draft.kind}
            timeframe={draft.timeframe}
            compare={draft.compare}
            level={draft.level}
            period={draft.period}
            slowPeriod={draft.slowPeriod}
            multiplier={draft.multiplier}
            onKindChange={(kind) => onDraft({ kind })}
            onTimeframeChange={(timeframe) => onDraft({ timeframe })}
            onCompareChange={(compare) => onDraft({ compare })}
            onLevelChange={(level) => onDraft({ level })}
            onPeriodChange={(period) => onDraft({ period })}
            onSlowPeriodChange={(slowPeriod) => onDraft({ slowPeriod })}
            onMultiplierChange={(multiplier) => onDraft({ multiplier })}
            divergenceWhen={draft.divergenceWhen}
            divergenceStyle={draft.divergenceStyle}
            pivotBars={draft.pivotBars}
            span={draft.span}
            minPricePct={draft.minPricePct}
            minRsi={draft.minRsi}
            onDivergenceWhenChange={(divergenceWhen) => onDraft({ divergenceWhen })}
            onDivergenceStyleChange={(divergenceStyle) => onDraft({ divergenceStyle })}
            onPivotBarsChange={(pivotBars) => onDraft({ pivotBars })}
            onSpanChange={(span) => onDraft({ span })}
            onMinPricePctChange={(minPricePct) => onDraft({ minPricePct })}
            onMinRsiChange={(minRsi) => onDraft({ minRsi })}
            seriesSlots={slots}
            seriesIndex={slotIndex}
          />
        </div>
      ) : null}
      {type === "trend" ? (
        <div className={conditionGrid}>
          <TrendStartFields
            side={side}
            prefix={`add-${condition.key}`}
            kind={draft.kind === "supertrend" ? draft.kind : "supertrend"}
            timeframe={draft.timeframe}
            compare={draft.compare}
            period={draft.period}
            multiplier={draft.multiplier}
            onKindChange={(kind: DcaIndicatorKind) => onDraft({ kind })}
            onTimeframeChange={(timeframe: DcaIndicatorTimeframe) =>
              onDraft({ timeframe })
            }
            onCompareChange={(compare) => onDraft({ compare })}
            onPeriodChange={(period) => onDraft({ period })}
            onMultiplierChange={(multiplier) => onDraft({ multiplier })}
            seriesSlots={slots}
            seriesIndex={slotIndex}
          />
        </div>
      ) : null}
      {type === "retrace" ? (
        <div className={conditionGrid}>
          <RetraceFields
            prefix=""
            draft={{
              source: draft.triggerBy,
              from: draft.retraceFrom,
              pct: draft.retracePct,
              lookback: draft.retraceLookback,
              timeframe: draft.timeframe,
            }}
            onChange={(next) =>
              onDraft({
                triggerBy: next.source,
                retraceFrom: next.from,
                retracePct: next.pct,
                retraceLookback: next.lookback,
                timeframe: next.timeframe,
              })
            }
            fieldClass={fieldClass}
            labelClass="flex min-w-0 flex-col gap-1 text-sm text-ink"
            slots={slots}
            slotIndex={slotIndex}
            position
          />
        </div>
      ) : null}
      {type === "protection" ? (
        <div className={conditionGrid}>
          <ProtectionFields
            prefix=""
            draft={{
              is: draft.protectionIs,
              amount: draft.protectionAmount,
              pct: draft.protectionPct,
            }}
            onChange={(next) =>
              onDraft({
                protectionIs: next.is,
                protectionAmount: next.amount,
                protectionPct: next.pct,
              })
            }
            fieldClass={fieldClass}
            labelClass="flex min-w-0 flex-col gap-1 text-sm text-ink"
          />
        </div>
      ) : null}
      {type === "price" ? (
        <div className={conditionGrid}>
          <BotField label="Price source" required>
            <AppSelect
              value={draft.triggerBy}
              onChange={(event) =>
                onDraft({
                  triggerBy:
                    event.target.value === "mark" || event.target.value === "index"
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
                    slots,
                    slotIndex,
                    {
                      source: draft.triggerBy,
                      compare: draft.triggerCompare,
                      price: draft.triggerPrice,
                    },
                    { source },
                  )}
                >
                  {source === "last" ? "Last is" : source === "mark" ? "Mark is" : "Index is"}
                </option>
              ))}
            </AppSelect>
          </BotField>
          <BotField label="Compare" required>
            <AppSelect
              value={draft.triggerCompare}
              onChange={(event) =>
                onDraft({
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
              onChange={(triggerPrice) => onDraft({ triggerPrice })}
              allowDecimal
              className={fieldClass}
            />
          </BotField>
        </div>
      ) : null}
      {type === "webhook" ? (
        <div className={conditionGrid}>
          <BotField label="Webhook" className="col-span-full" required>
            <AppSelect
              value={draft.webhookId}
              onChange={(event) => onDraft({ webhookId: event.target.value })}
              className={
                showErrors && draft.webhookId.trim() === ""
                  ? conditionFieldClass(invalidFieldClass ?? fieldClass, column)
                  : conditionFieldClass(fieldClass, column)
              }
            >
              <option value="">
                {webhooks.length === 0
                  ? "Create a Signal webhook first"
                  : "Pick a webhook"}
              </option>
              {listed.map((hook) => (
                <option
                  key={hook.id}
                  value={hook.id}
                  disabled={entryWebhookIdDisabled({
                    slots,
                    index: slotIndex,
                    webhookId: hook.id,
                  })}
                >
                  {hook.name}
                </option>
              ))}
            </AppSelect>
          </BotField>
        </div>
      ) : null}
    </div>
  );
}

function OrderFields({
  groupIndex,
  sameAsGroup1,
  onSameAsGroup1,
  order,
  quoteLabel,
  baseCoin,
  fieldClass,
  gridClass,
  showErrors = false,
  invalidFieldClass,
  onChange,
}: {
  groupIndex: number;
  sameAsGroup1: boolean;
  onSameAsGroup1: (same: boolean) => void;
  order: PerpsAddOrderValues;
  quoteLabel: string;
  baseCoin: string;
  fieldClass: string;
  gridClass: string;
  showErrors?: boolean;
  invalidFieldClass?: string;
  onChange: (partial: Partial<PerpsAddOrderValues>) => void;
}) {
  return (
    <GroupPositionSizing
      groupIndex={groupIndex}
      sameAsGroup1={sameAsGroup1}
      onSameAsGroup1={onSameAsGroup1}
    >
      <PerpsGroupOrderFields
        order={order}
        quoteLabel={quoteLabel}
        baseCoin={baseCoin}
        fieldClass={fieldClass}
        invalidFieldClass={invalidFieldClass}
        gridClass={gridClass}
        required
        sizeInvalid={showErrors && !positiveSizingText(order.size)}
        limitInvalid={
          showErrors &&
          order.orderType === "limit" &&
          !positiveSizingText(order.limitPrice)
        }
        onChange={onChange}
      />
    </GroupPositionSizing>
  );
}
