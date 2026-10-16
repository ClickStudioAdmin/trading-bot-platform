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
  type FuturesAction,
  type FuturesOrderType,
  type FuturesSide,
  type FuturesTrigger,
} from "./model";
import {
  parseFuturesTpslForm,
  parseFuturesTrigger,
  tpslFromRow,
  tpslHasLevels,
  type FuturesTpsl,
} from "./tpsl";
import {
  parseFuturesTrailingForm,
  trailingFromRow,
  trailingHasStop,
  type FuturesTrailing,
} from "./trailing";
import { parseDeskFuturesSymbol } from "@/lib/venues/hyperliquid/symbol";
import type { DcaFilterSpec } from "@/lib/dca/filters";
import {
  hardExitDraftFromStored,
  type HardExitDraft,
  type HardExitSignal,
} from "@/lib/dca/hard-exit";
import type { DcaIndicatorStart } from "@/lib/dca/playbook";
import {
  conditionColumns,
  conditionsFromRow,
  parseFuturesConditionForm,
  shortEntryFromJson,
  shortEntryToJson,
  writeFuturesConditionFormFields,
  type EntryStack,
  type FuturesAutomationEntry,
  type PerpsEntryLeg,
} from "./conditions";
import {
  emptyEntryStack,
  entryStackMatchesWebhook,
} from "@/lib/strategy/expr";
import {
  parsePerpsDirection,
  perpsDirectionFromAction,
  venueAllowsPerpsBoth,
  type PerpsDirection,
} from "./perps-direction";

export type { FuturesAutomationEntry };
export type FuturesTriggerCompare = "gte" | "lte";

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
  tpsl: FuturesTpsl | null;
  trailing: FuturesTrailing | null;
  indicator: DcaIndicatorStart | null;
  confirm: DcaFilterSpec | null;
  entryStack: EntryStack;
  exitIf: DcaFilterSpec | null;
  exitHard?: HardExitSignal | null;
  exitStack?: EntryStack | null;
  breakevenActivationPct: number | null;
  breakevenOffsetPct: number | null;
  direction: PerpsDirection;
  shortEntry: PerpsEntryLeg | null;
  conditionTrue: boolean;
  shortConditionTrue: boolean;
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
  tpsl: FuturesTpsl | null;
  trailing: FuturesTrailing | null;
  indicator: DcaIndicatorStart | null;
  confirm: DcaFilterSpec | null;
  entryStack: EntryStack;
  exitIf: DcaFilterSpec | null;
  exitHard?: HardExitSignal | null;
  exitStack?: EntryStack | null;
  exitDraft?: HardExitDraft | null;
  breakevenActivationPct: string;
  breakevenOffsetPct: string;
  direction?: PerpsDirection;
  shortEntry?: PerpsEntryLeg | null;
};

export function defaultFuturesAutomationForm(
  index: number,
  symbol = "BTCUSDT",
): FuturesAutomationFormValues {
  return {
    id: "",
    key: `new-${Date.now()}-${index}`,
    name: `Rule ${index + 1}`,
    mode: "disabled",
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
    tpsl: null,
    trailing: null,
    indicator: null,
    confirm: null,
    entryStack: emptyEntryStack(),
    exitIf: null,
    breakevenActivationPct: "",
    breakevenOffsetPct: "",
  };
}

const COPY_SUFFIX = " (copy)";

export function copyFuturesRuleName(name: string): string {
  const trimmed = name.trim() || "Rule";
  if (trimmed.endsWith(COPY_SUFFIX)) {
    return trimmed.slice(0, 40);
  }
  if (trimmed.length + COPY_SUFFIX.length <= 40) {
    return `${trimmed}${COPY_SUFFIX}`;
  }
  return `${trimmed.slice(0, 40 - COPY_SUFFIX.length).trimEnd()}${COPY_SUFFIX}`;
}

