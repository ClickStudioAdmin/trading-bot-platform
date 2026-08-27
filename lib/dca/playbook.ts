import {
  parseFuturesQty,
  parseFuturesSide,
  parseFuturesSizeUnit,
  parseFuturesSymbol,
  parseFuturesOrderType,
  type FuturesOrderType,
  type FuturesSide,
  type FuturesTrigger,
} from "@/lib/futures/model";
import {
  parseFuturesTriggerCompare,
  triggerConditionMet,
  type FuturesTriggerCompare,
} from "@/lib/futures/automation";
import { parseFuturesTrigger } from "@/lib/futures/tpsl";
import { futuresPnlUsdt } from "@/lib/futures/math";
import { dcaDipPctAt, dcaPlannedExits } from "./grid";
import {
  indicatorStartMet,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "./indicators";

export type DcaStatus = "idle" | "armed" | "stop_adding";
export type DcaDirection = "long" | "short" | "both";
export type DcaStartKind = "immediate" | "price" | "webhook" | "indicator";
export type DcaMode = "position" | "order";
export type DcaExitBasis = "average" | "first_entry";
export type DcaMaxType = "orders" | "value";

export type DcaPriceTrigger = {
  triggerBy: FuturesTrigger;
  compare: FuturesTriggerCompare;
  price: number;
};

export type DcaLegState = {
  status: DcaStatus;
  clipsFilled: number;
  lastClipPrice: number | null;
  lastClipAtMs: number | null;
  firstFillPrice: number | null;
  breakevenDone: boolean;
};

export type DcaPlaybookConfig = {
  name: string;
  symbol: string;
  direction: DcaDirection;
  startKind: DcaStartKind;
  webhookId: string | null;
  dcaMode: DcaMode;
  clipSize: number;
  sizeUnit: "qty" | "usdt";
  maxClips: number | null;
  maxValue: number | null;
  dipPct: number | null;
  intervalMinutes: number | null;
  sizeMultiplier: number;
  deviationMultiplier: number;
  takeProfitPct: number | null;
  stopLossPct: number | null;
  takeProfitBasis: DcaExitBasis;
  stopLossBasis: DcaExitBasis;
  takeProfitOrderType: FuturesOrderType;
  stopLossOrderType: FuturesOrderType;
  breakevenActivationPct: number | null;
  breakevenOffsetPct: number | null;
  trailingTriggerPct: number | null;
  trailingPct: number | null;
  armTrigger: DcaPriceTrigger | null;
  disarmTrigger: DcaPriceTrigger | null;
  indicatorKind: DcaIndicatorKind | null;
  indicatorTimeframe: DcaIndicatorTimeframe | null;
  indicatorCompare: FuturesTriggerCompare | null;
  indicatorLevel: number | null;
};

export type DcaPlaybook = DcaPlaybookConfig & {
  id: string;
  userId: string;
  accountId: string;
  long: DcaLegState;
  short: DcaLegState;
  armConditionTrue: boolean;
  disarmConditionTrue: boolean;
  longIndicatorTrue: boolean;
  shortIndicatorTrue: boolean;
};

export const DEFAULT_DCA_NAME = "DCA";

export const IDLE_DCA_LEG: DcaLegState = {
  status: "idle",
  clipsFilled: 0,
  lastClipPrice: null,
  lastClipAtMs: null,
  firstFillPrice: null,
  breakevenDone: false,
};

export type DcaTickAction =
  | { kind: "none" }
  | { kind: "arm" }
  | { kind: "disarm" }
  | { kind: "clip" }
  | { kind: "close"; reason: "take_profit" | "stop_loss" }
  | { kind: "stop_adding" }
  | { kind: "breakeven" };

export type DcaTickDecision = {
  action: DcaTickAction;
  nextArmTrue: boolean;
  nextDisarmTrue: boolean;
  nextIndicatorTrue: boolean;
};

export function parseDcaStatus(value: unknown): DcaStatus {
  if (value === "armed" || value === "stop_adding") {
    return value;
  }
  return "idle";
}

export function parseDcaDirection(value: unknown): DcaDirection | null {
  if (value === "long" || value === "short" || value === "both") {
    return value;
  }
  return null;
}

export function parseDcaStartKind(value: unknown): DcaStartKind {
  if (
    value === "price" ||
    value === "webhook" ||
    value === "indicator"
  ) {
    return value;
  }
  return "immediate";
}

export function parseDcaMode(value: unknown): DcaMode {
  return value === "order" ? "order" : "position";
}

export function parseDcaExitOrderType(value: unknown): FuturesOrderType {
  const parsed = parseFuturesOrderType(value);
  return parsed.ok ? parsed.orderType : "market";
}

export type DcaAveragingKind = "dip" | "interval";
export type DcaIntervalUnit = "minutes" | "hours" | "days";

const INTERVAL_TO_MINUTES: Record<DcaIntervalUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

export function parseDcaAveragingKind(value: unknown): DcaAveragingKind {
  return value === "interval" ? "interval" : "dip";
}

export function parseDcaIntervalUnit(value: unknown): DcaIntervalUnit {
  if (value === "hours" || value === "days") {
    return value;
  }
  return "minutes";
}

export function dcaIntervalParts(minutes: number | null): {
  unit: DcaIntervalUnit;
  value: string;
} {
  if (minutes === null || !(minutes > 0)) {
    return { unit: "minutes", value: "" };
  }
  if (minutes % 1440 === 0) {
    return { unit: "days", value: String(minutes / 1440) };
  }
  if (minutes % 60 === 0) {
    return { unit: "hours", value: String(minutes / 60) };
  }
  return { unit: "minutes", value: String(minutes) };
}

export function formatDcaIntervalShort(minutes: number): string {
  if (minutes % 1440 === 0) {
    return `${minutes / 1440}d`;
  }
  if (minutes % 60 === 0) {
    return `${minutes / 60}h`;
  }
  return `${minutes}m`;
}

function parseIntervalMinutesFromForm(
  form: FormData,
  averaging: DcaAveragingKind,
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (averaging !== "interval") {
    return { ok: true, value: null };
  }
  const parsed = parseOptionalPositiveInt(
    form.get("intervalValue") ?? form.get("intervalMinutes"),
  );
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.value === null) {
    return parsed;
  }
  const unit = parseDcaIntervalUnit(form.get("intervalUnit"));
  const minutes = parsed.value * INTERVAL_TO_MINUTES[unit];
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 2_147_483_647) {
    return { ok: false, error: "Enter a smaller interval." };
  }
  return { ok: true, value: minutes };
}

