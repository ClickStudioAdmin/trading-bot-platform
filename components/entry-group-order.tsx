"use client";

import { useState, type ReactNode } from "react";
import { AppCheck } from "@/components/app-check";
import { AppSelect } from "@/components/app-select";
import {
  BotField,
  OrderTypePill,
  botSectionTitleClass,
} from "@/components/bot-form-chrome";
import { partitionByOr } from "@/components/condition-group";
import { useDeskFormStatus } from "@/components/stay-on-page-form";
import { GroupedNumberInput } from "@/components/usdt-size-input";
import {
  blankPerpsAddOrderValues,
  groupShowsPositionSizing,
  revealGroupOrder,
  sharesGroupLeadSizing,
  type PerpsAddOrderValues,
} from "@/lib/futures/perps-add-condition";
import type { StrategyJoin } from "@/lib/strategy/expr";

export function entryGroupOrderKey(
  rows: readonly { key: string; join: StrategyJoin }[],
  groupIndex: number,
): string {
  if (groupIndex === 0) {
    return "lead";
  }
  const groups = partitionByOr(rows);
  return groups[groupIndex]?.[0]?.key ?? `group-${groupIndex}`;
}

export function entryGroupShowsSizing(
  groupIndex: number,
  leadChosen: boolean,
  rows: readonly { join: StrategyJoin; draft: { kind: string } }[],
): boolean {
  return groupShowsPositionSizing(
    groupIndex,
    leadChosen,
    rows.map((row) => ({ join: row.join, kind: row.draft.kind })),
  );
}

export function useExtraGroupOrders() {
  const { markDirty } = useDeskFormStatus();
  const [orders, setOrders] = useState<Record<string, PerpsAddOrderValues>>({});
  const [sameAsLead, setSameAsLead] = useState<Record<string, boolean>>({});
  function orderFor(key: string): PerpsAddOrderValues {
    return orders[key] ?? blankPerpsAddOrderValues();
  }
  function sharesLead(key: string): boolean {
    return sameAsLead[key] !== false;
  }
  function patch(key: string, partial: Partial<PerpsAddOrderValues>) {
    setOrders((current) => {
      const prev = current[key] ?? blankPerpsAddOrderValues();
      return { ...current, [key]: { ...prev, ...partial } };
    });
    markDirty();
  }
  function setShares(key: string, same: boolean, seed?: PerpsAddOrderValues) {
    setSameAsLead((current) => ({ ...current, [key]: same }));
    if (!same && seed) {
      setOrders((current) => {
        const prev = current[key] ?? blankPerpsAddOrderValues();
        const revealed = revealGroupOrder(prev, seed);
        if (current[key] && revealed === prev) {
          return current;
        }
        return { ...current, [key]: revealed };
      });
    }
    markDirty();
  }
  return { orders, sameAsLead, orderFor, sharesLead, patch, setShares };
}

export function GroupPositionSizing({
  groupIndex,
  sameAsGroup1 = true,
  onSameAsGroup1,
  show = true,
  children,
}: {
  groupIndex: number;
  sameAsGroup1?: boolean;
  onSameAsGroup1?: (same: boolean) => void;
  show?: boolean;
  children: ReactNode;
}) {
  const shared = sharesGroupLeadSizing(groupIndex, sameAsGroup1);
  if (!show) {
    return null;
  }
  return (
    <div className="space-y-3">
      <h3 className={botSectionTitleClass}>Position Sizing</h3>
      {groupIndex > 0 ? (
        <label className="flex items-center gap-2 text-sm text-ink">
          <AppCheck
            checked={sameAsGroup1}
            onChange={(event) => onSameAsGroup1?.(event.target.checked)}
            className=""
          />
          Same as Group 1
        </label>
      ) : null}
      {shared ? null : children}
    </div>
  );
}

