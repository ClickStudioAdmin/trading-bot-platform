import {
  parseAutomationMode,
  type AutomationMode,
} from "@/lib/engine/decide";
import {
  parseFuturesAction,
  parseFuturesLimitPrice,
  parseFuturesNotional,
  parseFuturesOrderType,
  parseFuturesQty,
  parseFuturesSide,
  parseFuturesSizeUnit,
  parseFuturesSymbol,
  type FuturesAction,
  type FuturesOrderType,
  type FuturesSide,
  type FuturesTrigger,
} from "./model";
import { parseFuturesTrigger } from "./tpsl";

export type FuturesTriggerCompare = "gte" | "lte";
export type FuturesAutomationEntry = "price" | "webhook";

export type FuturesAutomationRule = {
  id: string | null;
  name: string;
  sortOrder: number;
  mode: AutomationMode;
  symbol: string;
  action: FuturesAction;
  closeSide: FuturesSide | null;
  orderType: FuturesOrderType;
  sizeUnit: "qty" | "usdt";
  size: number | null;
  limitPrice: number | null;
  entrySource: FuturesAutomationEntry;
  webhookId: string | null;
  triggerBy: FuturesTrigger;
  triggerCompare: FuturesTriggerCompare;
  triggerPrice: number;
  skipIfOpen: boolean;
  conditionTrue: boolean;
  lastFiredAtMs: number | null;
};

export type FuturesAutomationFormValues = {
  id: string;
  key: string;
  name: string;
  mode: AutomationMode;
  symbol: string;
  formAction: "buy" | "sell" | "close_long" | "close_short";
  orderType: FuturesOrderType;
  sizeUnit: "qty" | "usdt";
  size: string;
  limitPrice: string;
  entrySource: FuturesAutomationEntry;
  webhookId: string;
  triggerBy: FuturesTrigger;
  triggerCompare: FuturesTriggerCompare;
  triggerPrice: string;
  skipIfOpen: boolean;
};

export function defaultFuturesAutomationForm(
  index: number,
  symbol = "BTCUSDT",
): FuturesAutomationFormValues {
  return {
    id: "",
    key: `new-${Date.now()}-${index}`,
    name: `Rule ${index + 1}`,
    mode: "active",
    symbol,
    formAction: "buy",
    orderType: "market",
    sizeUnit: "qty",
    size: "",
    limitPrice: "",
    entrySource: "price",
    webhookId: "",
    triggerBy: "last",
    triggerCompare: "gte",
    triggerPrice: "",
    skipIfOpen: true,
  };
}

export function parseFuturesTriggerCompare(
  raw: unknown,
): { ok: true; compare: FuturesTriggerCompare } | { ok: false; error: string } {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "gte" || value === ">=" || value === "above") {
    return { ok: true, compare: "gte" };
  }
  if (value === "lte" || value === "<=" || value === "below") {
    return { ok: true, compare: "lte" };
  }
  return { ok: false, error: "Choose at or above, or at or below." };
}

export function triggerConditionMet(
  price: number,
  compare: FuturesTriggerCompare,
  level: number,
): boolean {
  return compare === "gte" ? price >= level : price <= level;
}

export function automationSide(rule: {
  action: FuturesAction;
  closeSide: FuturesSide | null;
}): FuturesSide {
  if (rule.action === "flatten") {
    return rule.closeSide ?? "long";
  }
  return rule.action === "buy" ? "long" : "short";
}

export function futuresDeskAutomationStatus(input: {
  signedIn: boolean;
  modes: AutomationMode[];
  reduceOnly: boolean;
  liveBook: boolean;
  bound: boolean;
}): { automationsRunning: boolean; reduceOnly: boolean } {
  const anyActive = input.modes.some((mode) => mode === "active");
  const anyLive = input.modes.some((mode) => mode !== "disabled");
  const automationsOn = input.signedIn && anyLive;
  return {
    automationsRunning:
      automationsOn &&
      anyActive &&
      !input.reduceOnly &&
      (!input.liveBook || input.bound),
    reduceOnly: automationsOn && (input.reduceOnly || !anyActive),
  };
}