export function dcaAveragingKind(
  playbook: Pick<DcaPlaybookConfig, "dcaMode" | "dipPct" | "intervalMinutes">,
): DcaAveragingKind {
  if (
    playbook.dcaMode !== "order" &&
    playbook.intervalMinutes !== null &&
    playbook.dipPct === null
  ) {
    return "interval";
  }
  return "dip";
}

export function parseDcaExitBasis(value: unknown): DcaExitBasis {
  return value === "first_entry" ? "first_entry" : "average";
}

export function parseDcaMaxType(value: unknown): DcaMaxType {
  return value === "value" ? "value" : "orders";
}

export function dcaMaxTypeFromCaps(
  maxClips: number | null,
  maxValue: number | null,
): DcaMaxType {
  if (maxClips === null && maxValue !== null) {
    return "value";
  }
  return "orders";
}

export function dcaEnabledSides(direction: DcaDirection): FuturesSide[] {
  if (direction === "both") {
    return ["long", "short"];
  }
  return [direction];
}

export function dcaStartListens(startKind: DcaStartKind): boolean {
  return (
    startKind === "price" ||
    startKind === "indicator" ||
    startKind === "webhook"
  );
}

export function dcaLegIsRunning(status: DcaStatus): boolean {
  return status === "armed" || status === "stop_adding";
}

export function dcaWebhookSignalApplies(input: {
  startKind: DcaStartKind;
  fromSignal: boolean;
  status: DcaStatus;
}): boolean {
  if (!input.fromSignal || input.startKind !== "webhook") {
    return true;
  }
  return dcaLegIsRunning(input.status);
}

export function dcaPlaybookIsRunning(
  playbook: Pick<DcaPlaybook, "long" | "short">,
): boolean {
  return dcaLegIsRunning(playbook.long.status) || dcaLegIsRunning(playbook.short.status);
}

export function dcaLegFor(
  playbook: DcaPlaybook,
  side: FuturesSide,
): DcaLegState {
  return side === "long" ? playbook.long : playbook.short;
}

export type DcaOpenHint = {
  orders: string;
  plannedTakeProfit: number | null;
  plannedStopLoss: number | null;
  plannedTrailing: number | null;
  takeProfitOrderType: FuturesOrderType;
  stopLossOrderType: FuturesOrderType;
};

export function dcaHintKey(symbol: string, side: FuturesSide): string {
  return `${symbol}:${side}`;
}

export function parseOptionalPositive(
  raw: unknown,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (text === "") {
    return { ok: true, value: null };
  }
  const value = Number(text);
  if (!(value > 0) || !Number.isFinite(value)) {
    return { ok: false, error: "Enter a positive number, or leave empty." };
  }
  return { ok: true, value };
}

export function parseOptionalNonNegative(
  raw: unknown,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (text === "") {
    return { ok: true, value: null };
  }
  const value = Number(text);
  if (!(value >= 0) || !Number.isFinite(value)) {
    return { ok: false, error: "Enter zero or a positive number, or leave empty." };
  }
  return { ok: true, value };
}

export function parseOptionalPositiveInt(
  raw: unknown,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const parsed = parseOptionalPositive(raw);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.value === null) {
    return parsed;
  }
  if (!Number.isInteger(parsed.value)) {
    return { ok: false, error: "Enter a whole number, or leave empty." };
  }
  return parsed;
}

export function parseDcaPlaybookId(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      text,
    )
  ) {
    return null;
  }
  return text;
}

export function parseDcaSaveIntent(raw: unknown): "save" | "arm" {
  return String(raw ?? "").trim() === "arm" ? "arm" : "save";
}

export function dcaPlaybookConflict(
  playbooks: readonly Pick<DcaPlaybook, "id" | "symbol">[],
  candidate: { id?: string | null; symbol: string },
): boolean {
  return playbooks.some(
    (row) => row.symbol === candidate.symbol && row.id !== candidate.id,
  );
}

