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
import { parseDeskFuturesSymbol } from "@/lib/venues/hyperliquid/symbol";
import {
  parseFuturesTriggerCompare,
  triggerConditionMet,
  type FuturesTriggerCompare,
} from "@/lib/futures/automation";
import {
  parseFuturesTrigger,
  tpslWithoutLimitExits,
  type FuturesTpsl,
} from "@/lib/futures/tpsl";
import { futuresPnlUsdt } from "@/lib/futures/math";
import {
  dcaClipFromBudget,
  dcaClipSizeAt,
  dcaDipPctAt,
  dcaLadderMaxOrderError,
  dcaPlannedExits,
  dcaSafetyPrices,
} from "./grid";
import {
  dcaIndicatorStartLatches,
  indicatorClosesForCross,
  indicatorStartMet,
  parseDcaIndicatorCompare,
  parseDcaIndicatorTimeframe,
  type DcaIndicatorCompare,
  type DcaIndicatorKind,
  type DcaIndicatorTimeframe,
} from "./indicators";

export type DcaStatus = "idle" | "armed" | "stop_adding";
export type DcaDirection = "long" | "short" | "both";
export type DcaStartKind = "immediate" | "price" | "webhook" | "indicator";
export type DcaMode = "position" | "order";
export type DcaExitBasis = "average" | "first_entry";
export type DcaMaxType = "orders" | "value";
export type DcaMaxValueKind = "usdt" | "percent";

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
  cycleMaxValue: number | null;
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
  maxValueKind: DcaMaxValueKind;
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
  shortArmTrigger?: DcaPriceTrigger | null;
  disarmTrigger: DcaPriceTrigger | null;
  indicatorKind: DcaIndicatorKind | null;
  indicatorTimeframe: DcaIndicatorTimeframe | null;
  indicatorCompare: DcaIndicatorCompare | null;
  indicatorLevel: number | null;
  shortIndicatorKind?: DcaIndicatorKind | null;
  shortIndicatorTimeframe?: DcaIndicatorTimeframe | null;
  shortIndicatorCompare?: DcaIndicatorCompare | null;
  shortIndicatorLevel?: number | null;
};

export type DcaPlaybook = DcaPlaybookConfig & {
  id: string;
  userId: string;
  accountId: string;
  updatedAtMs: number;
  long: DcaLegState;
  short: DcaLegState;
  armConditionTrue: boolean;
  disarmConditionTrue: boolean;
  longIndicatorTrue: boolean;
  shortIndicatorTrue: boolean;
};

export const DEFAULT_DCA_NAME = "DCA";
export const DCA_COPY_SUFFIX = " (copy)";

export const IDLE_DCA_LEG: DcaLegState = {
  status: "idle",
  clipsFilled: 0,
  lastClipPrice: null,
  lastClipAtMs: null,
  firstFillPrice: null,
  breakevenDone: false,
  cycleMaxValue: null,
};

export type DcaTickAction =
  | { kind: "none" }
  | { kind: "arm" }
  | { kind: "disarm" }
  | { kind: "clip" }
  | { kind: "close"; reason: "take_profit" | "stop_loss" }
  | { kind: "stop_adding" }
  | { kind: "end_cycle" }
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

export function parseDcaMaxValueKind(value: unknown): DcaMaxValueKind {
  return value === "percent" ? "percent" : "usdt";
}

export function dcaResolvedMaxValueUsdt(input: {
  kind: DcaMaxValueKind;
  maxValue: number | null;
  bookUsdt: number | null;
}): number | null {
  if (input.maxValue == null || !(input.maxValue > 0)) {
    return null;
  }
  if (input.kind !== "percent") {
    return input.maxValue;
  }
  if (input.bookUsdt == null || !(input.bookUsdt > 0)) {
    return null;
  }
  return input.bookUsdt * (input.maxValue / 100);
}

export function dcaTickValueCapUsdt(input: {
  kind: DcaMaxValueKind;
  maxValue: number | null;
  cycleMaxValue: number | null;
  bookUsdt?: number | null;
}): number | null {
  if (input.maxValue == null || !(input.maxValue > 0)) {
    return null;
  }
  if (input.kind !== "percent") {
    return input.maxValue;
  }
  if (input.cycleMaxValue != null && input.cycleMaxValue > 0) {
    return input.cycleMaxValue;
  }
  return dcaResolvedMaxValueUsdt({
    kind: "percent",
    maxValue: input.maxValue,
    bookUsdt: input.bookUsdt ?? null,
  });
}

export function dcaCycleClipSize(input: {
  kind: DcaMaxValueKind;
  maxValue: number | null;
  maxClips: number | null;
  clipSize: number;
  sizeMultiplier: number;
  sizeUnit: "qty" | "usdt";
  bookUsdt: number | null;
  mark?: number | null;
}): { clipSize: number; cycleMaxValue: number | null } {
  const cycleMaxValue = dcaResolvedMaxValueUsdt({
    kind: input.kind,
    maxValue: input.maxValue,
    bookUsdt: input.bookUsdt,
  });
  const derived = dcaClipFromBudget({
    maxValue: cycleMaxValue,
    maxClips: input.maxClips,
    sizeMultiplier: input.sizeMultiplier,
    sizeUnit: input.sizeUnit,
    mark: input.mark,
  });
  return {
    clipSize: derived ?? input.clipSize,
    cycleMaxValue,
  };
}