export function decideFuturesAutomationTick(input: {
  conditionMet: boolean;
  wasTrue: boolean;
  action: FuturesAction;
  mode: AutomationMode;
  bookReduceOnly: boolean;
  skipIfOpen: boolean;
  hasOpenOnSide: boolean;
}): { fire: boolean; nextTrue: boolean } {
  if (!input.conditionMet) {
    return { fire: false, nextTrue: false };
  }
  if (input.wasTrue) {
    return { fire: false, nextTrue: true };
  }
  const entriesBlocked =
    (input.action === "buy" || input.action === "sell") &&
    (input.mode === "reduce_only" || input.bookReduceOnly);
  if (entriesBlocked) {
    return { fire: false, nextTrue: false };
  }
  if (
    (input.action === "buy" || input.action === "sell") &&
    input.skipIfOpen &&
    input.hasOpenOnSide
  ) {
    return { fire: false, nextTrue: true };
  }
  if (input.action === "flatten" && !input.hasOpenOnSide) {
    return { fire: false, nextTrue: false };
  }
  return { fire: true, nextTrue: true };
}

export function futuresAutomationIdempotencyKey(
  ruleId: string,
  atMs = Date.now(),
): string {
  const compact = ruleId.replace(/-/g, "").slice(0, 8);
  return `a${compact}${atMs}`;
}

function parseFormAction(
  raw: unknown,
):
  | { ok: true; action: FuturesAction; closeSide: FuturesSide | null }
  | { ok: false; error: string } {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "close_long" || value === "close-long") {
    return { ok: true, action: "flatten", closeSide: "long" };
  }
  if (value === "close_short" || value === "close-short") {
    return { ok: true, action: "flatten", closeSide: "short" };
  }
  const parsed = parseFuturesAction(raw);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.action === "flatten") {
    return { ok: true, action: "flatten", closeSide: "long" };
  }
  return { ok: true, action: parsed.action, closeSide: null };
}

function parseOptionalSize(
  raw: unknown,
  unit: "qty" | "usdt",
  required: boolean,
): { ok: true; size: number | null } | { ok: false; error: string } {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (text === "") {
    if (required) {
      return { ok: false, error: "Enter a size." };
    }
    return { ok: true, size: null };
  }
  if (unit === "usdt") {
    const parsed = parseFuturesNotional(text);
    return parsed.ok ? { ok: true, size: parsed.qty } : parsed;
  }
  const parsed = parseFuturesQty(text);
  return parsed.ok ? { ok: true, size: parsed.qty } : parsed;
}

export function parseFuturesAutomationForm(
  form: FormData,
): { ok: true; rules: FuturesAutomationRule[] } | { ok: false; error: string } {
  const count = Number(String(form.get("ruleCount") ?? "0"));
  if (!Number.isInteger(count) || count < 0 || count > 50) {
    return { ok: false, error: "Too many rules." };
  }
  const rules: FuturesAutomationRule[] = [];
  for (let index = 0; index < count; index += 1) {
    const prefix = `r${index}_`;
    const parsed = parseFuturesAutomationFields({
      id: form.get(`${prefix}id`),
      name: form.get(`${prefix}name`),
      mode: form.get(`${prefix}mode`),
      symbol: form.get(`${prefix}symbol`),
      formAction: form.get(`${prefix}action`),
      orderType: form.get(`${prefix}orderType`),
      sizeUnit: form.get(`${prefix}sizeUnit`),
      size: form.get(`${prefix}size`),
      limitPrice: form.get(`${prefix}limitPrice`),
      entrySource: form.get(`${prefix}entrySource`),
      webhookId: form.get(`${prefix}webhookId`),
      triggerBy: form.get(`${prefix}triggerBy`),
      triggerCompare: form.get(`${prefix}triggerCompare`),
      triggerPrice: form.get(`${prefix}triggerPrice`),
      skipIfOpen: form.get(`${prefix}skipIfOpen`),
      sortOrder: index,
    });
    if (!parsed.ok) {
      return parsed;
    }
    rules.push(parsed.rule);
  }
  return { ok: true, rules };
}