export function parseDcaPlaybookName(
  raw: unknown,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(raw ?? "").trim() || DEFAULT_DCA_NAME;
  if (name.length > 40) {
    return { ok: false, error: "Name must be 40 characters or fewer." };
  }
  return { ok: true, name };
}

function parseMultiplier(
  raw: unknown,
  fallback: number,
): { ok: true; value: number } | { ok: false; error: string } {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (text === "") {
    return { ok: true, value: fallback };
  }
  const value = Number(text);
  if (!(value > 0) || !Number.isFinite(value)) {
    return { ok: false, error: "Multipliers must be greater than zero." };
  }
  return { ok: true, value };
}

function parseOptionalTrigger(
  enabled: boolean,
  triggerBy: unknown,
  compare: unknown,
  price: unknown,
  label: string,
): { ok: true; trigger: DcaPriceTrigger | null } | { ok: false; error: string } {
  if (!enabled) {
    return { ok: true, trigger: null };
  }
  const by = parseFuturesTrigger(triggerBy);
  const cmp = parseFuturesTriggerCompare(compare);
  const parsedPrice = parseOptionalPositive(price);
  if (!by.ok) {
    return { ok: false, error: `${label} needs last, mark, or index.` };
  }
  if (!cmp.ok) {
    return { ok: false, error: `${label} needs at or above, or at or below.` };
  }
  if (!parsedPrice.ok || parsedPrice.value === null) {
    return { ok: false, error: `${label} needs a price.` };
  }
  return {
    ok: true,
    trigger: {
      triggerBy: by.trigger,
      compare: cmp.compare,
      price: parsedPrice.value,
    },
  };
}

