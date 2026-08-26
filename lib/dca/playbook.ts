import {
  parseFuturesQty,
  parseFuturesSide,
  parseFuturesSizeUnit,
  parseFuturesSymbol,
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

export type DcaStatus = "idle" | "armed" | "stop_adding";

export type DcaPriceTrigger = {
  triggerBy: FuturesTrigger;
  compare: FuturesTriggerCompare;
  price: number;
};

export type DcaPlaybookConfig = {
  name: string;
  symbol: string;
  side: FuturesSide;
  clipSize: number;
  sizeUnit: "qty" | "usdt";
  maxClips: number | null;
  maxValue: number | null;
  dipPct: number | null;
  intervalMinutes: number | null;
  takeProfitPct: number | null;
  stopLossPct: number | null;
  armTrigger: DcaPriceTrigger | null;
  disarmTrigger: DcaPriceTrigger | null;
};

export type DcaPlaybook = DcaPlaybookConfig & {
  id: string;
  userId: string;
  accountId: string;
  status: DcaStatus;
  clipsFilled: number;
  lastClipPrice: number | null;
  lastClipAtMs: number | null;
  armConditionTrue: boolean;
  disarmConditionTrue: boolean;
};

export const DEFAULT_DCA_NAME = "DCA";

export type DcaTickAction =
  | { kind: "none" }
  | { kind: "arm" }
  | { kind: "disarm" }
  | { kind: "clip" }
  | { kind: "close"; reason: "take_profit" | "stop_loss" }
  | { kind: "stop_adding" };

export type DcaTickDecision = {
  action: DcaTickAction;
  nextArmTrue: boolean;
  nextDisarmTrue: boolean;
};

export function parseDcaStatus(value: unknown): DcaStatus {
  if (value === "armed" || value === "stop_adding") {
    return value;
  }
  return "idle";
}

export function dcaPlaybookIsRunning(status: DcaStatus): boolean {
  return status === "armed" || status === "stop_adding";
}

export type DcaOpenHint = {
  clips: number;
  nextAdd: string;
  remaining: string;
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

export function parseDcaPlaybookName(
  raw: unknown,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(raw ?? "").trim() || DEFAULT_DCA_NAME;
  if (name.length > 40) {
    return { ok: false, error: "Name must be 40 characters or fewer." };
  }
  return { ok: true, name };
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
  const side = parseFuturesSide(form.get("side"));
  const sizeUnit = parseFuturesSizeUnit(form.get("sizeUnit"));
  const clipSize = parseFuturesQty(form.get("clipSize"));
  const maxClips = parseOptionalPositiveInt(form.get("maxClips"));
  const maxValue = parseOptionalPositive(form.get("maxValue"));
  const dipPct = parseOptionalPositive(form.get("dipPct"));
  const intervalMinutes = parseOptionalPositiveInt(form.get("intervalMinutes"));
  const takeProfitPct = parseOptionalPositive(form.get("takeProfitPct"));
  const stopLossPct = parseOptionalPositive(form.get("stopLossPct"));
  if (!name.ok) {
    return name;
  }
  if (!symbol.ok) {
    return symbol;
  }
  if (!side) {
    return { ok: false, error: "Choose long or short." };
  }
  if (!sizeUnit.ok) {
    return sizeUnit;
  }
  if (!clipSize.ok) {
    return { ok: false, error: "Enter a clip size." };
  }
  if (!maxClips.ok) {
    return maxClips;
  }
  if (!maxValue.ok) {
    return maxValue;
  }
  if (!dipPct.ok) {
    return dipPct;
  }
  if (!intervalMinutes.ok) {
    return intervalMinutes;
  }
  if (!takeProfitPct.ok) {
    return takeProfitPct;
  }
  if (!stopLossPct.ok) {
    return stopLossPct;
  }
  const armTrigger = parseOptionalTrigger(
    form.get("armEnabled") === "1",
    form.get("armTriggerBy"),
    form.get("armCompare"),
    form.get("armPrice"),
    "Arm when",
  );
  const disarmTrigger = parseOptionalTrigger(
    form.get("disarmEnabled") === "1",
    form.get("disarmTriggerBy"),
    form.get("disarmCompare"),
    form.get("disarmPrice"),
    "Disarm when",
  );
  if (!armTrigger.ok) {
    return armTrigger;
  }
  if (!disarmTrigger.ok) {
    return disarmTrigger;
  }
  return {
    ok: true,
    config: {
      name: name.name,
      symbol: symbol.symbol,
      side,
      clipSize: clipSize.qty,
      sizeUnit: sizeUnit.unit,
      maxClips: maxClips.value,
      maxValue: maxValue.value,
      dipPct: dipPct.value,
      intervalMinutes: intervalMinutes.value,
      takeProfitPct: takeProfitPct.value,
      stopLossPct: stopLossPct.value,
      armTrigger: armTrigger.trigger,
      disarmTrigger: disarmTrigger.trigger,
    },
  };
}

export function parseDcaPlaybookRow(
  row: Record<string, unknown>,
): DcaPlaybook | null {
  const id = String(row.id ?? "").trim();
  const userId = String(row.user_id ?? "").trim();
  const accountId = String(row.account_id ?? "").trim();
  const symbol = parseFuturesSymbol(row.symbol);
  const side = parseFuturesSide(row.side);
  const sizeUnit = parseFuturesSizeUnit(row.size_unit);
  const clipSize = Number(row.clip_size);
  if (
    !id ||
    !userId ||
    !accountId ||
    !symbol.ok ||
    !side ||
    !sizeUnit.ok ||
    !(clipSize > 0)
  ) {
    return null;
  }
  const lastClipAt = new Date(String(row.last_clip_at ?? "")).getTime();
  const named = parseDcaPlaybookName(row.name);
  return {
    id,
    userId,
    accountId,
    name: named.ok ? named.name : DEFAULT_DCA_NAME,
    symbol: symbol.symbol,
    side: side,
    clipSize,
    sizeUnit: sizeUnit.unit,
    maxClips: asPositiveIntOrNull(row.max_clips),
    maxValue: asPositiveOrNull(row.max_value),
    dipPct: asPositiveOrNull(row.dip_pct),
    intervalMinutes: asPositiveIntOrNull(row.interval_minutes),
    takeProfitPct: asPositiveOrNull(row.take_profit_pct),
    stopLossPct: asPositiveOrNull(row.stop_loss_pct),
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
    status: parseDcaStatus(row.status),
    clipsFilled: Math.max(0, Math.floor(Number(row.clips_filled) || 0)),
    lastClipPrice: asPositiveOrNull(row.last_clip_price),
    lastClipAtMs: Number.isFinite(lastClipAt) ? lastClipAt : null,
    armConditionTrue: Boolean(row.arm_condition_true),
    disarmConditionTrue: Boolean(row.disarm_condition_true),
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
  nowMs: number;
  dipPct: number | null;
  intervalMinutes: number | null;
  clipsFilled: number;
  maxClips: number | null;
  maxValue: number | null;
  positionQty: number | null;
  entryPrice: number | null;
  takeProfitPct: number | null;
  stopLossPct: number | null;
  armTrigger: DcaPriceTrigger | null;
  armConditionTrue: boolean;
  disarmTrigger: DcaPriceTrigger | null;
  disarmConditionTrue: boolean;
  triggerPrices: { last: number | null; mark: number | null; index: number | null };
}): DcaTickDecision {
  const armPrice = triggerPrice(input.armTrigger, input.triggerPrices);
  const armMet = Boolean(
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
  const nextArmTrue = armMet;
  const nextDisarmTrue = disarmMet;
  const armEdge = armMet && !input.armConditionTrue;
  const disarmEdge = disarmMet && !input.disarmConditionTrue;

  if (input.status === "idle") {
    if (armEdge && !input.reduceOnly) {
      return { action: { kind: "arm" }, nextArmTrue, nextDisarmTrue };
    }
    return { action: { kind: "none" }, nextArmTrue, nextDisarmTrue };
  }

  const pnlPct =
    input.positionQty !== null &&
    input.entryPrice !== null &&
    input.mark !== null
      ? dcaPnlPct({
          side: input.side,
          qty: input.positionQty,
          entryPrice: input.entryPrice,
          mark: input.mark,
        })
      : null;
  if (
    pnlPct !== null &&
    input.stopLossPct !== null &&
    pnlPct <= -input.stopLossPct
  ) {
    return {
      action: { kind: "close", reason: "stop_loss" },
      nextArmTrue,
      nextDisarmTrue,
    };
  }
  if (
    pnlPct !== null &&
    input.takeProfitPct !== null &&
    pnlPct >= input.takeProfitPct
  ) {
    return {
      action: { kind: "close", reason: "take_profit" },
      nextArmTrue,
      nextDisarmTrue,
    };
  }

  if (input.status === "armed" && disarmEdge) {
    return { action: { kind: "disarm" }, nextArmTrue, nextDisarmTrue };
  }

  if (input.status !== "armed") {
    return { action: { kind: "none" }, nextArmTrue, nextDisarmTrue };
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
    return { action: { kind: "stop_adding" }, nextArmTrue, nextDisarmTrue };
  }

  if (input.reduceOnly) {
    return { action: { kind: "none" }, nextArmTrue, nextDisarmTrue };
  }

  const dip =
    input.dipPct !== null &&
    input.lastPrice !== null &&
    input.lastClipPrice !== null
      ? dcaDipMet({
          side: input.side,
          lastPrice: input.lastPrice,
          lastClipPrice: input.lastClipPrice,
          dipPct: input.dipPct,
        })
      : false;
  const interval = dcaIntervalMet({
    nowMs: input.nowMs,
    lastClipAtMs: input.lastClipAtMs,
    intervalMinutes: input.intervalMinutes,
  });
  if (dip || interval) {
    return { action: { kind: "clip" }, nextArmTrue, nextDisarmTrue };
  }
  return { action: { kind: "none" }, nextArmTrue, nextDisarmTrue };
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
  const parts: string[] = [];
  if (input.dipPct !== null) {
    parts.push(`${trimNumber(input.dipPct)}% dip`);
  }
  if (input.intervalMinutes !== null) {
    if (input.lastClipAtMs !== null) {
      const remainMs =
        input.lastClipAtMs + input.intervalMinutes * 60_000 - input.nowMs;
      if (remainMs <= 0) {
        parts.push("due");
      } else {
        const minutes = Math.ceil(remainMs / 60_000);
        parts.push(`${minutes}m`);
      }
    } else {
      parts.push(`${input.intervalMinutes}m`);
    }
  }
  if (parts.length > 0) {
    return parts.join(" or ");
  }
  return input.lastClipAtMs === null ? "First clip" : "Wait for TP/SL";
}

export function formatDcaRemaining(input: {
  clipsFilled: number;
  maxClips: number | null;
  maxValue: number | null;
  markValue: number | null;
}): string {
  const parts: string[] = [];
  if (input.maxClips !== null) {
    parts.push(`${Math.max(0, input.maxClips - input.clipsFilled)} clips`);
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

export function dcaOpenHint(input: {
  playbook: DcaPlaybook;
  symbol: string;
  side: FuturesSide;
  qty: number;
  mark: number | null;
  nowMs: number;
}): DcaOpenHint | null {
  if (
    input.playbook.status === "idle" ||
    input.playbook.symbol !== input.symbol ||
    input.playbook.side !== input.side
  ) {
    return null;
  }
  const markValue =
    input.mark !== null && input.qty > 0 ? input.qty * input.mark : null;
  return {
    clips: input.playbook.clipsFilled,
    nextAdd: formatDcaNextAdd({
      status: input.playbook.status,
      dipPct: input.playbook.dipPct,
      intervalMinutes: input.playbook.intervalMinutes,
      lastClipAtMs: input.playbook.lastClipAtMs,
      nowMs: input.nowMs,
    }),
    remaining: formatDcaRemaining({
      clipsFilled: input.playbook.clipsFilled,
      maxClips: input.playbook.maxClips,
      maxValue: input.playbook.maxValue,
      markValue,
    }),
  };
}

export function dcaHintsForOpen(
  playbook: DcaPlaybook | null,
  open: Array<{
    symbol: string;
    side: FuturesSide;
    qty: number;
    mark: number | null;
  }>,
  nowMs = Date.now(),
): Record<string, DcaOpenHint> {
  const hints: Record<string, DcaOpenHint> = {};
  if (!playbook) {
    return hints;
  }
  for (const row of open) {
    const hint = dcaOpenHint({
      playbook,
      symbol: row.symbol,
      side: row.side,
      qty: row.qty,
      mark: row.mark,
      nowMs,
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