export function dcaCopyEstimateClipSize(input: {
  maxValueKind: DcaMaxValueKind;
  maxValue: number | null;
  maxClips: number | null;
  clipSize: number;
  sizeMultiplier: number;
  sizeUnit: "qty" | "usdt";
  long: Pick<DcaLegState, "clipsFilled" | "cycleMaxValue">;
  short: Pick<DcaLegState, "clipsFilled" | "cycleMaxValue">;
  bookUsdt: number | null;
  mark?: number | null;
}): number {
  const inCycle = [input.long, input.short].some(
    (leg) =>
      leg.clipsFilled > 0 ||
      (leg.cycleMaxValue != null && leg.cycleMaxValue > 0),
  );
  if (!inCycle && input.maxValueKind === "percent") {
    return dcaCycleClipSize({
      kind: input.maxValueKind,
      maxValue: input.maxValue,
      maxClips: input.maxClips,
      clipSize: input.clipSize,
      sizeMultiplier: input.sizeMultiplier,
      sizeUnit: input.sizeUnit,
      bookUsdt: input.bookUsdt,
      mark: input.mark,
    }).clipSize;
  }
  return input.clipSize;
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

export function dcaConfigMaxOrderError(input: {
  config: Pick<
    DcaPlaybookConfig,
    | "direction"
    | "dcaMode"
    | "clipSize"
    | "sizeUnit"
    | "maxClips"
    | "maxValue"
    | "maxValueKind"
    | "dipPct"
    | "sizeMultiplier"
    | "deviationMultiplier"
  >;
  lastPrice: number | null;
  maxQty: number;
  maxMktQty: number;
  baseCoin: string;
  bookUsdt?: number | null;
}): string | null {
  const { config } = input;
  if (!(config.clipSize > 0)) {
    return null;
  }
  if (config.sizeUnit === "usdt" && !(input.lastPrice && input.lastPrice > 0)) {
    return null;
  }
  if (!(input.maxQty > 0) && !(input.maxMktQty > 0)) {
    return null;
  }
  return dcaLadderMaxOrderError({
    sides: dcaEnabledSides(config.direction),
    restGrid: config.dcaMode === "order",
    entryPrice: input.lastPrice && input.lastPrice > 0 ? input.lastPrice : 1,
    maxClips: config.maxClips,
    maxValue: dcaResolvedMaxValueUsdt({
      kind: config.maxValueKind,
      maxValue: config.maxValue,
      bookUsdt: input.bookUsdt ?? null,
    }),
    dipPct: config.dipPct,
    clipSize: config.clipSize,
    sizeUnit: config.sizeUnit,
    sizeMultiplier: config.sizeMultiplier,
    deviationMultiplier: config.deviationMultiplier,
    maxQty: input.maxQty,
    maxMktQty: input.maxMktQty,
    baseCoin: input.baseCoin,
  });
}

export function dcaStartListens(startKind: DcaStartKind): boolean {
  return (
    startKind === "price" ||
    startKind === "indicator" ||
    startKind === "webhook"
  );
}

export type DcaIndicatorStart = {
  kind: DcaIndicatorKind;
  timeframe: DcaIndicatorTimeframe;
  compare: DcaIndicatorCompare | null;
  level: number | null;
};

export function parseDcaIndicatorKind(
  value: unknown,
): DcaIndicatorKind | null {
  const raw = String(value ?? "").trim();
  return raw === "rsi" || raw === "macd" || raw === "ema_cross" ? raw : null;
}

export function dcaIndicatorStartForSide(
  playbook: Pick<
    DcaPlaybookConfig,
    | "indicatorKind"
    | "indicatorTimeframe"
    | "indicatorCompare"
    | "indicatorLevel"
    | "shortIndicatorKind"
    | "shortIndicatorTimeframe"
    | "shortIndicatorCompare"
    | "shortIndicatorLevel"
  >,
  side: FuturesSide,
): DcaIndicatorStart | null {
  const kind =
    side === "short" && playbook.shortIndicatorKind
      ? playbook.shortIndicatorKind
      : playbook.indicatorKind;
  const timeframe =
    side === "short" && playbook.shortIndicatorTimeframe
      ? playbook.shortIndicatorTimeframe
      : playbook.indicatorTimeframe;
  if (!kind || !timeframe) {
    return null;
  }
  return {
    kind,
    timeframe,
    compare:
      side === "short" && playbook.shortIndicatorKind
        ? (playbook.shortIndicatorCompare ?? null)
        : playbook.indicatorCompare,
    level:
      side === "short" && playbook.shortIndicatorKind
        ? (playbook.shortIndicatorLevel ?? null)
        : playbook.indicatorLevel,
  };
}

export function dcaArmTriggerForSide(
  playbook: Pick<DcaPlaybookConfig, "armTrigger" | "shortArmTrigger">,
  side: FuturesSide,
): DcaPriceTrigger | null {
  if (side === "short" && playbook.shortArmTrigger) {
    return playbook.shortArmTrigger;
  }
  return playbook.armTrigger;
}

export function dcaIndicatorTimeframes(playbook: {
  startKind: DcaStartKind;
  indicatorTimeframe: DcaIndicatorTimeframe | null;
  shortIndicatorTimeframe?: DcaIndicatorTimeframe | null;
}): DcaIndicatorTimeframe[] {
  if (playbook.startKind !== "indicator") {
    return [];
  }
  const rows: DcaIndicatorTimeframe[] = [];
  for (const row of [
    playbook.indicatorTimeframe,
    playbook.shortIndicatorTimeframe ?? null,
  ]) {
    if (row && !rows.includes(row)) {
      rows.push(row);
    }
  }
  return rows;
}

export function dcaNeedsIndicatorCloses(playbook: {
  startKind: DcaStartKind;
  indicatorTimeframe: DcaIndicatorTimeframe | null;
  shortIndicatorTimeframe?: DcaIndicatorTimeframe | null;
  direction: DcaDirection;
  long: Pick<DcaLegState, "status">;
  short: Pick<DcaLegState, "status">;
}): boolean {
  if (dcaIndicatorTimeframes(playbook).length === 0) {
    return false;
  }
  return dcaEnabledSides(playbook.direction).some((side) =>
    dcaLegIsRunning(
      side === "long" ? playbook.long.status : playbook.short.status,
    ),
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

export type DcaCycleOpen = {
  symbol: string;
  side: FuturesSide;
  qty: number;
};

export function dcaPlaybookHasOpenCycle(
  playbook: Pick<DcaPlaybook, "direction" | "long" | "short"> & {
    symbol?: string;
  },
  opens: readonly DcaCycleOpen[] = [],
): boolean {
  return dcaEnabledSides(playbook.direction).some((side) =>
    opens.some(
      (row) =>
        Number(row.qty) > 0 &&
        row.side === side &&
        Boolean(playbook.symbol) &&
        row.symbol === playbook.symbol,
    ),
  );
}

export function writeDcaCycleFormFields(
  form: FormData,
  current: DcaPlaybookConfig,
): void {
  form.set("symbol", current.symbol);
  form.set("direction", current.direction);
  form.set("startKind", current.startKind);
  if (current.webhookId) {
    form.set("webhookId", current.webhookId);
  }
  const averaging = dcaAveragingKind(current);
  form.set("averaging", averaging);
  if (current.dcaMode === "order") {
    form.set("restGrid", "1");
  } else {
    form.delete("restGrid");
  }
  form.set("sizeUnit", current.sizeUnit);
  form.set("clipSize", String(current.clipSize));
  if (current.maxClips != null) {
    form.set("maxClips", String(current.maxClips));
  } else {
    form.delete("maxClips");
  }
  if (current.maxValue != null) {
    form.set("maxValue", String(current.maxValue));
    form.set("maxValueKind", current.maxValueKind);
  } else {
    form.set("maxValueKind", "none");
    form.delete("maxValue");
  }
  if (current.dipPct != null) {
    form.set("dipPct", String(current.dipPct));
  } else {
    form.delete("dipPct");
  }
  const interval = dcaIntervalParts(current.intervalMinutes);
  form.set("intervalUnit", interval.unit);
  form.set("intervalValue", interval.value);
  form.set("sizeMultiplier", String(current.sizeMultiplier));
  form.set("deviationMultiplier", String(current.deviationMultiplier));
  if (current.armTrigger) {
    form.set("armTriggerBy", current.armTrigger.triggerBy);
    form.set("armCompare", current.armTrigger.compare);
    form.set("armPrice", String(current.armTrigger.price));
  }
  if (current.shortArmTrigger) {
    form.set("shortArmTriggerBy", current.shortArmTrigger.triggerBy);
    form.set("shortArmCompare", current.shortArmTrigger.compare);
    form.set("shortArmPrice", String(current.shortArmTrigger.price));
  }
  if (current.indicatorKind) {
    form.set("indicatorKind", current.indicatorKind);
  }
  if (current.indicatorTimeframe) {
    form.set("indicatorTimeframe", current.indicatorTimeframe);
  }
  if (current.indicatorCompare) {
    form.set("indicatorCompare", current.indicatorCompare);
  }
  if (current.indicatorLevel != null) {
    form.set("indicatorLevel", String(current.indicatorLevel));
  }
  if (current.shortIndicatorKind) {
    form.set("shortIndicatorKind", current.shortIndicatorKind);
  }
  if (current.shortIndicatorTimeframe) {
    form.set("shortIndicatorTimeframe", current.shortIndicatorTimeframe);
  }
  if (current.shortIndicatorCompare) {
    form.set("shortIndicatorCompare", current.shortIndicatorCompare);
  }
  if (current.shortIndicatorLevel != null) {
    form.set("shortIndicatorLevel", String(current.shortIndicatorLevel));
  }
}

export function resolveDcaSaveConfig(
  form: FormData,
  venue: string,
  existing: DcaPlaybook | null,
  opens: readonly DcaCycleOpen[],
):
  | { ok: true; config: DcaPlaybookConfig; cycleLocked: boolean }
  | { ok: false; error: string; cycleLocked: boolean } {
  const cycleLocked = Boolean(
    existing && dcaPlaybookHasOpenCycle(existing, opens),
  );
  if (existing && cycleLocked) {
    writeDcaCycleFormFields(form, existing);
  }
  const parsed = parseDcaPlaybookForm(form, venue);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, cycleLocked };
  }
  return {
    ok: true,
    cycleLocked,
    config:
      existing && cycleLocked
        ? dcaWithLockedCycleConfig(parsed.config, existing)
        : parsed.config,
  };
}

export function dcaWithLockedCycleConfig(
  next: DcaPlaybookConfig,
  current: DcaPlaybookConfig,
): DcaPlaybookConfig {
  return {
    ...next,
    symbol: current.symbol,
    direction: current.direction,
    startKind: current.startKind,
    webhookId: current.webhookId,
    dcaMode: current.dcaMode,
    clipSize: current.clipSize,
    sizeUnit: current.sizeUnit,
    maxClips: current.maxClips,
    maxValue: current.maxValue,
    maxValueKind: current.maxValueKind,
    dipPct: current.dipPct,
    intervalMinutes: current.intervalMinutes,
    sizeMultiplier: current.sizeMultiplier,
    deviationMultiplier: current.deviationMultiplier,
    armTrigger: current.armTrigger,
    shortArmTrigger: current.shortArmTrigger,
    disarmTrigger: current.disarmTrigger,
    indicatorKind: current.indicatorKind,
    indicatorTimeframe: current.indicatorTimeframe,
    indicatorCompare: current.indicatorCompare,
    indicatorLevel: current.indicatorLevel,
    shortIndicatorKind: current.shortIndicatorKind,
    shortIndicatorTimeframe: current.shortIndicatorTimeframe,
    shortIndicatorCompare: current.shortIndicatorCompare,
    shortIndicatorLevel: current.shortIndicatorLevel,
  };
}

export function dcaLegFor(
  playbook: DcaPlaybook,
  side: FuturesSide,
): DcaLegState {
  return side === "long" ? playbook.long : playbook.short;
}

export type DcaOpenHint = {
  playbookId: string;
  orders: string;
  plannedTakeProfit: number | null;
  plannedStopLoss: number | null;
  plannedTrailing: number | null;
  takeProfitOrderType: FuturesOrderType;
  stopLossOrderType: FuturesOrderType;
  tpLimitResting: boolean;
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

export function dcaCopyName(name: string): string {
  const trimmed = name.trim() || DEFAULT_DCA_NAME;
  if (trimmed.endsWith(DCA_COPY_SUFFIX)) {
    return trimmed.slice(0, 40);
  }
  if (trimmed.length + DCA_COPY_SUFFIX.length <= 40) {
    return `${trimmed}${DCA_COPY_SUFFIX}`;
  }
  return `${trimmed.slice(0, 40 - DCA_COPY_SUFFIX.length).trimEnd()}${DCA_COPY_SUFFIX}`;
}

export function dcaCloneIdleDraft(source: DcaPlaybook): DcaPlaybook {
  return {
    ...source,
    id: "",
    name: dcaCopyName(source.name),
    long: { ...IDLE_DCA_LEG },
    short: { ...IDLE_DCA_LEG },
    armConditionTrue: false,
    disarmConditionTrue: false,
    longIndicatorTrue: false,
    shortIndicatorTrue: false,
    updatedAtMs: 0,
  };
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
  venue = "bybit",
): { ok: true; config: DcaPlaybookConfig } | { ok: false; error: string } {
  const name = parseDcaPlaybookName(form.get("name"));
  const deskVenue = String(form.get("deskVenue") ?? venue).trim() || "bybit";
  const symbol = parseDeskFuturesSymbol(deskVenue, form.get("symbol"));
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
  const maxValueKindRaw = String(form.get("maxValueKind") ?? "").trim();
  const explicitMaxValueKind =
    maxValueKindRaw === "none" ||
    maxValueKindRaw === "usdt" ||
    maxValueKindRaw === "percent"
      ? maxValueKindRaw
      : null;
  const maxValueKind =
    explicitMaxValueKind === "percent"
      ? "percent"
      : parseDcaMaxValueKind(maxValueKindRaw);
  const bookUsdt = parseOptionalPositive(form.get("accountBookUsdt"));
  const typedMaxType = form.get("maxType");
  const hasMaxType =
    typedMaxType != null && String(typedMaxType).trim() !== "";
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
    return {
      ok: false,
      error:
        deskVenue === "hyperliquid"
          ? "Choose long or short."
          : "Choose long, short, or both.",
    };
  }
  if (deskVenue === "hyperliquid" && direction === "both") {
    return {
      ok: false,
      error: "This desk is one-way. Choose long or short.",
    };
  }
  if (!sizeUnit.ok) {
    return sizeUnit;
  }
  if (!maxClips.ok) {
    return maxClips;
  }
  if (!maxValue.ok) {
    return maxValue;
  }
  if (!bookUsdt.ok) {
    return bookUsdt;
  }
  let clipsCap = maxClips.value;
  let valueCap = maxValue.value;
  if (hasMaxType) {
    const maxType = parseDcaMaxType(typedMaxType);
    clipsCap = maxType === "orders" ? maxClips.value : null;
    valueCap = maxType === "value" ? maxValue.value : null;
  } else if (explicitMaxValueKind === "none") {
    valueCap = null;
  } else if (
    (explicitMaxValueKind === "usdt" || explicitMaxValueKind === "percent") &&
    valueCap == null
  ) {
    return { ok: false, error: "Enter a max value." };
  }
  if (maxValueKind === "percent" && valueCap != null && valueCap > 100) {
    return { ok: false, error: "Percent must be 100 or less." };
  }
  const resolvedValue = dcaResolvedMaxValueUsdt({
    kind: maxValueKind,
    maxValue: valueCap,
    bookUsdt: bookUsdt.value,
  });
  const derivedClip =
    clipsCap != null && resolvedValue != null && sizeUnit.unit === "usdt"
      ? dcaClipFromBudget({
          maxValue: resolvedValue,
          maxClips: clipsCap,
          sizeMultiplier: sizeMultiplier.ok ? sizeMultiplier.value : 1,
          sizeUnit: "usdt",
        })
      : null;
  const clipQty = derivedClip ?? (clipSize.ok ? clipSize.qty : null);
  if (clipQty == null || !(clipQty > 0)) {
    return {
      ok: false,
      error:
        clipsCap != null && valueCap != null && sizeUnit.unit === "qty"
          ? "Enter an order size, or use USDT size so the first order can be calculated."
          : "Enter an order size.",
    };
  }
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
    direction === "both" ? "Long start price" : "Start price",
  );
  if (!armTrigger.ok) {
    return armTrigger;
  }
  if (startKind === "price" && !armTrigger.trigger) {
    return { ok: false, error: "Enter a start price." };
  }
  const shortArmTrigger = parseOptionalTrigger(
    startKind === "price" && direction === "both",
    form.get("shortArmTriggerBy"),
    form.get("shortArmCompare"),
    form.get("shortArmPrice"),
    "Short start price",
  );
  if (!shortArmTrigger.ok) {
    return shortArmTrigger;
  }
  if (
    startKind === "price" &&
    direction === "both" &&
    !shortArmTrigger.trigger
  ) {
    return { ok: false, error: "Enter a Short start price." };
  }
  const webhookId =
    startKind === "webhook" ? parseDcaPlaybookId(form.get("webhookId")) : null;
  if (startKind === "webhook" && !webhookId) {
    return { ok: false, error: "Choose a Signal webhook." };
  }
  const longIndicator = parseIndicatorStartFields(
    form,
    {
      kind: "indicatorKind",
      timeframe: "indicatorTimeframe",
      compare: "indicatorCompare",
      level: "indicatorLevel",
    },
    startKind === "indicator",
    direction === "both" ? "Long" : "",
  );
  if (!longIndicator.ok) {
    return longIndicator;
  }
  const shortIndicator = parseIndicatorStartFields(
    form,
    {
      kind: "shortIndicatorKind",
      timeframe: "shortIndicatorTimeframe",
      compare: "shortIndicatorCompare",
      level: "shortIndicatorLevel",
    },
    startKind === "indicator" && direction === "both",
    "Short",
  );
  if (!shortIndicator.ok) {
    return shortIndicator;
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
      clipSize: clipQty,
      sizeUnit: sizeUnit.unit,
      maxClips: clipsCap,
      maxValue: valueCap,
      maxValueKind,
      dipPct: dipPct.value,
      intervalMinutes: intervalMinutes.value,
      sizeMultiplier: sizeMultiplier.value,
      deviationMultiplier: deviationMultiplier.value,
      takeProfitPct: takeProfitPct.value,
      stopLossPct: stopLossPct.value,
      takeProfitBasis: parseDcaExitBasis(form.get("takeProfitBasis")),
      stopLossBasis: parseDcaExitBasis(form.get("stopLossBasis")),
      takeProfitOrderType: parseDcaExitOrderType(form.get("takeProfitOrderType")),
      stopLossOrderType: "market",
      breakevenActivationPct: breakevenActivationPct.value,
      breakevenOffsetPct: breakevenOffsetPct.value,
      trailingTriggerPct: trailingTriggerPct.value,
      trailingPct: trailingPct.value,
      armTrigger: armTrigger.trigger,
      shortArmTrigger: shortArmTrigger.trigger,
      disarmTrigger: null,
      indicatorKind: longIndicator.start?.kind ?? null,
      indicatorTimeframe: longIndicator.start?.timeframe ?? null,
      indicatorCompare: longIndicator.start?.compare ?? null,
      indicatorLevel: longIndicator.start?.level ?? null,
      shortIndicatorKind: shortIndicator.start?.kind ?? null,
      shortIndicatorTimeframe: shortIndicator.start?.timeframe ?? null,
      shortIndicatorCompare: shortIndicator.start?.compare ?? null,
      shortIndicatorLevel: shortIndicator.start?.level ?? null,
    },
  };
}