export function parseDcaPlaybookForm(
  form: FormData,
): { ok: true; config: DcaPlaybookConfig } | { ok: false; error: string } {
  const name = parseDcaPlaybookName(form.get("name"));
  const symbol = parseFuturesSymbol(form.get("symbol"));
  const direction =
    parseDcaDirection(form.get("direction")) ??
    parseFuturesSide(form.get("side"));
  const startKind = parseDcaStartKind(form.get("startKind"));
  const averagingRaw = form.get("averaging") ?? form.get("dcaMode");
  const averaging = parseDcaAveragingKind(averagingRaw);
  const restGrid =
    averaging !== "interval" &&
    (form.get("restGrid") === "1" ||
      averagingRaw === "order" ||
      form.get("dcaMode") === "order");
  const dcaMode: DcaMode = restGrid ? "order" : "position";
  const sizeUnit = parseFuturesSizeUnit(form.get("sizeUnit"));
  const clipSize = parseFuturesQty(form.get("clipSize"));
  const maxClips = parseOptionalPositiveInt(form.get("maxClips"));
  const maxValue = parseOptionalPositive(form.get("maxValue"));
  const maxType = parseDcaMaxType(form.get("maxType"));
  const dipPct =
    averaging === "interval"
      ? { ok: true as const, value: null }
      : parseOptionalPositive(form.get("dipPct"));
  const intervalMinutes = parseIntervalMinutesFromForm(form, averaging);
  const sizeMultiplier = parseMultiplier(form.get("sizeMultiplier"), 1);
  const deviationMultiplier = parseMultiplier(
    form.get("deviationMultiplier"),
    1,
  );
  const takeProfitPct = parseOptionalPositive(form.get("takeProfitPct"));
  const stopLossPct = parseOptionalPositive(form.get("stopLossPct"));
  const breakevenActivationPct = parseOptionalPositive(
    form.get("breakevenActivationPct"),
  );
  const breakevenOffsetPct = parseOptionalNonNegative(
    form.get("breakevenOffsetPct"),
  );
  const trailingTriggerPct = parseOptionalPositive(
    form.get("trailingTriggerPct"),
  );
  const trailingPct = parseOptionalPositive(form.get("trailingPct"));
  if (!name.ok) {
    return name;
  }
  if (!symbol.ok) {
    return symbol;
  }
  if (!direction) {
    return { ok: false, error: "Choose long, short, or both." };
  }
  if (!sizeUnit.ok) {
    return sizeUnit;
  }
  if (!clipSize.ok) {
    return { ok: false, error: "Enter an order size." };
  }
  if (!maxClips.ok) {
    return maxClips;
  }
  if (!maxValue.ok) {
    return maxValue;
  }
  const clipsCap = maxType === "orders" ? maxClips.value : null;
  const valueCap = maxType === "value" ? maxValue.value : null;
  if (!dipPct.ok) {
    return dipPct;
  }
  if (!intervalMinutes.ok) {
    return intervalMinutes;
  }
  if (averaging === "interval" && intervalMinutes.value === null) {
    return { ok: false, error: "Enter how often to add an order." };
  }
  if (restGrid && dipPct.value === null) {
    return { ok: false, error: "Enter a price deviation % for the grid." };
  }
  if (restGrid && (clipsCap === null || clipsCap < 2)) {
    return { ok: false, error: "Enter max orders for the grid." };
  }
  if (!sizeMultiplier.ok) {
    return sizeMultiplier;
  }
  if (!deviationMultiplier.ok) {
    return deviationMultiplier;
  }
  if (!takeProfitPct.ok) {
    return takeProfitPct;
  }
  if (!stopLossPct.ok) {
    return stopLossPct;
  }
  if (!breakevenActivationPct.ok) {
    return breakevenActivationPct;
  }
  if (!breakevenOffsetPct.ok) {
    return breakevenOffsetPct;
  }
  if (!trailingTriggerPct.ok) {
    return trailingTriggerPct;
  }
  if (!trailingPct.ok) {
    return trailingPct;
  }
  const armTrigger = parseOptionalTrigger(
    startKind === "price",
    form.get("armTriggerBy"),
    form.get("armCompare"),
    form.get("armPrice"),
    "Start price",
  );
  if (!armTrigger.ok) {
    return armTrigger;
  }
  if (startKind === "price" && !armTrigger.trigger) {
    return { ok: false, error: "Enter a start price." };
  }
  const webhookId =
    startKind === "webhook" ? parseDcaPlaybookId(form.get("webhookId")) : null;
  if (startKind === "webhook" && !webhookId) {
    return { ok: false, error: "Choose a Signal webhook." };
  }
  let indicatorKind: DcaIndicatorKind | null = null;
  let indicatorTimeframe: DcaIndicatorTimeframe | null = null;
  let indicatorCompare: FuturesTriggerCompare | null = null;
  let indicatorLevel: number | null = null;
  if (startKind === "indicator") {
    const kind = String(form.get("indicatorKind") ?? "").trim();
    if (kind !== "rsi" && kind !== "macd" && kind !== "ema_cross") {
      return { ok: false, error: "Choose RSI, MACD, or EMA cross." };
    }
    indicatorKind = kind;
    const timeframe = String(form.get("indicatorTimeframe") ?? "15").trim();
    if (timeframe !== "5" && timeframe !== "15" && timeframe !== "60") {
      return { ok: false, error: "Choose 5m, 15m, or 1h." };
    }
    indicatorTimeframe = timeframe;
    if (kind === "rsi") {
      const cmp = parseFuturesTriggerCompare(
        form.get("indicatorCompare") ?? "lte",
      );
      const level = parseOptionalPositive(form.get("indicatorLevel"));
      if (!cmp.ok) {
        return { ok: false, error: "RSI needs at or above, or at or below." };
      }
      if (!level.ok || level.value === null) {
        return { ok: false, error: "Enter an RSI level." };
      }
      indicatorCompare = cmp.compare;
      indicatorLevel = level.value;
    }
  }
  return {
    ok: true,
    config: {
      name: name.name,
      symbol: symbol.symbol,
      direction,
      startKind,
      webhookId,
      dcaMode,
      clipSize: clipSize.qty,
      sizeUnit: sizeUnit.unit,
      maxClips: clipsCap,
      maxValue: valueCap,
      dipPct: dipPct.value,
      intervalMinutes: intervalMinutes.value,
      sizeMultiplier: sizeMultiplier.value,
      deviationMultiplier: deviationMultiplier.value,
      takeProfitPct: takeProfitPct.value,
      stopLossPct: stopLossPct.value,
      takeProfitBasis: parseDcaExitBasis(form.get("takeProfitBasis")),
      stopLossBasis: parseDcaExitBasis(form.get("stopLossBasis")),
      takeProfitOrderType: parseDcaExitOrderType(form.get("takeProfitOrderType")),
      stopLossOrderType: parseDcaExitOrderType(form.get("stopLossOrderType")),
      breakevenActivationPct: breakevenActivationPct.value,
      breakevenOffsetPct: breakevenOffsetPct.value,
      trailingTriggerPct: trailingTriggerPct.value,
      trailingPct: trailingPct.value,
      armTrigger: armTrigger.trigger,
      disarmTrigger: null,
      indicatorKind,
      indicatorTimeframe,
      indicatorCompare,
      indicatorLevel,
    },
  };
}

function parseLeg(
  prefix: "long" | "short",
  row: Record<string, unknown>,
): DcaLegState {
  const lastClipAt = new Date(
    String(row[`${prefix}_last_clip_at`] ?? ""),
  ).getTime();
  return {
    status: parseDcaStatus(row[`${prefix}_status`]),
    clipsFilled: Math.max(
      0,
      Math.floor(Number(row[`${prefix}_clips_filled`]) || 0),
    ),
    lastClipPrice: asPositiveOrNull(row[`${prefix}_last_clip_price`]),
    lastClipAtMs: Number.isFinite(lastClipAt) ? lastClipAt : null,
    firstFillPrice: asPositiveOrNull(row[`${prefix}_first_fill_price`]),
    breakevenDone: Boolean(row[`${prefix}_breakeven_done`]),
  };
}