export function cloneFuturesAutomationForm(
  source: FuturesAutomationFormValues,
): FuturesAutomationFormValues {
  return {
    ...source,
    id: "",
    key: `clone-${source.key}-${Date.now()}`,
    name: copyFuturesRuleName(source.name),
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

export const FUTURES_RULE_IN_USE =
  "Cannot remove a rule that has an open position.";

export function blockedFuturesRuleDeletes(
  staleIds: string[],
  inUseIds: string[],
): string[] {
  const used = new Set(inUseIds.filter(Boolean));
  return staleIds.filter((id) => used.has(id));
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
  // One open row per contract and side, so a new entry on that side does not fire.
  if (
    (input.action === "buy" || input.action === "sell") &&
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
  venue = "bybit",
): { ok: true; rules: FuturesAutomationRule[] } | { ok: false; error: string } {
  const deskVenue = String(form.get("deskVenue") ?? venue).trim() || "bybit";
  const count = Number(String(form.get("ruleCount") ?? "0"));
  if (!Number.isInteger(count) || count < 0 || count > 50) {
    return { ok: false, error: "Too many rules." };
  }
  const rules: FuturesAutomationRule[] = [];
  for (let index = 0; index < count; index += 1) {
    const prefix = `r${index}_`;
    const parsed = parseFuturesAutomationFields({
      venue: deskVenue,
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
    const exits = parseAutomationExits(form, prefix);
    if (!exits.ok) {
      return exits;
    }
    parsed.rule.tpsl =
      parsed.rule.action === "flatten" ? null : exits.tpsl;
    parsed.rule.trailing =
      parsed.rule.action === "flatten" ? null : exits.trailing;
    const conditions = parseFuturesConditionForm(form, prefix, {
      entrySource: parsed.rule.entrySource,
      closing: parsed.rule.action === "flatten",
    });
    if (!conditions.ok) {
      return conditions;
    }
    parsed.rule.indicator = conditions.indicator;
    parsed.rule.confirm = conditions.confirm;
    parsed.rule.entryStack = conditions.entryStack;
    parsed.rule.exitIf = conditions.exitIf;
    parsed.rule.exitHard = conditions.exitHard;
    parsed.rule.exitStack = conditions.exitStack;
    parsed.rule.breakevenActivationPct = conditions.breakevenActivationPct;
    parsed.rule.breakevenOffsetPct = conditions.breakevenOffsetPct;
    const directed = applyPerpsDirection(form, prefix, deskVenue, parsed.rule);
    if (!directed.ok) {
      return directed;
    }
    rules.push(parsed.rule);
  }
  return { ok: true, rules };
}

const EXIT_FORM_KEYS = [
  "tpsl",
  "tpslMode",
  "takeProfit",
  "stopLoss",
  "tpKind",
  "slKind",
  "tpTrigger",
  "slTrigger",
  "tpQty",
  "slQty",
  "tpOrderType",
  "slOrderType",
  "tpLimitPrice",
  "slLimitPrice",
  "trailing",
  "trailingStop",
  "trailingActivation",
  "trailingActive",
] as const;

export function slicePrefixedForm(form: FormData, prefix: string): FormData {
  const next = new FormData();
  for (const key of EXIT_FORM_KEYS) {
    const value = form.get(`${prefix}${key}`);
    if (value != null && value !== "") {
      next.set(key, value);
    }
  }
  if (form.get(`${prefix}tpsl`) === "on") {
    next.set("tpsl", "on");
  }
  if (form.get(`${prefix}tpOn`) === "on") {
    next.set("tpOn", "on");
  }
  if (form.get(`${prefix}slOn`) === "on") {
    next.set("slOn", "on");
  }
  if (form.get(`${prefix}trailing`) === "on") {
    next.set("trailing", "on");
  }
  return next;
}

function parseAutomationExits(
  form: FormData,
  prefix: string,
):
  | { ok: true; tpsl: FuturesTpsl | null; trailing: FuturesTrailing | null }
  | { ok: false; error: string } {
  const sliced = slicePrefixedForm(form, prefix);
  const tpsl = parseFuturesTpslForm(sliced, undefined);
  if (!tpsl.ok) {
    return tpsl;
  }
  const trailing = parseFuturesTrailingForm(sliced, undefined);
  if (!trailing.ok) {
    return trailing;
  }
  return { ok: true, tpsl: tpsl.tpsl, trailing: trailing.trailing };
}

export function writeAutomationExitsToForm(
  form: FormData,
  prefix: string,
  tpsl: FuturesTpsl | null,
  trailing: FuturesTrailing | null,
): void {
  if (tpsl && tpslHasLevels(tpsl)) {
    form.set(`${prefix}tpsl`, "on");
    form.set(`${prefix}tpslMode`, tpsl.mode);
    if (tpsl.takeProfit != null) {
      form.set(`${prefix}takeProfit`, String(tpsl.takeProfit));
      form.set(`${prefix}tpKind`, tpsl.tpKind === "percent" ? "percent" : "price");
    }
    if (tpsl.stopLoss != null) {
      form.set(`${prefix}stopLoss`, String(tpsl.stopLoss));
      form.set(`${prefix}slKind`, tpsl.slKind === "percent" ? "percent" : "price");
    }
    form.set(`${prefix}tpTrigger`, tpsl.tpTrigger);
    form.set(`${prefix}slTrigger`, tpsl.slTrigger);
    if (tpsl.tpQty != null) {
      form.set(`${prefix}tpQty`, String(tpsl.tpQty));
    }
    if (tpsl.slQty != null) {
      form.set(`${prefix}slQty`, String(tpsl.slQty));
    }
    form.set(`${prefix}tpOrderType`, tpsl.tpOrderType);
    form.set(`${prefix}slOrderType`, tpsl.slOrderType);
    if (tpsl.tpLimitPrice != null) {
      form.set(`${prefix}tpLimitPrice`, String(tpsl.tpLimitPrice));
    }
    if (tpsl.slLimitPrice != null) {
      form.set(`${prefix}slLimitPrice`, String(tpsl.slLimitPrice));
    }
  }
  if (trailing && trailingHasStop(trailing)) {
    form.set(`${prefix}trailing`, "on");
    form.set(`${prefix}trailingStop`, String(trailing.distance));
    if (trailing.activePrice != null) {
      form.set(`${prefix}trailingActivation`, "on");
      form.set(`${prefix}trailingActive`, String(trailing.activePrice));
    }
  }
}

export function writePerpsShortEntryFields(
  form: FormData,
  prefix: string,
  leg: PerpsEntryLeg,
): void {
  form.set(`${prefix}entrySource`, leg.entrySource);
  if (leg.webhookId) {
    form.set(`${prefix}webhookId`, leg.webhookId);
  }
  form.set(`${prefix}triggerBy`, leg.triggerBy);
  form.set(`${prefix}triggerCompare`, leg.triggerCompare);
  form.set(`${prefix}triggerPrice`, String(leg.triggerPrice));
  if (leg.skipIfOpen) {
    form.set(`${prefix}skipIfOpen`, "on");
  }
  writeFuturesConditionFormFields(form, prefix, {
    indicator: leg.indicator,
    confirm: leg.confirm,
    entryStack: leg.entryStack,
    exitIf: leg.exitIf ?? null,
    exitHard: leg.exitHard ?? null,
    exitStack: leg.exitStack ?? null,
    breakevenActivationPct: null,
    breakevenOffsetPct: null,
  });
}

export function parseFuturesAutomationFields(input: {
  venue?: string;
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
  const symbol = parseDeskFuturesSymbol(input.venue ?? "bybit", input.symbol);
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
  if (typeof input.entrySource === "string" && input.entrySource.trim() === "") {
    return { ok: false, error: "Choose a trigger." };
  }
  let entrySource = parseAutomationEntry(input.entrySource);
  if (
    actionParsed.action === "flatten" &&
    (entrySource === "indicator" || entrySource === "trend")
  ) {
    entrySource = "price";
  }
  const webhookId = String(input.webhookId ?? "").trim() || null;
  if (entrySource === "webhook" && !webhookId) {
    return { ok: false, error: "Pick a Signal webhook." };
  }
  const triggerBy = parseFuturesTrigger(input.triggerBy);
  if (!triggerBy.ok) {
    return triggerBy;
  }
  const priceEntry = entrySource === "price";
  const compare = priceEntry
    ? parseFuturesTriggerCompare(input.triggerCompare)
    : { ok: true as const, compare: "gte" as const };
  if (!compare.ok) {
    return compare;
  }
  const triggerPrice = priceEntry
    ? parseFuturesLimitPrice(input.triggerPrice)
    : { ok: true as const, price: 1 };
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
      skipIfOpen: true,
      tpsl: null,
      trailing: null,
      indicator: null,
      confirm: null,
      entryStack: emptyEntryStack(),
      exitIf: null,
      breakevenActivationPct: null,
      breakevenOffsetPct: null,
      direction: perpsDirectionFromAction(
        actionParsed.action,
        actionParsed.closeSide,
      ),
      shortEntry: null,
      conditionTrue: Boolean(input.conditionTrue),
      shortConditionTrue: false,
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

function applyPerpsDirection(
  form: FormData,
  prefix: string,
  venue: string,
  rule: FuturesAutomationRule,
): { ok: true } | { ok: false; error: string } {
  const chosen = parsePerpsDirection(form.get(`${prefix}direction`));
  if (rule.action === "flatten") {
    rule.direction = perpsDirectionFromAction(rule.action, rule.closeSide);
    rule.shortEntry = null;
    return { ok: true };
  }
  if (chosen === "both") {
    if (!venueAllowsPerpsBoth(venue)) {
      return {
        ok: false,
        error: "This exchange is one-way. Choose Long or Short.",
      };
    }
    const shortPrefix = `${prefix}short_`;
    const shortEntryRaw = form.get(`${shortPrefix}entrySource`);
    if (typeof shortEntryRaw === "string" && shortEntryRaw.trim() === "") {
      return { ok: false, error: "Choose a trigger." };
    }
    const entrySource = parseAutomationEntry(shortEntryRaw);
    const webhookId = String(form.get(`${shortPrefix}webhookId`) ?? "").trim() || null;
    if (entrySource === "webhook" && !webhookId) {
      return { ok: false, error: "Pick a Signal webhook for the short entry." };
    }
    const triggerBy = parseFuturesTrigger(form.get(`${shortPrefix}triggerBy`));
    if (!triggerBy.ok) {
      return triggerBy;
    }
    const priceEntry = entrySource === "price";
    const compare = priceEntry
      ? parseFuturesTriggerCompare(form.get(`${shortPrefix}triggerCompare`))
      : { ok: true as const, compare: "lte" as const };
    if (!compare.ok) {
      return compare;
    }
    const triggerPrice = priceEntry
      ? parseFuturesLimitPrice(form.get(`${shortPrefix}triggerPrice`))
      : { ok: true as const, price: 1 };
    if (!triggerPrice.ok) {
      return { ok: false, error: "Enter a short trigger price." };
    }
    const conditions = parseFuturesConditionForm(form, shortPrefix, {
      entrySource,
      closing: false,
    });
    if (!conditions.ok) {
      return conditions;
    }
    rule.action = "buy";
    rule.closeSide = null;
    rule.direction = "both";
    const shortExit =
      conditions.exitIf ||
      conditions.exitHard ||
      conditions.exitStack.leaves.length > 0;
    rule.shortEntry = {
      entrySource,
      webhookId: entrySource === "webhook" ? webhookId : null,
      triggerBy: triggerBy.trigger,
      triggerCompare: compare.compare,
      triggerPrice: triggerPrice.price,
      skipIfOpen: true,
      indicator: conditions.indicator,
      confirm: conditions.confirm,
      entryStack: conditions.entryStack,
      ...(shortExit
        ? {
            exitIf: conditions.exitIf,
            exitHard: conditions.exitHard,
            exitStack: conditions.exitStack,
          }
        : {}),
    };
    return { ok: true };
  }
  if (chosen === "long") {
    rule.action = "buy";
    rule.closeSide = null;
  } else if (chosen === "short") {
    rule.action = "sell";
    rule.closeSide = null;
  }
  rule.direction = perpsDirectionFromAction(rule.action, rule.closeSide);
  rule.shortEntry = null;
  return { ok: true };
}

export function parseAutomationEntry(raw: unknown): FuturesAutomationEntry {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "webhook" || value === "indicator" || value === "trend") {
    return value;
  }
  return "price";
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
    tpsl: null,
    trailing: null,
    indicator: null,
    confirm: null,
    entryStack: emptyEntryStack(),
    exitIf: null,
    breakevenActivationPct: null,
    breakevenOffsetPct: null,
    direction: "long",
    shortEntry: null,
    conditionTrue: false,
    shortConditionTrue: false,
    lastFiredAtMs: null,
  };
}

export function parseFuturesAutomationRow(
  row: Record<string, unknown>,
  venue?: string,
): FuturesAutomationRule {
  const fields = {
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
  };
  const preferred = parseFuturesAutomationFields({
    ...fields,
    venue: venue ?? "bybit",
  });
  if (preferred.ok) {
    const tpBy = parseFuturesTrigger(row.tp_trigger);
    const slBy = parseFuturesTrigger(row.sl_trigger);
    preferred.rule.tpsl = tpslFromRow({
      takeProfit: Number(row.take_profit) > 0 ? Number(row.take_profit) : null,
      stopLoss: Number(row.stop_loss) > 0 ? Number(row.stop_loss) : null,
      tpKind: row.tp_kind === "percent" ? "percent" : "price",
      slKind: row.sl_kind === "percent" ? "percent" : "price",
      tpTrigger: tpBy.ok ? tpBy.trigger : "last",
      slTrigger: slBy.ok ? slBy.trigger : "last",
      tpslMode: row.tpsl_mode === "partial" ? "partial" : "full",
      tpQty: Number(row.tp_qty) > 0 ? Number(row.tp_qty) : null,
      slQty: Number(row.sl_qty) > 0 ? Number(row.sl_qty) : null,
      tpOrderType: row.tp_order_type === "limit" ? "limit" : "market",
      slOrderType: row.sl_order_type === "limit" ? "limit" : "market",
      tpLimitPrice:
        Number(row.tp_limit_price) > 0 ? Number(row.tp_limit_price) : null,
      slLimitPrice:
        Number(row.sl_limit_price) > 0 ? Number(row.sl_limit_price) : null,
    });
    preferred.rule.trailing = trailingFromRow({
      trailingStop:
        Number(row.trailing_stop) > 0 ? Number(row.trailing_stop) : null,
      trailingActive:
        Number(row.trailing_active) > 0 ? Number(row.trailing_active) : null,
      trailingPeak: null,
    });
    attachRuleConditions(preferred.rule, row);
    attachPerpsDirection(preferred.rule, row);
    return preferred.rule;
  }
  if (venue) {
    return emptyParsedRule();
  }
  const hyperliquid = parseFuturesAutomationFields({
    ...fields,
    venue: "hyperliquid",
  });
  if (!hyperliquid.ok) {
    return emptyParsedRule();
  }
  attachRuleConditions(hyperliquid.rule, row);
  attachPerpsDirection(hyperliquid.rule, row);
  return hyperliquid.rule;
}

function attachPerpsDirection(
  rule: FuturesAutomationRule,
  row: Record<string, unknown>,
): void {
  rule.shortConditionTrue = Boolean(row.short_condition_true);
  if (rule.action === "flatten") {
    rule.direction = perpsDirectionFromAction(rule.action, rule.closeSide);
    rule.shortEntry = null;
    return;
  }
  const stored = parsePerpsDirection(row.direction);
  if (stored === "both") {
    rule.action = "buy";
    rule.closeSide = null;
    rule.direction = "both";
    rule.shortEntry = shortEntryFromJson(row.short_entry);
    return;
  }
  if (stored === "long" || stored === "short") {
    rule.direction = stored;
    rule.action = stored === "short" ? "sell" : "buy";
    rule.closeSide = null;
  } else {
    rule.direction = perpsDirectionFromAction(rule.action, rule.closeSide);
  }
  rule.shortEntry = null;
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
    tpsl: rule.tpsl,
    trailing: rule.trailing,
    indicator: rule.indicator,
    confirm: rule.confirm,
    entryStack: rule.entryStack ?? emptyEntryStack(),
    exitIf: rule.exitIf,
    exitHard: rule.exitHard ?? null,
    exitStack: rule.exitStack ?? emptyEntryStack(),
    exitDraft: hardExitDraftFromStored(rule.exitIf, rule.exitHard),
    breakevenActivationPct:
      rule.breakevenActivationPct == null
        ? ""
        : String(rule.breakevenActivationPct),
    breakevenOffsetPct:
      rule.breakevenOffsetPct == null ? "" : String(rule.breakevenOffsetPct),
    direction: rule.direction,
    shortEntry: rule.direction === "both" ? rule.shortEntry : null,
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
    take_profit: rule.tpsl?.takeProfit ?? null,
    stop_loss: rule.tpsl?.stopLoss ?? null,
    tp_kind:
      rule.tpsl?.takeProfit != null
        ? rule.tpsl.tpKind === "percent"
          ? "percent"
          : "price"
        : null,
    sl_kind:
      rule.tpsl?.stopLoss != null
        ? rule.tpsl.slKind === "percent"
          ? "percent"
          : "price"
        : null,
    tp_trigger: rule.tpsl?.tpTrigger ?? null,
    sl_trigger: rule.tpsl?.slTrigger ?? null,
    tpsl_mode: rule.tpsl?.mode ?? null,
    tp_qty: rule.tpsl?.tpQty ?? null,
    sl_qty: rule.tpsl?.slQty ?? null,
    tp_order_type: rule.tpsl?.tpOrderType ?? null,
    sl_order_type: rule.tpsl?.slOrderType ?? null,
    tp_limit_price: rule.tpsl?.tpLimitPrice ?? null,
    sl_limit_price: rule.tpsl?.slLimitPrice ?? null,
    trailing_stop: rule.trailing?.distance ?? null,
    trailing_active: rule.trailing?.activePrice ?? null,
    ...conditionColumns(rule),
    direction: rule.direction,
    short_entry:
      rule.direction === "both" && rule.shortEntry
        ? shortEntryToJson(rule.shortEntry)
        : null,
    condition_true: false,
    short_condition_true: false,
    updated_at: new Date().toISOString(),
  };
}

function attachRuleConditions(
  rule: FuturesAutomationRule,
  row: Record<string, unknown>,
): void {
  if (rule.action === "flatten") {
    return;
  }
  const conditions = conditionsFromRow(row);
  if (rule.entrySource === "indicator" || rule.entrySource === "trend") {
    rule.indicator = conditions.indicator;
  }
  rule.confirm = conditions.confirm;
  rule.entryStack = conditions.entryStack;
  rule.exitIf = conditions.exitIf;
  rule.exitHard = conditions.exitHard;
  rule.exitStack = conditions.exitStack;
  rule.breakevenActivationPct = conditions.breakevenActivationPct;
  rule.breakevenOffsetPct = conditions.breakevenOffsetPct;
}

export type PerpsAutomationLeg = {
  side: FuturesSide;
  rule: FuturesAutomationRule;
  latch: "condition_true" | "short_condition_true";
};

/** One leg for Long or Short. Both returns the long leg, then the short leg. */
export function perpsAutomationLegs(
  rule: FuturesAutomationRule,
): PerpsAutomationLeg[] {
  if (rule.action === "flatten" || rule.direction !== "both") {
    const side: FuturesSide =
      rule.action === "flatten"
        ? (rule.closeSide ?? "long")
        : rule.action === "sell"
          ? "short"
          : "long";
    return [{ side, rule, latch: "condition_true" }];
  }
  const longRule: FuturesAutomationRule = {
    ...rule,
    action: "buy",
    closeSide: null,
    direction: "long",
    shortEntry: null,
  };
  const short = rule.shortEntry;
  if (!short) {
    return [{ side: "long", rule: longRule, latch: "condition_true" }];
  }
  const shortRule: FuturesAutomationRule = {
    ...rule,
    action: "sell",
    closeSide: null,
    direction: "short",
    shortEntry: null,
    entrySource: short.entrySource,
    webhookId: short.webhookId,
    triggerBy: short.triggerBy,
    triggerCompare: short.triggerCompare,
    triggerPrice: short.triggerPrice,
    skipIfOpen: short.skipIfOpen,
    indicator: short.indicator,
    confirm: short.confirm,
    entryStack: short.entryStack,
    conditionTrue: rule.shortConditionTrue,
    ...(short.exitIf ||
    short.exitHard ||
    (short.exitStack && short.exitStack.leaves.length > 0)
      ? {
          exitIf: short.exitIf ?? null,
          exitHard: short.exitHard ?? null,
          exitStack: short.exitStack ?? emptyEntryStack(),
        }
      : {}),
  };
  return [
    { side: "long", rule: longRule, latch: "condition_true" },
    { side: "short", rule: shortRule, latch: "short_condition_true" },
  ];
}

export function perpsRuleMatchesWebhook(
  rule: FuturesAutomationRule,
  firedId: string,
): boolean {
  if (
    rule.exitHard?.trigger === "webhook" &&
    rule.exitHard.webhookId === firedId
  ) {
    return true;
  }
  if (
    (rule.exitStack?.leaves ?? []).some(
      (leaf) => leaf.kind === "webhook" && leaf.webhookId === firedId,
    )
  ) {
    return true;
  }
  const short = rule.shortEntry;
  if (
    short?.exitHard?.trigger === "webhook" &&
    short.exitHard.webhookId === firedId
  ) {
    return true;
  }
  if (
    (short?.exitStack?.leaves ?? []).some(
      (leaf) => leaf.kind === "webhook" && leaf.webhookId === firedId,
    )
  ) {
    return true;
  }
  return perpsAutomationLegs(rule).some((leg) =>
    entryStackMatchesWebhook(
      leg.rule.entrySource,
      leg.rule.webhookId,
      leg.rule.entryStack,
      firedId,
    ),
  );
}
