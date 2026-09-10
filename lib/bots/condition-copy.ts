import {
  formatDcaFilterReason,
  type DcaFilterSpec,
} from "@/lib/dca/filters";
import { formatDcaIndicatorStartLabel } from "@/lib/dca/indicators";
import type { DcaIndicatorStart, DcaPriceTrigger, DcaStartKind } from "@/lib/dca/playbook";
import type { FuturesAutomationEntry, FuturesTriggerCompare } from "@/lib/futures/automation";
import type { FuturesAction, FuturesSide, FuturesTrigger } from "@/lib/futures/model";

export function joinConditionReasons(
  parts: Array<string | null | undefined>,
): string {
  return parts
    .map((row) => String(row ?? "").trim())
    .filter(Boolean)
    .join(", and ");
}

export function formatPriceCrossReason(input: {
  source: FuturesTrigger | "last" | "mark" | "index";
  compare: FuturesTriggerCompare;
  level: number;
  price?: number | null;
}): string {
  const source =
    input.source === "mark"
      ? "Mark"
      : input.source === "index"
        ? "Index"
        : "Last";
  const when =
    input.compare === "lte" ? "at or below" : "at or above";
  const now =
    input.price != null && Number.isFinite(input.price) && input.price > 0
      ? ` (now ${formatReasonNumber(input.price)})`
      : "";
  return `${source} is ${when} ${formatReasonNumber(input.level)}${now}`;
}

export function formatIndicatorStartReason(
  start: DcaIndicatorStart,
  side: FuturesSide,
): string {
  return formatDcaIndicatorStartLabel({
    kind: start.kind,
    compare: start.compare,
    level: start.level,
    period: start.period,
    slowPeriod: start.slowPeriod,
    multiplier: start.multiplier,
    timeframe: start.timeframe,
    side,
  });
}

export function formatSecondaryEntryReason(
  spec: DcaFilterSpec,
  side: FuturesSide,
): string {
  return `Secondary Entry ${formatDcaFilterReason(spec, side)}`;
}

export function formatHardExitReason(
  spec: DcaFilterSpec,
  side: FuturesSide,
): string {
  return formatDcaFilterReason(spec, side);
}

export function formatBreakevenReason(input: {
  side: FuturesSide;
  entryPrice: number;
  mark: number;
  activationPct: number;
  offsetPct?: number | null;
  stop?: number | null;
}): string {
  const move = moveFromEntryPct(input.side, input.entryPrice, input.mark);
  const direction = input.side === "short" ? "down" : "up";
  const activation = formatReasonNumber(input.activationPct);
  const offset =
    input.offsetPct != null && Number.isFinite(input.offsetPct)
      ? formatReasonNumber(input.offsetPct)
      : "0";
  const stop =
    input.stop != null && input.stop > 0
      ? `; stop set to ${formatReasonNumber(input.stop)} (offset ${offset}%)`
      : ` (activation ${activation}%)`;
  if (input.stop != null && input.stop > 0) {
    return `${capitalize(input.side)} ${direction} ${move}% from entry (activation ${activation}%)${stop}`;
  }
  return `${capitalize(input.side)} ${direction} ${move}% from entry (activation ${activation}%)`;
}

export function formatFuturesEntryReasons(input: {
  entrySource: FuturesAutomationEntry;
  side: FuturesSide;
  triggerBy: FuturesTrigger;
  triggerCompare: FuturesTriggerCompare;
  triggerPrice: number;
  price?: number | null;
  indicator?: DcaIndicatorStart | null;
  confirm?: DcaFilterSpec | null;
}): string {
  const start =
    input.entrySource === "webhook"
      ? "Signal webhook"
      : input.entrySource === "price"
        ? formatPriceCrossReason({
            source: input.triggerBy,
            compare: input.triggerCompare,
            level: input.triggerPrice,
            price: input.price,
          })
        : input.indicator
          ? formatIndicatorStartReason(input.indicator, input.side)
          : input.entrySource === "trend"
            ? "Trend"
            : "Indicator";
  return joinConditionReasons([
    start,
    input.confirm
      ? formatSecondaryEntryReason(input.confirm, input.side)
      : null,
  ]);
}

export function formatDcaStartReasons(input: {
  startKind: DcaStartKind;
  side: FuturesSide;
  armTrigger?: DcaPriceTrigger | null;
  indicator?: DcaIndicatorStart | null;
  confirm?: DcaFilterSpec | null;
  price?: number | null;
}): string {
  const start =
    input.startKind === "webhook"
      ? "Signal webhook"
      : input.startKind === "price" && input.armTrigger
        ? formatPriceCrossReason({
            source: input.armTrigger.triggerBy,
            compare: input.armTrigger.compare,
            level: input.armTrigger.price,
            price: input.price,
          })
        : input.startKind === "indicator" || input.startKind === "trend"
          ? input.indicator
            ? formatIndicatorStartReason(input.indicator, input.side)
            : input.startKind === "trend"
              ? "Trend"
              : "Indicator"
          : null;
  return joinConditionReasons([
    start,
    input.confirm
      ? formatSecondaryEntryReason(input.confirm, input.side)
      : null,
  ]);
}

export function futuresActionLabel(
  action: FuturesAction,
  closeSide?: FuturesSide | null,
): string {
  if (action === "flatten") {
    return closeSide === "short" ? "Close short" : "Close long";
  }
  return action === "sell" ? "Sell" : "Buy";
}

export function futuresFiredMessage(input: {
  name: string;
  symbol: string;
  action: FuturesAction;
  closeSide?: FuturesSide | null;
  reasons: string;
  webhook?: boolean;
}): string {
  const verb = input.webhook ? "Signal fired" : "fired";
  const name = input.name.trim() || "Bot";
  const action = futuresActionLabel(input.action, input.closeSide);
  const why = input.reasons.trim();
  if (why) {
    return `${name} ${verb} on ${input.symbol}. ${action} because ${why}.`;
  }
  return `${name} ${verb} on ${input.symbol}.`;
}

export function futuresHardExitMessage(input: {
  name: string;
  symbol: string;
  reasons: string;
}): string {
  const name = input.name.trim() || "Bot";
  const why = input.reasons.trim();
  if (why) {
    return `Hard Exit flattened ${name} on ${input.symbol}. ${why}.`;
  }
  return `Hard Exit flattened ${name} on ${input.symbol}.`;
}

export function futuresBreakevenMessage(input: {
  name: string;
  symbol: string;
  reasons: string;
}): string {
  const name = input.name.trim() || "Bot";
  const why = input.reasons.trim();
  if (why) {
    return `Moved stop to breakeven for ${name} on ${input.symbol}. ${why}.`;
  }
  return `Moved stop to breakeven for ${name} on ${input.symbol}.`;
}

function moveFromEntryPct(
  side: FuturesSide,
  entryPrice: number,
  mark: number,
): string {
  if (!(entryPrice > 0) || !(mark > 0)) {
    return "0";
  }
  const raw =
    side === "short"
      ? ((entryPrice - mark) / entryPrice) * 100
      : ((mark - entryPrice) / entryPrice) * 100;
  return formatReasonNumber(Math.abs(raw));
}

function formatReasonNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }
  return String(Number(value.toPrecision(8)));
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