export function parseDcaPlaybookRow(
  row: Record<string, unknown>,
): DcaPlaybook | null {
  const id = String(row.id ?? "").trim();
  const userId = String(row.user_id ?? "").trim();
  const accountId = String(row.account_id ?? "").trim();
  const symbol = parseFuturesSymbol(row.symbol);
  const direction =
    parseDcaDirection(row.direction) ?? parseFuturesSide(row.side);
  const sizeUnit = parseFuturesSizeUnit(row.size_unit);
  const clipSize = Number(row.clip_size);
  if (
    !id ||
    !userId ||
    !accountId ||
    !symbol.ok ||
    !direction ||
    !sizeUnit.ok ||
    !(clipSize > 0)
  ) {
    return null;
  }
  const named = parseDcaPlaybookName(row.name);
  const indicatorKindRaw = String(row.indicator_kind ?? "").trim();
  const indicatorKind: DcaIndicatorKind | null =
    indicatorKindRaw === "rsi" ||
    indicatorKindRaw === "macd" ||
    indicatorKindRaw === "ema_cross"
      ? indicatorKindRaw
      : null;
  const timeframeRaw = String(row.indicator_timeframe ?? "").trim();
  const indicatorTimeframe: DcaIndicatorTimeframe | null =
    timeframeRaw === "5" || timeframeRaw === "15" || timeframeRaw === "60"
      ? timeframeRaw
      : null;
  const indicatorCompare = parseFuturesTriggerCompare(row.indicator_compare);
  return {
    id,
    userId,
    accountId,
    name: named.ok ? named.name : DEFAULT_DCA_NAME,
    symbol: symbol.symbol,
    direction,
    startKind: parseDcaStartKind(row.start_kind),
    webhookId: parseDcaPlaybookId(row.webhook_id),
    dcaMode: parseDcaMode(row.dca_mode),
    clipSize,
    sizeUnit: sizeUnit.unit,
    maxClips: asPositiveIntOrNull(row.max_clips),
    maxValue: asPositiveOrNull(row.max_value),
    dipPct: asPositiveOrNull(row.dip_pct),
    intervalMinutes: asPositiveIntOrNull(row.interval_minutes),
    sizeMultiplier: asPositiveOrNull(row.size_multiplier) ?? 1,
    deviationMultiplier: asPositiveOrNull(row.deviation_multiplier) ?? 1,
    takeProfitPct: asPositiveOrNull(row.take_profit_pct),
    stopLossPct: asPositiveOrNull(row.stop_loss_pct),
    takeProfitBasis: parseDcaExitBasis(row.take_profit_basis),
    stopLossBasis: parseDcaExitBasis(row.stop_loss_basis),
    takeProfitOrderType: parseDcaExitOrderType(row.take_profit_order_type),
    stopLossOrderType: parseDcaExitOrderType(row.stop_loss_order_type),
    breakevenActivationPct: asPositiveOrNull(row.breakeven_activation_pct),
    breakevenOffsetPct:
      row.breakeven_offset_pct == null || row.breakeven_offset_pct === ""
        ? null
        : Number(row.breakeven_offset_pct) >= 0
          ? Number(row.breakeven_offset_pct)
          : null,
    trailingTriggerPct: asPositiveOrNull(row.trailing_trigger_pct),
    trailingPct: asPositiveOrNull(row.trailing_pct),
    armTrigger: parseStoredTrigger(
      row.arm_trigger_by,
      row.arm_compare,
      row.arm_price,
    ),
    disarmTrigger: parseStoredTrigger(
      row.disarm_trigger_by,
      row.disarm_compare,
      row.disarm_price,
    ),
    indicatorKind,
    indicatorTimeframe,
    indicatorCompare: indicatorCompare.ok ? indicatorCompare.compare : null,
    indicatorLevel: asPositiveOrNull(row.indicator_level),
    long: parseLeg("long", row),
    short: parseLeg("short", row),
    armConditionTrue: Boolean(row.arm_condition_true),
    disarmConditionTrue: Boolean(row.disarm_condition_true),
    longIndicatorTrue: Boolean(row.long_indicator_true),
    shortIndicatorTrue: Boolean(row.short_indicator_true),
  };
}

function asPositiveOrNull(raw: unknown): number | null {
  const value = Number(raw);
  return value > 0 && Number.isFinite(value) ? value : null;
}

function asPositiveIntOrNull(raw: unknown): number | null {
  const value = asPositiveOrNull(raw);
  return value !== null && Number.isInteger(value) ? value : null;
}

function parseStoredTrigger(
  triggerBy: unknown,
  compare: unknown,
  price: unknown,
): DcaPriceTrigger | null {
  const parsedPrice = asPositiveOrNull(price);
  if (parsedPrice === null) {
    return null;
  }
  const by = parseFuturesTrigger(triggerBy);
  const cmp = parseFuturesTriggerCompare(compare);
  if (!by.ok || !cmp.ok) {
    return null;
  }
  return { triggerBy: by.trigger, compare: cmp.compare, price: parsedPrice };
}

export function dcaPnlPct(input: {
  side: FuturesSide;
  qty: number;
  entryPrice: number;
  mark: number;
}): number | null {
  if (!(input.qty > 0) || !(input.entryPrice > 0) || !(input.mark > 0)) {
    return null;
  }
  const usdt = futuresPnlUsdt({
    side: input.side,
    qty: input.qty,
    entryPrice: input.entryPrice,
    exitPrice: input.mark,
  });
  return (usdt / (input.qty * input.entryPrice)) * 100;
}