function parseIndicatorStartFields(
  form: FormData,
  names: {
    kind: string;
    timeframe: string;
    compare: string;
    level: string;
  },
  enabled: boolean,
  label: string,
):
  | { ok: true; start: DcaIndicatorStart | null }
  | { ok: false; error: string } {
  if (!enabled) {
    return { ok: true, start: null };
  }
  const prefix = label ? `${label} ` : "";
  const kind = parseDcaIndicatorKind(form.get(names.kind));
  if (!kind) {
    return { ok: false, error: `Choose ${prefix}RSI, MACD, or EMA cross.` };
  }
  const timeframe = parseDcaIndicatorTimeframe(
    form.get(names.timeframe) ?? "15",
  );
  if (!timeframe) {
    return { ok: false, error: `Choose a ${prefix}timeframe.` };
  }
  const compareRaw = String(form.get(names.compare) ?? "").trim();
  if (kind === "rsi") {
    const cmp = parseDcaIndicatorCompare(compareRaw || "cross_lte");
    const level = parseOptionalPositive(form.get(names.level));
    if (!cmp) {
      return { ok: false, error: `Choose when ${prefix}RSI should fire.` };
    }
    if (!level.ok || level.value === null) {
      return { ok: false, error: `Enter an ${prefix}RSI level.` };
    }
    return {
      ok: true,
      start: { kind, timeframe, compare: cmp, level: level.value },
    };
  }
  if (kind === "macd") {
    const cmp = parseDcaIndicatorCompare(compareRaw || "cross_gte");
    if (!cmp) {
      return { ok: false, error: `Choose when ${prefix}MACD should fire.` };
    }
    return {
      ok: true,
      start: {
        kind,
        timeframe,
        compare: cmp === "cross_gte" || cmp === "cross_lte" ? "cross_gte" : "gte",
        level: null,
      },
    };
  }
  if (compareRaw === "pair" || compareRaw === "") {
    return {
      ok: true,
      start: { kind, timeframe, compare: null, level: null },
    };
  }
  const cmp = parseDcaIndicatorCompare(compareRaw);
  if (cmp !== "cross_gte" && cmp !== "cross_lte") {
    return { ok: false, error: `Choose when ${prefix}EMA should fire.` };
  }
  const level = parseOptionalPositive(form.get(names.level));
  if (!level.ok || level.value === null) {
    return { ok: false, error: `Enter an ${prefix}EMA price level.` };
  }
  return {
    ok: true,
    start: { kind, timeframe, compare: cmp, level: level.value },
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
    cycleMaxValue: asPositiveOrNull(row[`${prefix}_cycle_max_value`]),
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
  const indicatorKind = parseDcaIndicatorKind(row.indicator_kind);
  const indicatorTimeframe = parseDcaIndicatorTimeframe(
    row.indicator_timeframe,
  );
  const indicatorCompare = parseDcaIndicatorCompare(row.indicator_compare);
  const shortIndicatorKind = parseDcaIndicatorKind(row.short_indicator_kind);
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
    maxValueKind: parseDcaMaxValueKind(row.max_value_kind),
    dipPct: asPositiveOrNull(row.dip_pct),
    intervalMinutes: asPositiveIntOrNull(row.interval_minutes),
    sizeMultiplier: asPositiveOrNull(row.size_multiplier) ?? 1,
    deviationMultiplier: asPositiveOrNull(row.deviation_multiplier) ?? 1,
    takeProfitPct: asPositiveOrNull(row.take_profit_pct),
    stopLossPct: asPositiveOrNull(row.stop_loss_pct),
    takeProfitBasis: parseDcaExitBasis(row.take_profit_basis),
    stopLossBasis: parseDcaExitBasis(row.stop_loss_basis),
    takeProfitOrderType: parseDcaExitOrderType(row.take_profit_order_type),
    stopLossOrderType: "market",
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
    shortArmTrigger: parseStoredTrigger(
      row.short_arm_trigger_by,
      row.short_arm_compare,
      row.short_arm_price,
    ),
    disarmTrigger: parseStoredTrigger(
      row.disarm_trigger_by,
      row.disarm_compare,
      row.disarm_price,
    ),
    indicatorKind,
    indicatorTimeframe,
    indicatorCompare,
    indicatorLevel: asPositiveOrNull(row.indicator_level),
    shortIndicatorKind,
    shortIndicatorTimeframe: parseDcaIndicatorTimeframe(
      row.short_indicator_timeframe,
    ),
    shortIndicatorCompare: parseDcaIndicatorCompare(
      row.short_indicator_compare,
    ),
    shortIndicatorLevel: asPositiveOrNull(row.short_indicator_level),
    updatedAtMs: (() => {
      const ms = new Date(String(row.updated_at ?? "")).getTime();
      return Number.isFinite(ms) ? ms : 0;
    })(),
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

export function dcaGridClipCounts(
  rows: readonly { status?: string; idempotencyKey: string | null }[],
  playbookId: string,
  side: FuturesSide,
): { open: number; filledAdds: number } {
  const filledAdds = new Set<number>();
  let open = 0;
  for (const row of rows) {
    if (!isDcaClipKey(row.idempotencyKey, playbookId, side)) {
      continue;
    }
    const index = parseDcaClipIndex(row.idempotencyKey);
    if (index === null) {
      continue;
    }
    if (!row.status || row.status === "open") {
      open += 1;
    }
    if (row.status === "filled" && index >= 1) {
      filledAdds.add(index);
    }
  }
  return { open, filledAdds: filledAdds.size };
}

export function dcaClipsFilledFromGrid(input: {
  hasFirstFill: boolean;
  maxClips: number | null;
  openWorking: number;
  filledAdds: number;
}): number {
  const floor = input.hasFirstFill ? 1 : 0;
  const fromFilled = floor + Math.max(0, input.filledAdds);
  if (input.maxClips === null) {
    return fromFilled;
  }
  if (input.openWorking > 0) {
    const fromOpen = input.maxClips - input.openWorking;
    return Math.min(
      input.maxClips,
      Math.max(floor, fromFilled, fromOpen),
    );
  }
  return Math.min(input.maxClips, Math.max(floor, fromFilled));
}

export function dcaCycleEnded(input: {
  status: DcaStatus;
  clipsFilled: number;
  positionQty: number | null;
}): boolean {
  if (!dcaLegIsRunning(input.status)) {
    return false;
  }
  if (input.clipsFilled < 1) {
    return false;
  }
  return !(input.positionQty !== null && input.positionQty > 0);
}

export function dcaLiveQtyBlocksCycleEnd(
  livePositionQty: number | null | undefined,
): boolean {
  return (
    livePositionQty !== null &&
    livePositionQty !== undefined &&
    livePositionQty > 0
  );
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
  indicatorCompare?: DcaIndicatorCompare | null;
  indicatorLevel?: number | null;
  indicatorConditionTrue?: boolean;
  splitIndicatorSides?: boolean;
  closes?: number[] | null;
  takeProfitOrderType?: FuturesOrderType;
  tpLimitResting?: boolean;
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
  const splitBySide = Boolean(input.splitIndicatorSides);
  const armPrice = triggerPrice(input.armTrigger, input.triggerPrices);
  const armMet = Boolean(
    startKind === "price" &&
      input.armTrigger &&
      armPrice !== null &&
      triggerConditionMet(
        armPrice,
        input.armTrigger.compare,
        input.armTrigger.price,
      ) &&
      (!splitBySide ||
        (input.side === "long"
          ? input.armTrigger.compare === "gte"
          : input.armTrigger.compare === "lte")),
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
  const latchCross = dcaIndicatorStartLatches(
    indicatorKind,
    indicatorCompare,
  );
  const indicatorNow = Boolean(
    startKind === "indicator" &&
      indicatorKind &&
      closes &&
      (indicatorStartMet({
        kind: indicatorKind,
        side: input.side,
        closes,
        compare: indicatorCompare,
        level: indicatorLevel,
        splitBySide,
      }) ||
        (latchCross &&
          indicatorStartMet({
            kind: indicatorKind,
            side: input.side,
            closes: indicatorClosesForCross(closes),
            compare: indicatorCompare,
            level: indicatorLevel,
            splitBySide,
          }))),
  );
  const indicatorDue =
    indicatorNow ||
    (startKind === "indicator" &&
      latchCross &&
      Boolean(input.indicatorConditionTrue) &&
      input.clipsFilled === 0);
  const nextArmTrue = armMet;
  const nextDisarmTrue = disarmMet;
  const nextIndicatorTrue =
    startKind === "indicator" && latchCross
      ? indicatorDue
      : indicatorNow;
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
    const waitForLimit =
      (input.takeProfitOrderType ?? "market") === "limit" &&
      Boolean(input.tpLimitResting);
    if (waitForLimit) {
      return {
        action: { kind: "none" },
        nextArmTrue,
        nextDisarmTrue,
        nextIndicatorTrue,
      };
    }
    return {
      action: { kind: "close", reason: "take_profit" },
      nextArmTrue,
      nextDisarmTrue,
      nextIndicatorTrue,
    };
  }

  if (
    dcaCycleEnded({
      status: input.status,
      clipsFilled: input.clipsFilled,
      positionQty: input.positionQty,
    })
  ) {
    return {
      action: { kind: "end_cycle" },
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
      (startKind === "indicator" && indicatorDue);
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

export function dcaClipRestKey(
  playbookId: string,
  side: FuturesSide,
  clipIndex: number,
  generationMs: number,
): string {
  const generation = Math.max(0, Math.floor(generationMs));
  return `${dcaClipKey(playbookId, side, clipIndex)}x${generation}`;
}

export function dcaClipCycleKey(
  playbookId: string,
  side: FuturesSide,
  clipIndex: number,
  positionId: string,
): string {
  const prefix = dcaClipKey(playbookId, side, clipIndex);
  const pos = positionId.replace(/-/g, "").slice(0, 8);
  const withPos = `${prefix}p${pos}`;
  return withPos.length <= 36 ? withPos : prefix;
}

export function parseDcaClipIndex(key: string | null | undefined): number | null {
  if (!key) {
    return null;
  }
  const match =
    /^d[a-f0-9]{8}[ls](\d+)(?:x\d+|p[a-f0-9]+)?$/i.exec(key.trim());
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

export function isDcaClipKey(
  key: string | null | undefined,
  playbookId: string,
  side: FuturesSide,
): boolean {
  const index = parseDcaClipIndex(key);
  if (index === null || !key) {
    return false;
  }
  const expected = dcaClipKey(playbookId, side, index).toLowerCase();
  const raw = key.trim().toLowerCase();
  return (
    raw === expected ||
    raw.startsWith(`${expected}x`) ||
    raw.startsWith(`${expected}p`)
  );
}

export function formatDcaEntryType(clipIndex: number): string {
  return `Entry # ${clipIndex + 1}`;
}

export type DcaExitLimitKind = "tp" | "sl";

export function dcaExitLimitKey(
  playbookId: string,
  side: FuturesSide,
  kind: DcaExitLimitKind,
): string {
  const compact = playbookId.replace(/-/g, "").slice(0, 8);
  const sideChar = side === "long" ? "l" : "s";
  return `d${compact}${sideChar}${kind}`;
}

export function dcaExitLimitRestKey(
  playbookId: string,
  side: FuturesSide,
  kind: DcaExitLimitKind,
  qty: number,
  limitPrice: number,
  positionId?: string,
): string {
  const prefix = dcaExitLimitKey(playbookId, side, kind);
  const pos = String(positionId ?? "")
    .replace(/-/g, "")
    .slice(0, 8);
  const q = Math.max(0, Math.round(qty * 1e8)).toString(36);
  const p = Math.max(0, Math.round(limitPrice * 1e4)).toString(36);
  const withPos = pos ? `${prefix}${pos}x${q}p${p}` : `${prefix}x${q}p${p}`;
  if (withPos.length <= 36) {
    return withPos;
  }
  const short = pos ? `${prefix}${pos}` : prefix;
  return short.length <= 36 ? short : short.slice(0, 36);
}

export function dcaFlattenKey(
  playbookId: string,
  side: FuturesSide,
  positionId: string,
): string {
  const compact = playbookId.replace(/-/g, "").slice(0, 8);
  const pos = positionId.replace(/-/g, "").slice(0, 8);
  const sideChar = side === "long" ? "l" : "s";
  return `c${compact}${sideChar}${pos}`;
}

export function parseDcaExitLimitKind(
  key: string | null | undefined,
): DcaExitLimitKind | null {
  if (!key) {
    return null;
  }
  const match =
    /^d[a-f0-9]{8}[ls](tp|sl)(?:[a-f0-9]{8})?(?:\d+|x[a-z0-9]+)?$/i.exec(
      key.trim(),
    );
  if (!match) {
    return null;
  }
  return match[1].toLowerCase() === "sl" ? "sl" : "tp";
}

export function isDcaExitLimitKey(
  key: string | null | undefined,
  playbookId: string,
  side: FuturesSide,
  kind: DcaExitLimitKind,
): boolean {
  if (!key || parseDcaExitLimitKind(key) !== kind) {
    return false;
  }
  return key
    .trim()
    .toLowerCase()
    .startsWith(dcaExitLimitKey(playbookId, side, kind).toLowerCase());
}

const SAME_SAFETY = 1e-12;

function sameSafetyNumber(left: number, right: number): boolean {
  return Math.abs(left - right) <= SAME_SAFETY;
}

function sameNullablePrice(left: number | null, right: number | null): boolean {
  if (left === null && right === null) {
    return true;
  }
  if (left === null || right === null) {
    return false;
  }
  return sameSafetyNumber(left, right);
}

export function dcaExitTpslNeedsVenueSync(
  current: FuturesTpsl,
  next: FuturesTpsl,
): boolean {
  const from = tpslWithoutLimitExits(current);
  const to = tpslWithoutLimitExits(next);
  return (
    !sameNullablePrice(from.takeProfit, to.takeProfit) ||
    !sameNullablePrice(from.stopLoss, to.stopLoss) ||
    (to.takeProfit !== null && from.tpOrderType !== to.tpOrderType) ||
    (to.stopLoss !== null && from.slOrderType !== to.slOrderType)
  );
}

export type DcaSafetyWorkingRow = {
  id: string;
  idempotencyKey: string | null;
  remainingQty: number;
  limitPrice: number;
  reduceOnly: boolean;
  status?: string;
  positionId?: string | null;
};

export function dcaOpenExitLimits(
  working: readonly DcaSafetyWorkingRow[],
  playbookId: string,
  side: FuturesSide,
  kind: DcaExitLimitKind,
): DcaSafetyWorkingRow[] {
  return working.filter(
    (row) =>
      (!row.status || row.status === "open") &&
      isDcaExitLimitKey(row.idempotencyKey, playbookId, side, kind),
  );
}

export function planDcaExitLimitKeep(
  rows: readonly DcaSafetyWorkingRow[],
  qty: number,
  limitPrice: number,
): { keep: DcaSafetyWorkingRow | null; cancelIds: string[] } {
  if (rows.length === 0) {
    return { keep: null, cancelIds: [] };
  }
  const match = rows.find(
    (row) =>
      sameSafetyNumber(row.remainingQty, qty) &&
      sameSafetyNumber(row.limitPrice, limitPrice),
  );
  const keep = match ?? rows[0]!;
  return {
    keep,
    cancelIds: rows.filter((row) => row.id !== keep.id).map((row) => row.id),
  };
}

export type DcaExitLimitPlan =
  | { kind: "keep" }
  | { kind: "amend"; qty: number; limitPrice: number }
  | { kind: "replace" }
  | { kind: "rest" };

export function planDcaExitLimitSync(input: {
  qty: number;
  limitPrice: number;
  existing: { remainingQty: number; limitPrice: number } | null;
}): DcaExitLimitPlan {
  if (!input.existing) {
    return { kind: "rest" };
  }
  const sameQty = sameSafetyNumber(input.existing.remainingQty, input.qty);
  const samePrice = sameSafetyNumber(input.existing.limitPrice, input.limitPrice);
  if (sameQty && samePrice) {
    return { kind: "keep" };
  }
  if (input.qty > input.existing.remainingQty + SAME_SAFETY) {
    return { kind: "replace" };
  }
  return { kind: "amend", qty: input.qty, limitPrice: input.limitPrice };
}

export type DcaSafetySyncPlan = {
  cancelIds: string[];
  amend: { workingId: string; qty: number; limitPrice: number }[];
  rest: { clipIndex: number; qty: number; limitPrice: number }[];
};

export function planDcaSafetySync(input: {
  playbookId: string;
  side: FuturesSide;
  status: DcaStatus;
  dcaMode: DcaMode;
  maxClips: number | null;
  dipPct: number | null;
  deviationMultiplier: number;
  clipSize: number;
  sizeMultiplier: number;
  sizeUnit: "qty" | "usdt";
  entryPrice: number | null;
  positionId?: string | null;
  working: readonly DcaSafetyWorkingRow[];
}): DcaSafetySyncPlan {
  const matching = input.working.filter(
    (row) =>
      !row.reduceOnly &&
      isDcaClipKey(row.idempotencyKey, input.playbookId, input.side),
  );
  const matchingOpen = matching.filter(
    (row) => !row.status || row.status === "open",
  );
  const filledIndices = new Set<number>();
  for (const row of matching) {
    if (row.status !== "filled") {
      continue;
    }
    const index = parseDcaClipIndex(row.idempotencyKey);
    if (index === null || index < 1) {
      continue;
    }
    if (input.positionId && row.positionId !== input.positionId) {
      continue;
    }
    filledIndices.add(index);
  }
  const restGrid =
    input.status === "armed" &&
    input.dcaMode === "order" &&
    input.maxClips !== null &&
    input.maxClips >= 2 &&
    input.dipPct !== null &&
    input.entryPrice !== null &&
    input.entryPrice > 0;
  if (!restGrid) {
    return {
      cancelIds: matchingOpen.map((row) => row.id),
      amend: [],
      rest: [],
    };
  }
  const prices = dcaSafetyPrices({
    side: input.side,
    entryPrice: input.entryPrice as number,
    maxClips: input.maxClips as number,
    dipPct: input.dipPct as number,
    deviationMultiplier: input.deviationMultiplier,
  });
  const planned = new Map<number, { qty: number; limitPrice: number }>();
  for (let i = 0; i < prices.length; i += 1) {
    const clipIndex = i + 1;
    const qty = dcaClipSizeAt(
      clipIndex,
      input.clipSize,
      input.sizeMultiplier,
    );
    if (!(qty > 0) || !(prices[i] > 0)) {
      continue;
    }
    planned.set(clipIndex, { qty, limitPrice: prices[i] });
  }
  const openByIndex = new Map<number, DcaSafetyWorkingRow>();
  const cancelIds: string[] = [];
  for (const row of matchingOpen) {
    const index = parseDcaClipIndex(row.idempotencyKey);
    if (index === null || !planned.has(index) || openByIndex.has(index)) {
      cancelIds.push(row.id);
      continue;
    }
    openByIndex.set(index, row);
  }
  const amend: DcaSafetySyncPlan["amend"] = [];
  const rest: DcaSafetySyncPlan["rest"] = [];
  for (const [clipIndex, want] of planned) {
    if (filledIndices.has(clipIndex)) {
      continue;
    }
    const row = openByIndex.get(clipIndex);
    if (!row) {
      rest.push({ clipIndex, qty: want.qty, limitPrice: want.limitPrice });
      continue;
    }
    const priceChanged = !sameSafetyNumber(row.limitPrice, want.limitPrice);
    const qtyChanged =
      input.sizeUnit === "qty" &&
      !sameSafetyNumber(row.remainingQty, want.qty);
    if (!priceChanged && !qtyChanged) {
      continue;
    }
    amend.push({
      workingId: row.id,
      qty: input.sizeUnit === "qty" ? want.qty : row.remainingQty,
      limitPrice: want.limitPrice,
    });
  }
  return { cancelIds, amend, rest };
}

export const DCA_LIVE_GRID_OPS_PER_SYNC = 6;

export function capDcaSafetySync(
  plan: DcaSafetySyncPlan,
  maxOps: number,
): DcaSafetySyncPlan {
  const cap = Math.max(0, Math.floor(maxOps));
  if (!Number.isFinite(cap) || cap <= 0) {
    return { cancelIds: [], amend: [], rest: [] };
  }
  const cancelIds = plan.cancelIds.slice(0, cap);
  let left = cap - cancelIds.length;
  const restSorted = [...plan.rest].sort((a, b) => a.clipIndex - b.clipIndex);
  const rest = left > 0 ? restSorted.slice(0, left) : [];
  left -= rest.length;
  const amend = left > 0 ? plan.amend.slice(0, left) : [];
  return { cancelIds, rest, amend };
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
  working?: readonly {
    idempotencyKey?: string | null;
    status?: string | null;
  }[];
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
  const tpLimitResting = (input.working ?? []).some(
    (row) =>
      (!row.status || row.status === "open") &&
      isDcaExitLimitKey(
        row.idempotencyKey,
        input.playbook.id,
        input.side,
        "tp",
      ),
  );
  return {
    playbookId: input.playbook.id,
    orders: formatDcaOrdersProgress({
      filled,
      maxClips: input.playbook.maxClips,
    }),
    plannedTakeProfit: planned.takeProfit,
    plannedStopLoss: planned.stopLoss,
    plannedTrailing: planned.trailingStop,
    takeProfitOrderType: input.playbook.takeProfitOrderType,
    stopLossOrderType: "market",
    tpLimitResting,
  };
}

export function dcaHintsForCopyOpen(
  playbooks: readonly DcaPlaybook[],
  open: Array<{
    symbol: string;
    side: FuturesSide;
    orders?: readonly { action: string }[];
    entryPrice?: number | null;
    mark?: number | null;
  }>,
  working?: readonly {
    idempotencyKey?: string | null;
    status?: string | null;
  }[],
): Record<string, DcaOpenHint> {
  const hints: Record<string, DcaOpenHint> = {};
  for (const row of open) {
    const playbook = playbooks.find((item) => item.symbol === row.symbol);
    if (!playbook) {
      continue;
    }
    const filled = dcaFilledClipCount(row.orders) ?? 0;
    const planned = dcaPlannedExits({
      side: row.side,
      entryPrice: row.entryPrice ?? null,
      firstFillPrice: dcaLegFor(playbook, row.side).firstFillPrice,
      mark: row.mark ?? null,
      takeProfitPct: playbook.takeProfitPct,
      stopLossPct: playbook.stopLossPct,
      takeProfitBasis: playbook.takeProfitBasis,
      stopLossBasis: playbook.stopLossBasis,
      trailingPct: playbook.trailingPct,
    });
    const tpLimitResting = (working ?? []).some(
      (item) =>
        (!item.status || item.status === "open") &&
        (isDcaExitLimitKey(item.idempotencyKey, playbook.id, row.side, "tp") ||
          parseDcaExitLimitKind(item.idempotencyKey) === "tp"),
    );
    hints[dcaHintKey(row.symbol, row.side)] = {
      playbookId: playbook.id,
      orders: formatDcaOrdersProgress({
        filled,
        maxClips: playbook.maxClips,
      }),
      plannedTakeProfit: planned.takeProfit,
      plannedStopLoss: planned.stopLoss,
      plannedTrailing: planned.trailingStop,
      takeProfitOrderType: playbook.takeProfitOrderType,
      stopLossOrderType: "market",
      tpLimitResting,
    };
  }
  return hints;
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
  working?: readonly {
    idempotencyKey?: string | null;
    status?: string | null;
  }[],
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
      working,
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