export function parseFuturesAutomationFields(input: {
  id?: unknown;
  name?: unknown;
  mode?: unknown;
  symbol?: unknown;
  formAction?: unknown;
  closeSide?: unknown;
  action?: unknown;
  orderType?: unknown;
  sizeUnit?: unknown;
  size?: unknown;
  limitPrice?: unknown;
  entrySource?: unknown;
  webhookId?: unknown;
  triggerBy?: unknown;
  triggerCompare?: unknown;
  triggerPrice?: unknown;
  skipIfOpen?: unknown;
  sortOrder?: number;
  conditionTrue?: unknown;
  lastFiredAt?: unknown;
}): { ok: true; rule: FuturesAutomationRule } | { ok: false; error: string } {
  const name = String(input.name ?? "").trim() || `Rule ${(input.sortOrder ?? 0) + 1}`;
  if (name.length > 40) {
    return { ok: false, error: "Rule names must be 40 characters or fewer." };
  }
  const symbol = parseFuturesSymbol(input.symbol);
  if (!symbol.ok) {
    return symbol;
  }
  const actionParsed =
    input.formAction != null
      ? parseFormAction(input.formAction)
      : parseStoredAction(input.action, input.closeSide);
  if (!actionParsed.ok) {
    return actionParsed;
  }
  const orderType = parseFuturesOrderType(input.orderType);
  if (!orderType.ok) {
    return orderType;
  }
  const sizeUnit = parseFuturesSizeUnit(input.sizeUnit);
  if (!sizeUnit.ok) {
    return sizeUnit;
  }
  const unit = sizeUnit.unit === "usdt" ? "usdt" : "qty";
  const requiredSize = actionParsed.action !== "flatten";
  const size = parseOptionalSize(input.size, unit, requiredSize);
  if (!size.ok) {
    return size;
  }
  let limitPrice: number | null = null;
  if (orderType.orderType === "limit") {
    const parsed = parseFuturesLimitPrice(input.limitPrice);
    if (!parsed.ok) {
      return parsed;
    }
    limitPrice = parsed.price;
  }
  const entrySource = parseAutomationEntry(input.entrySource);
  const webhookId = String(input.webhookId ?? "").trim() || null;
  if (entrySource === "webhook" && !webhookId) {
    return { ok: false, error: "Pick a Signal webhook." };
  }
  const triggerBy = parseFuturesTrigger(input.triggerBy);
  if (!triggerBy.ok) {
    return triggerBy;
  }
  const compare =
    entrySource === "webhook"
      ? { ok: true as const, compare: "gte" as const }
      : parseFuturesTriggerCompare(input.triggerCompare);
  if (!compare.ok) {
    return compare;
  }
  const triggerPrice =
    entrySource === "webhook"
      ? { ok: true as const, price: 1 }
      : parseFuturesLimitPrice(input.triggerPrice);
  if (!triggerPrice.ok) {
    return { ok: false, error: "Enter a trigger price." };
  }
  const idRaw = String(input.id ?? "").trim();
  const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    idRaw,
  )
    ? idRaw
    : null;
  const lastFired = input.lastFiredAt
    ? new Date(String(input.lastFiredAt)).getTime()
    : Number.NaN;
  return {
    ok: true,
    rule: {
      id,
      name,
      sortOrder: input.sortOrder ?? 0,
      mode: parseAutomationMode(input.mode),
      symbol: symbol.symbol,
      action: actionParsed.action,
      closeSide: actionParsed.closeSide,
      orderType: orderType.orderType,
      sizeUnit: unit,
      size: size.size,
      limitPrice,
      entrySource,
      webhookId: entrySource === "webhook" ? webhookId : null,
      triggerBy: triggerBy.trigger,
      triggerCompare: compare.compare,
      triggerPrice: triggerPrice.price,
      skipIfOpen: parseSkipIfOpen(input.skipIfOpen),
      conditionTrue: Boolean(input.conditionTrue),
      lastFiredAtMs: Number.isFinite(lastFired) ? lastFired : null,
    },
  };
}

function parseStoredAction(
  action: unknown,
  closeSide: unknown,
):
  | { ok: true; action: FuturesAction; closeSide: FuturesSide | null }
  | { ok: false; error: string } {
  const parsed = parseFuturesAction(action);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.action === "flatten") {
    const side = parseFuturesSide(closeSide);
    if (!side) {
      return { ok: false, error: "Close needs a side." };
    }
    return { ok: true, action: "flatten", closeSide: side };
  }
  return { ok: true, action: parsed.action, closeSide: null };
}