export function dcaDipMet(input: {
  side: FuturesSide;
  lastPrice: number;
  lastClipPrice: number;
  dipPct: number;
}): boolean {
  if (
    !(input.lastPrice > 0) ||
    !(input.lastClipPrice > 0) ||
    !(input.dipPct > 0)
  ) {
    return false;
  }
  if (input.side === "long") {
    return input.lastPrice <= input.lastClipPrice * (1 - input.dipPct / 100);
  }
  return input.lastPrice >= input.lastClipPrice * (1 + input.dipPct / 100);
}

export function dcaIntervalMet(input: {
  nowMs: number;
  lastClipAtMs: number | null;
  intervalMinutes: number | null;
}): boolean {
  if (
    input.lastClipAtMs === null ||
    input.intervalMinutes === null ||
    !(input.intervalMinutes > 0)
  ) {
    return false;
  }
  return input.nowMs - input.lastClipAtMs >= input.intervalMinutes * 60_000;
}

export function dcaCapHit(input: {
  clipsFilled: number;
  maxClips: number | null;
  maxValue: number | null;
  markValue: number | null;
}): boolean {
  if (input.maxClips !== null && input.clipsFilled >= input.maxClips) {
    return true;
  }
  if (
    input.maxValue !== null &&
    input.markValue !== null &&
    input.markValue >= input.maxValue
  ) {
    return true;
  }
  return false;
}

export function decideDcaTick(input: {
  status: DcaStatus;
  side: FuturesSide;
  reduceOnly: boolean;
  lastPrice: number | null;
  mark: number | null;
  lastClipPrice: number | null;
  lastClipAtMs: number | null;
  firstFillPrice?: number | null;
  nowMs: number;
  startKind?: DcaStartKind;
  dcaMode?: DcaMode;
  dipPct: number | null;
  intervalMinutes: number | null;
  deviationMultiplier?: number;
  clipsFilled: number;
  maxClips: number | null;
  maxValue: number | null;
  positionQty: number | null;
  entryPrice: number | null;
  takeProfitPct: number | null;
  stopLossPct: number | null;
  takeProfitBasis?: DcaExitBasis;
  stopLossBasis?: DcaExitBasis;
  breakevenActivationPct?: number | null;
  breakevenDone?: boolean;
  armTrigger: DcaPriceTrigger | null;
  armConditionTrue: boolean;
  disarmTrigger: DcaPriceTrigger | null;
  disarmConditionTrue: boolean;
  indicatorKind?: DcaIndicatorKind | null;
  indicatorCompare?: FuturesTriggerCompare | null;
  indicatorLevel?: number | null;
  indicatorConditionTrue?: boolean;
  closes?: number[] | null;
  triggerPrices: { last: number | null; mark: number | null; index: number | null };
}): DcaTickDecision {
  const startKind =
    input.startKind ?? (input.armTrigger ? "price" : "immediate");
  const dcaMode = input.dcaMode ?? "position";
  const deviationMultiplier = input.deviationMultiplier ?? 1;
  const takeProfitBasis = input.takeProfitBasis ?? "average";
  const stopLossBasis = input.stopLossBasis ?? "average";
  const firstFillPrice = input.firstFillPrice ?? null;
  const breakevenDone = input.breakevenDone ?? false;
  const breakevenActivationPct = input.breakevenActivationPct ?? null;
  const indicatorKind = input.indicatorKind ?? null;
  const indicatorCompare = input.indicatorCompare ?? null;
  const indicatorLevel = input.indicatorLevel ?? null;
  const closes = input.closes ?? null;
  const armPrice = triggerPrice(input.armTrigger, input.triggerPrices);
  const armMet = Boolean(
    startKind === "price" &&
      input.armTrigger &&
      armPrice !== null &&
      triggerConditionMet(
        armPrice,
        input.armTrigger.compare,
        input.armTrigger.price,
      ),
  );
  const disarmPrice = triggerPrice(input.disarmTrigger, input.triggerPrices);
  const disarmMet = Boolean(
    input.disarmTrigger &&
      disarmPrice !== null &&
      triggerConditionMet(
        disarmPrice,
        input.disarmTrigger.compare,
        input.disarmTrigger.price,
      ),
  );
  const indicatorMet = Boolean(
    startKind === "indicator" &&
      indicatorKind &&
      closes &&
      indicatorStartMet({
        kind: indicatorKind,
        side: input.side,
        closes,
        compare: indicatorCompare,
        level: indicatorLevel,
      }),
  );
  const nextArmTrue = armMet;
  const nextDisarmTrue = disarmMet;
  const nextIndicatorTrue = indicatorMet;
  const disarmEdge = disarmMet && !input.disarmConditionTrue;

  if (input.status === "idle") {
    return {
      action: { kind: "none" },
      nextArmTrue,
      nextDisarmTrue,
      nextIndicatorTrue,
    };
  }

  const basisFor = (basis: DcaExitBasis): number | null => {
    if (basis === "first_entry") {
      return firstFillPrice ?? input.entryPrice;
    }
    return input.entryPrice;
  };
  const slBasis = basisFor(stopLossBasis);
  const tpBasis = basisFor(takeProfitBasis);
  const pnlVs = (basis: number | null): number | null =>
    input.positionQty !== null && basis !== null && input.mark !== null
      ? dcaPnlPct({
          side: input.side,
          qty: input.positionQty,
          entryPrice: basis,
          mark: input.mark,
        })
      : null;
  const slPnl = pnlVs(slBasis);
  const tpPnl = pnlVs(tpBasis);
  if (
    slPnl !== null &&
    input.stopLossPct !== null &&
    slPnl <= -input.stopLossPct
  ) {
    return {
      action: { kind: "close", reason: "stop_loss" },
      nextArmTrue,
      nextDisarmTrue,
      nextIndicatorTrue,
    };
  }
  if (
    tpPnl !== null &&
    input.takeProfitPct !== null &&
    tpPnl >= input.takeProfitPct
  ) {
    return {
      action: { kind: "close", reason: "take_profit" },
      nextArmTrue,
      nextDisarmTrue,
      nextIndicatorTrue,
    };
  }

  const avgPnl = pnlVs(input.entryPrice);
  if (
    input.status === "armed" &&
    !breakevenDone &&
    breakevenActivationPct !== null &&
    avgPnl !== null &&
    avgPnl >= breakevenActivationPct
  ) {
    return {
      action: { kind: "breakeven" },
      nextArmTrue,
      nextDisarmTrue,
      nextIndicatorTrue,
    };
  }

  if (input.status === "armed" && disarmEdge) {
    return {
      action: { kind: "disarm" },
      nextArmTrue,
      nextDisarmTrue,
      nextIndicatorTrue,
    };
  }

  if (input.status !== "armed") {
    return {
      action: { kind: "none" },
      nextArmTrue,
      nextDisarmTrue,
      nextIndicatorTrue,
    };
  }

  if (input.clipsFilled === 0) {
    const startReady =
      startKind === "immediate" ||
      (startKind === "price" && armMet) ||
      (startKind === "indicator" && indicatorMet);
    if (!input.reduceOnly && startReady) {
      return {
        action: { kind: "arm" },
        nextArmTrue,
        nextDisarmTrue,
        nextIndicatorTrue,
      };
    }
    return {
      action: { kind: "none" },
      nextArmTrue,
      nextDisarmTrue,
      nextIndicatorTrue,
    };
  }

  const markValue =
    input.positionQty !== null && input.mark !== null
      ? input.positionQty * input.mark
      : null;
  if (
    dcaCapHit({
      clipsFilled: input.clipsFilled,
      maxClips: input.maxClips,
      maxValue: input.maxValue,
      markValue,
    })
  ) {
    return {
      action: { kind: "stop_adding" },
      nextArmTrue,
      nextDisarmTrue,
      nextIndicatorTrue,
    };
  }

  if (input.reduceOnly || dcaMode === "order") {
    return {
      action: { kind: "none" },
      nextArmTrue,
      nextDisarmTrue,
      nextIndicatorTrue,
    };
  }

  const nextDip =
    input.dipPct === null
      ? null
      : dcaDipPctAt(
          Math.max(0, input.clipsFilled - 1),
          input.dipPct,
          deviationMultiplier,
        );
  const dip =
    nextDip !== null &&
    input.lastPrice !== null &&
    input.lastClipPrice !== null
      ? dcaDipMet({
          side: input.side,
          lastPrice: input.lastPrice,
          lastClipPrice: input.lastClipPrice,
          dipPct: nextDip,
        })
      : false;
  const interval = dcaIntervalMet({
    nowMs: input.nowMs,
    lastClipAtMs: input.lastClipAtMs,
    intervalMinutes: input.intervalMinutes,
  });
  if (dip || interval) {
    return {
      action: { kind: "clip" },
      nextArmTrue,
      nextDisarmTrue,
      nextIndicatorTrue,
    };
  }
  return {
    action: { kind: "none" },
    nextArmTrue,
    nextDisarmTrue,
    nextIndicatorTrue,
  };
}

