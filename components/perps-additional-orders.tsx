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
import { JoinWord } from "@/components/condition-join";
import {
  claimFromEntryDraft,
  entryConflictSlots,
  type EntryConditionDraft,
  type EntryStackRow,
} from "@/components/entry-condition-stack";
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
    };
  }
  return { kind: "unset" };
}

function parseType(value: string): PerpsAddConditionType {
  return value === "indicator" ||
    value === "trend" ||
    value === "price" ||
    value === "webhook"
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
            <section className="space-y-4 rounded-card border border-line bg-canvas px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-sm font-semibold text-ink">
                  Group {groupIndex + 1}
                  <span className="ml-2 text-hint font-normal text-ink-muted">
                    - Every condition in this group must be true.
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
                        label="Trigger"
                        slotIndex={index + 1}
                        slots={slots}
                        webhookIds={webhookIds}
                        webhooks={webhooks}
                        side={side}
                        fieldClass={fieldClass}
                        gridClass={gridClass}
                        conditionGrid={conditionGrid}
                        column={column}
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
  onType,
  onDraft,
}: {
  condition: PerpsAddCondition;
  label: "Condition Type" | "Trigger";
  slotIndex: number;
  slots: ReturnType<typeof entryConflictSlots>;
  webhookIds: string[];
  webhooks: readonly { id: string; name: string }[];
  side: "long" | "short";
  fieldClass: string;
  gridClass: string;
  conditionGrid: string;
  column: boolean;
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
          className={label === "Condition Type" ? "whitespace-nowrap" : undefined}
          required
        >
          <AppSelect
            value={type}
            onChange={(event) => onType(parseType(event.target.value))}
            className={conditionFieldClass(fieldClass, column)}
          >
            <option value="">
              {label === "Condition Type" ? "Select Condition Type" : "Select Trigger"}
            </option>
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
          <BotField label="Webhook" className="lg:col-span-2" required>
            <AppSelect
              value={draft.webhookId}
              onChange={(event) => onDraft({ webhookId: event.target.value })}
              className={fieldClass}
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
        gridClass={gridClass}
        onChange={onChange}
      />
    </GroupPositionSizing>
  );
}