function parseSkipIfOpen(raw: unknown): boolean {
  if (raw == null) {
    return false;
  }
  const value = String(raw).trim().toLowerCase();
  if (value === "" || value === "off" || value === "false" || value === "0") {
    return false;
  }
  return value === "on" || value === "true" || value === "1";
}

export function parseAutomationEntry(raw: unknown): FuturesAutomationEntry {
  return raw === "webhook" ? "webhook" : "price";
}

function emptyParsedRule(): FuturesAutomationRule {
  return {
    id: null,
    name: "Rule",
    sortOrder: 0,
    mode: "disabled",
    symbol: "BTCUSDT",
    action: "buy",
    closeSide: null,
    orderType: "market",
    sizeUnit: "qty",
    size: 1,
    limitPrice: null,
    entrySource: "price",
    webhookId: null,
    triggerBy: "last",
    triggerCompare: "gte",
    triggerPrice: 1,
    skipIfOpen: true,
    conditionTrue: false,
    lastFiredAtMs: null,
  };
}

export function parseFuturesAutomationRow(
  row: Record<string, unknown>,
): FuturesAutomationRule {
  const parsed = parseFuturesAutomationFields({
    id: row.id,
    name: row.name,
    mode: row.mode,
    symbol: row.symbol,
    action: row.action,
    closeSide: row.close_side,
    orderType: row.order_type,
    sizeUnit: row.size_unit,
    size: row.size,
    limitPrice: row.limit_price,
    entrySource: row.entry_source,
    webhookId: row.webhook_id,
    triggerBy: row.trigger_by,
    triggerCompare: row.trigger_compare,
    triggerPrice: row.trigger_price,
    skipIfOpen: row.skip_if_open,
    sortOrder: Number(row.sort_order) || 0,
    conditionTrue: row.condition_true,
    lastFiredAt: row.last_fired_at,
  });
  return parsed.ok ? parsed.rule : emptyParsedRule();
}

function formActionOf(
  action: FuturesAction,
  closeSide: FuturesSide | null,
): FuturesAutomationFormValues["formAction"] {
  if (action === "flatten") {
    return closeSide === "short" ? "close_short" : "close_long";
  }
  return action === "sell" ? "sell" : "buy";
}

export function futuresRuleToForm(
  rule: FuturesAutomationRule,
): FuturesAutomationFormValues {
  return {
    id: rule.id ?? "",
    key: rule.id ?? `new-${rule.sortOrder}`,
    name: rule.name,
    mode: rule.mode,
    symbol: rule.symbol,
    formAction: formActionOf(rule.action, rule.closeSide),
    orderType: rule.orderType,
    sizeUnit: rule.sizeUnit,
    size: rule.size == null ? "" : String(rule.size),
    limitPrice: rule.limitPrice == null ? "" : String(rule.limitPrice),
    entrySource: rule.entrySource,
    webhookId: rule.webhookId ?? "",
    triggerBy: rule.triggerBy,
    triggerCompare: rule.triggerCompare,
    triggerPrice: String(rule.triggerPrice),
    skipIfOpen: rule.skipIfOpen,
  };
}

export function futuresAutomationToRow(
  userId: string,
  accountId: string,
  rule: FuturesAutomationRule,
): Record<string, unknown> {
  return {
    ...(rule.id ? { id: rule.id } : {}),
    user_id: userId,
    account_id: accountId,
    name: rule.name,
    sort_order: rule.sortOrder,
    mode: rule.mode,
    symbol: rule.symbol,
    action: rule.action,
    close_side: rule.action === "flatten" ? rule.closeSide : null,
    order_type: rule.orderType,
    size_unit: rule.sizeUnit,
    size: rule.size,
    limit_price: rule.orderType === "limit" ? rule.limitPrice : null,
    entry_source: rule.entrySource,
    webhook_id: rule.entrySource === "webhook" ? rule.webhookId : null,
    trigger_by: rule.triggerBy,
    trigger_compare: rule.triggerCompare,
    trigger_price: rule.triggerPrice,
    skip_if_open: rule.skipIfOpen,
    condition_true: false,
    updated_at: new Date().toISOString(),
  };
}