function triggerPrice(
  trigger: DcaPriceTrigger | null,
  prices: { last: number | null; mark: number | null; index: number | null },
): number | null {
  if (!trigger) {
    return null;
  }
  if (trigger.triggerBy === "mark") {
    return prices.mark;
  }
  if (trigger.triggerBy === "index") {
    return prices.index;
  }
  return prices.last;
}

export function formatDcaNextAdd(input: {
  status: DcaStatus;
  startKind?: DcaStartKind;
  dcaMode?: DcaMode;
  clipsFilled?: number;
  dipPct: number | null;
  intervalMinutes: number | null;
  lastClipAtMs: number | null;
  nowMs: number;
}): string {
  if (input.status === "idle") {
    return "—";
  }
  if (input.status === "stop_adding") {
    return "Stopped";
  }
  if ((input.clipsFilled ?? 0) === 0) {
    if (input.startKind === "webhook") {
      return "Waiting for signal";
    }
    if (input.startKind === "indicator") {
      return "Waiting for indicator";
    }
    if (input.startKind === "price") {
      return "Waiting for price";
    }
    return "First order";
  }
  if (input.dcaMode === "order") {
    return "Grid";
  }
  const parts: string[] = [];
  if (input.dipPct !== null) {
    parts.push(`${trimNumber(input.dipPct)}%`);
  }
  if (input.intervalMinutes !== null) {
    if (input.lastClipAtMs !== null) {
      const remainMs =
        input.lastClipAtMs + input.intervalMinutes * 60_000 - input.nowMs;
      if (remainMs <= 0) {
        parts.push("due");
      } else {
        const minutes = Math.ceil(remainMs / 60_000);
        parts.push(formatDcaIntervalShort(minutes));
      }
    } else {
      parts.push(formatDcaIntervalShort(input.intervalMinutes));
    }
  }
  if (parts.length > 0) {
    return parts.join(" or ");
  }
  return input.lastClipAtMs === null ? "First order" : "Wait for TP/SL";
}