export function PerpsGroupOrderFields({
  order,
  quoteLabel,
  baseCoin,
  fieldClass,
  gridClass,
  onChange,
  named = false,
  namePrefix = "",
  required = false,
  sizeInvalid = false,
  limitInvalid = false,
  invalidFieldClass,
}: {
  order: PerpsAddOrderValues;
  quoteLabel: string;
  baseCoin: string;
  fieldClass: string;
  gridClass: string;
  onChange: (partial: Partial<PerpsAddOrderValues>) => void;
  named?: boolean;
  namePrefix?: string;
  required?: boolean;
  sizeInvalid?: boolean;
  limitInvalid?: boolean;
  invalidFieldClass?: string;
}) {
  const sizeClass = `${sizeInvalid && invalidFieldClass ? invalidFieldClass : fieldClass} !mt-0 ${
    order.sizeUnit === "usdt" ? "pl-7" : ""
  }`;
  const limitClass = limitInvalid && invalidFieldClass ? invalidFieldClass : fieldClass;
  return (
    <div className={gridClass}>
      <BotField label="Size" required={required}>
        <span className="relative mt-1 block">
          {order.sizeUnit === "usdt" ? (
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted">
              $
            </span>
          ) : null}
          <GroupedNumberInput
            name={named ? `${namePrefix}size` : undefined}
            value={order.size}
            onChange={(size) => onChange({ size })}
            allowDecimal
            className={sizeClass}
          />
        </span>
      </BotField>
      <BotField label="Unit" required={required}>
        {named ? (
          <input type="hidden" name={`${namePrefix}sizeUnit`} value={order.sizeUnit} />
        ) : null}
        <AppSelect
          value={order.sizeUnit}
          onChange={(event) =>
            onChange({
              sizeUnit: event.target.value === "qty" ? "qty" : "usdt",
              size: "",
            })
          }
          className={fieldClass}
        >
          <option value="usdt">{quoteLabel}</option>
          <option value="qty">{baseCoin}</option>
        </AppSelect>
      </BotField>
      <BotField label="Order" required={required}>
        <OrderTypePill
          name={named ? `${namePrefix}orderType` : undefined}
          value={order.orderType}
          onChange={(orderType) => onChange({ orderType })}
        />
      </BotField>
      {order.orderType === "limit" ? (
        <BotField label="Limit price" required={required}>
          <GroupedNumberInput
            name={named ? `${namePrefix}limitPrice` : undefined}
            value={order.limitPrice}
            onChange={(limitPrice) => onChange({ limitPrice })}
            allowDecimal
            className={limitClass}
          />
        </BotField>
      ) : null}
    </div>
  );
}

export function DcaGroupSizeFields({
  size,
  sizeUnit,
  onSize,
  onUnit,
  quoteLabel,
  baseCoin,
  fieldClass,
  gridClass,
  named = false,
  required = false,
  calculated = null,
  sizeError = null,
  sizeInputClass,
}: {
  size: string;
  sizeUnit: "qty" | "usdt";
  onSize: (size: string) => void;
  onUnit: (unit: "qty" | "usdt") => void;
  quoteLabel: string;
  baseCoin: string;
  fieldClass: string;
  gridClass: string;
  named?: boolean;
  required?: boolean;
  calculated?: string | null;
  sizeError?: string | null;
  sizeInputClass?: string;
}) {
  return (
    <div className={gridClass}>
      {calculated != null ? (
        named ? <input type="hidden" name="sizeUnit" value="usdt" /> : null
      ) : (
        <BotField label="Size unit" required={required}>
          <AppSelect
            name={named ? "sizeUnit" : undefined}
            value={sizeUnit}
            onChange={(event) => onUnit(event.target.value === "qty" ? "qty" : "usdt")}
            className={fieldClass}
          >
            <option value="usdt">{quoteLabel}</option>
            <option value="qty">{baseCoin}</option>
          </AppSelect>
        </BotField>
      )}
      <BotField
        label={calculated != null ? `Order size (${quoteLabel})` : "Order size"}
        required={required}
        error={sizeError ?? undefined}
      >
        {calculated != null ? (
          <>
            {named ? <input type="hidden" name="clipSize" value={calculated} /> : null}
            <p className={`${fieldClass} cursor-default text-ink-muted`} aria-label="Calculated order size">
              {calculated}
            </p>
          </>
        ) : (
          <GroupedNumberInput
            name={named ? "clipSize" : undefined}
            value={size}
            onChange={onSize}
            allowDecimal
            className={sizeInputClass ?? fieldClass}
          />
        )}
      </BotField>
    </div>
  );
}