export function formatDcaOrdersProgress(input: {
  filled: number;
  maxClips: number | null;
}): string {
  const filled = Math.max(0, input.filled);
  if (input.maxClips !== null) {
    return `${filled}/${input.maxClips}`;
  }
  return String(filled);
}

export function formatDcaRemaining(input: {
  clipsFilled: number;
  maxClips: number | null;
  maxValue: number | null;
  markValue: number | null;
}): string {
  const parts: string[] = [];
  if (input.maxClips !== null) {
    parts.push(`${Math.max(0, input.maxClips - input.clipsFilled)} orders`);
  }
  if (input.maxValue !== null) {
    const left =
      input.markValue === null
        ? input.maxValue
        : Math.max(0, input.maxValue - input.markValue);
    parts.push(`$${trimNumber(left)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "No cap";
}

export function dcaClipAction(side: FuturesSide): "buy" | "sell" {
  return side === "long" ? "buy" : "sell";
}

export function dcaClipKey(
  playbookId: string,
  side: FuturesSide,
  clipIndex: number,
): string {
  const compact = playbookId.replace(/-/g, "").slice(0, 8);
  const sideChar = side === "long" ? "l" : "s";
  return `d${compact}${sideChar}${clipIndex}`;
}

export function dcaPlaybookStatusLabel(playbook: DcaPlaybook): string {
  const sides = dcaEnabledSides(playbook.direction);
  return sides
    .map((side) => {
      const leg = dcaLegFor(playbook, side);
      const status =
        leg.status === "armed"
          ? "Armed"
          : leg.status === "stop_adding"
            ? "Stopped adding"
            : "Idle";
      const clips = leg.clipsFilled > 0 ? ` · ${leg.clipsFilled} orders` : "";
      if (sides.length === 1) {
        return `${status}${clips}`;
      }
      return `${side === "long" ? "Long" : "Short"} ${status.toLowerCase()}${clips}`;
    })
    .join(" · ");
}

export function dcaFilledClipCount(
  orders: readonly { action: string }[] | undefined,
): number | null {
  if (!orders) {
    return null;
  }
  return orders.filter(
    (row) => row.action === "buy" || row.action === "sell",
  ).length;
}

export function dcaOpenHint(input: {
  playbook: DcaPlaybook;
  symbol: string;
  side: FuturesSide;
  orders?: readonly { action: string }[];
  entryPrice?: number | null;
  mark?: number | null;
}): DcaOpenHint | null {
  if (input.playbook.symbol !== input.symbol) {
    return null;
  }
  if (!dcaEnabledSides(input.playbook.direction).includes(input.side)) {
    return null;
  }
  const leg = dcaLegFor(input.playbook, input.side);
  if (leg.status === "idle") {
    return null;
  }
  const filled = dcaFilledClipCount(input.orders) ?? leg.clipsFilled;
  const planned = dcaPlannedExits({
    side: input.side,
    entryPrice: input.entryPrice ?? null,
    firstFillPrice: leg.firstFillPrice,
    mark: input.mark ?? null,
    takeProfitPct: input.playbook.takeProfitPct,
    stopLossPct: input.playbook.stopLossPct,
    takeProfitBasis: input.playbook.takeProfitBasis,
    stopLossBasis: input.playbook.stopLossBasis,
    trailingPct: input.playbook.trailingPct,
  });
  return {
    orders: formatDcaOrdersProgress({
      filled,
      maxClips: input.playbook.maxClips,
    }),
    plannedTakeProfit: planned.takeProfit,
    plannedStopLoss: planned.stopLoss,
    plannedTrailing: planned.trailingStop,
    takeProfitOrderType: input.playbook.takeProfitOrderType,
    stopLossOrderType: input.playbook.stopLossOrderType,
  };
}

export function dcaHintsForOpen(
  playbooks: readonly DcaPlaybook[],
  open: Array<{
    symbol: string;
    side: FuturesSide;
    orders?: readonly { action: string }[];
    entryPrice?: number | null;
    mark?: number | null;
  }>,
): Record<string, DcaOpenHint> {
  const hints: Record<string, DcaOpenHint> = {};
  for (const row of open) {
    const playbook = playbooks.find((item) => item.symbol === row.symbol);
    if (!playbook) {
      continue;
    }
    const hint = dcaOpenHint({
      playbook,
      symbol: row.symbol,
      side: row.side,
      orders: row.orders,
      entryPrice: row.entryPrice,
      mark: row.mark,
    });
    if (hint) {
      hints[dcaHintKey(row.symbol, row.side)] = hint;
    }
  }
  return hints;
}

function trimNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(2).replace(/\.?0+$/, "");
}
