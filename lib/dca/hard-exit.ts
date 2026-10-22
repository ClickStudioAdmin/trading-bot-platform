import {
  dcaFilterComplete,
  dcaFilterSpecForKind,
  parseDcaFilterForm,
  parseDcaFilterKind,
  writeDcaFilterFormFields,
  dcaFilterMet,
  type DcaFilterSpec,
} from "./filters";
import type { FuturesSide, FuturesTrigger } from "@/lib/futures/model";
import { webhookActionMatches } from "@/lib/strategy/expr";
import type { SupertrendBar } from "./indicators";

export const HARD_EXIT_TRIGGERS = [
  "price",
  "indicator",
  "trend",
  "webhook",
  "retrace",
] as const;
export type HardExitTrigger = (typeof HARD_EXIT_TRIGGERS)[number];

/** Price rule inside an exit action. The numbers stay on the action, not the leaf. */
export const EXIT_PRICE_RULES = ["target", "stop", "trail", "profit"] as const;
export type ExitPriceRuleTrigger = (typeof EXIT_PRICE_RULES)[number];

export function isExitPriceRule(
  trigger: string,
): trigger is ExitPriceRuleTrigger {
  return (
    trigger === "target" ||
    trigger === "stop" ||
    trigger === "trail" ||
    trigger === "profit"
  );
}

export function exitPriceRuleLabel(trigger: ExitPriceRuleTrigger): string {
  if (trigger === "target") {
    return "Target Hit";
  }
  if (trigger === "stop") {
    return "Stop Hit";
  }
  if (trigger === "profit") {
    return "Profit Hit";
  }
  return "Trail";
}

export type HardExitPrice = {
  trigger: "price";
  triggerBy: FuturesTrigger;
  compare: "gte" | "lte";
  price: number;
};

export type HardExitWebhook = {
  trigger: "webhook";
  webhookId: string;
};

/** Price cross or signal webhook. Indicator and trend stay on exit_if_*. */
export type HardExitSignal = HardExitPrice | HardExitWebhook;

/** Template copy. A webhook trigger stores no id. */
export type TemplateHardExitSignal =
  | HardExitPrice
  | { trigger: "webhook" };

export type HardExitDraft =
  | { trigger: "unset" }
  | { trigger: "indicator"; spec: DcaFilterSpec | null }
  | { trigger: "trend"; spec: DcaFilterSpec }
  | {
      trigger: "price";
      triggerBy: FuturesTrigger;
      compare: "gte" | "lte";
      price: string;
    }
  | { trigger: "webhook"; webhookId: string }
  | {
      trigger: "retrace";
      source: "last" | "mark" | "index";
      from: "high" | "low";
      pct: string;
      lookback: string;
      timeframe: import("@/lib/dca/indicators").DcaIndicatorTimeframe;
    }
  | { trigger: "target" }
  | { trigger: "stop" }
  | { trigger: "trail" }
  | { trigger: "profit" };

export function isPriceRuleDraft(
  draft: HardExitDraft,
): draft is Extract<HardExitDraft, { trigger: ExitPriceRuleTrigger }> {
  return (
    draft.trigger === "target" ||
    draft.trigger === "stop" ||
    draft.trigger === "trail" ||
    draft.trigger === "profit"
  );
}

export function hardExitFromFilter(
  spec: DcaFilterSpec | null | undefined,
): HardExitDraft | null {
  if (!spec) {
    return null;
  }
  return {
    trigger: spec.kind === "supertrend" ? "trend" : "indicator",
    spec,
  };
}

export function defaultHardExit(_side: FuturesSide): HardExitDraft {
  return { trigger: "unset" };
}

export function hardExitForTrigger(
  trigger: HardExitTrigger,
  side: FuturesSide,
  current: HardExitDraft | null,
): HardExitDraft {
  const timeframe =
    current &&
    (current.trigger === "indicator" || current.trigger === "trend") &&
    current.spec
      ? current.spec.timeframe
      : "240";
  if (trigger === "price") {
    return { trigger: "price", triggerBy: "last", compare: "gte", price: "" };
  }
  if (trigger === "webhook") {
    return { trigger: "webhook", webhookId: "" };
  }
  if (trigger === "retrace") {
    return {
      trigger: "retrace",
      source: "last",
      from: side === "short" ? "low" : "high",
      pct: "",
      lookback: "20",
      timeframe: "15",
    };
  }
  if (trigger === "trend") {
    return {
      trigger: "trend",
      spec: { ...dcaFilterSpecForKind("supertrend", side), timeframe },
    };
  }
  if (
    current?.trigger === "indicator" &&
    current.spec &&
    current.spec.kind !== "supertrend"
  ) {
    return {
      trigger: "indicator",
      spec: { ...current.spec, timeframe },
    };
  }
  return { trigger: "indicator", spec: null };
}

export function hardExitComplete(
  draft: HardExitDraft | null | undefined,
): boolean {
  if (!draft || draft.trigger === "unset") {
    return false;
  }
  if (isPriceRuleDraft(draft)) {
    return true;
  }
  if (draft.trigger === "price") {
    return hardExitPrice(draft.price) != null;
  }
  if (draft.trigger === "webhook") {
    return draft.webhookId.trim() !== "";
  }
  if (draft.trigger === "retrace") {
    const pct = Number(draft.pct.replace(/,/g, "").trim());
    const lookback = Math.trunc(Number(draft.lookback));
    return pct > 0 && lookback >= 1 && lookback <= 400;
  }
  return draft.spec != null && dcaFilterComplete(draft.spec);
}

export function hardExitDraftFromStored(
  filter: DcaFilterSpec | null | undefined,
  signal: HardExitSignal | null | undefined,
): HardExitDraft | null {
  if (signal?.trigger === "price") {
    return {
      trigger: "price",
      triggerBy: signal.triggerBy,
      compare: signal.compare,
      price: String(signal.price),
    };
  }
  if (signal?.trigger === "webhook") {
    return { trigger: "webhook", webhookId: signal.webhookId };
  }
  return hardExitFromFilter(filter);
}

export function hardExitDraftFromTemplate(
  filter: DcaFilterSpec | null | undefined,
  stored: unknown,
): HardExitDraft | null {
  if (isWebhookTemplate(stored)) {
    return {
      trigger: "webhook",
      webhookId: String(
        (stored as { webhookId?: unknown }).webhookId ?? "",
      ).trim(),
    };
  }
  const signal = hardExitSignalFromJson(stored);
  if (signal) {
    return hardExitDraftFromStored(null, signal);
  }
  return hardExitFromFilter(filter);
}

export function hardExitParts(draft: HardExitDraft | null | undefined): {
  filter: DcaFilterSpec | null;
  signal: HardExitSignal | null;
} {
  if (!draft || draft.trigger === "unset" || isPriceRuleDraft(draft)) {
    return { filter: null, signal: null };
  }
  if (draft.trigger === "price") {
    const price = hardExitPrice(draft.price);
    if (price == null) {
      return { filter: null, signal: null };
    }
    return {
      filter: null,
      signal: {
        trigger: "price",
        triggerBy: draft.triggerBy,
        compare: draft.compare,
        price,
      },
    };
  }
  if (draft.trigger === "webhook") {
    const webhookId = draft.webhookId.trim();
    return webhookId
      ? { filter: null, signal: { trigger: "webhook", webhookId } }
      : { filter: null, signal: null };
  }
  if (draft.trigger === "retrace") {
    return { filter: null, signal: null };
  }
  return { filter: draft.spec, signal: null };
}

export function templateHardExit(
  signal: HardExitSignal | null | undefined,
): TemplateHardExitSignal | null {
  if (!signal) {
    return null;
  }
  if (signal.trigger === "webhook") {
    return { trigger: "webhook" };
  }
  return signal;
}

export function hardExitWebhookId(
  signal: HardExitSignal | TemplateHardExitSignal | null | undefined,
): string | null {
  if (!signal || signal.trigger !== "webhook") {
    return null;
  }
  const id = "webhookId" in signal ? signal.webhookId?.trim() ?? "" : "";
  return id || null;
}

export function hardExitForSide(
  playbook: {
    exitIf?: DcaFilterSpec | null;
    shortExitIf?: DcaFilterSpec | null;
    exitHard?: HardExitSignal | null;
    shortExitHard?: HardExitSignal | null;
  },
  side: FuturesSide,
): { filter: DcaFilterSpec | null; signal: HardExitSignal | null } {
  if (
    side === "short" &&
    (playbook.shortExitIf || playbook.shortExitHard)
  ) {
    return {
      filter: playbook.shortExitHard ? null : (playbook.shortExitIf ?? null),
      signal: playbook.shortExitHard ?? null,
    };
  }
  return {
    filter: playbook.exitHard ? null : (playbook.exitIf ?? null),
    signal: playbook.exitHard ?? null,
  };
}

export function parseHardExitForm(
  form: FormData,
  prefix: string,
  label = "Hard Exit",
):
  | { ok: true; filter: DcaFilterSpec | null; signal: HardExitSignal | null }
  | { ok: false; error: string } {
  const triggerRaw = String(form.get(`${prefix}Trigger`) ?? "").trim();
  const kindRaw = String(form.get(`${prefix}Kind`) ?? "").trim();
  if (!triggerRaw && !kindRaw) {
    return { ok: true, filter: null, signal: null };
  }
  if (triggerRaw === "price") {
    const price = hardExitPrice(form.get(`${prefix}TriggerPrice`));
    if (price == null) {
      return { ok: false, error: `Enter a ${label} price.` };
    }
    return {
      ok: true,
      filter: null,
      signal: {
        trigger: "price",
        triggerBy: parseTriggerBy(form.get(`${prefix}TriggerBy`)),
        compare: parseSitCompare(form.get(`${prefix}TriggerCompare`)),
        price,
      },
    };
  }
  if (triggerRaw === "webhook") {
    const webhookId = String(form.get(`${prefix}WebhookId`) ?? "").trim();
    if (!webhookId) {
      return { ok: false, error: `Choose a ${label} signal webhook.` };
    }
    return {
      ok: true,
      filter: null,
      signal: { trigger: "webhook", webhookId },
    };
  }
  if (
    triggerRaw &&
    triggerRaw !== "indicator" &&
    triggerRaw !== "trend"
  ) {
    return { ok: false, error: `Choose a ${label} trigger.` };
  }
  const kind = triggerRaw === "trend" ? "supertrend" : parseDcaFilterKind(kindRaw);
  const postedKind = triggerRaw === "indicator" && kind === "supertrend" ? "ema" : kind;
  if (triggerRaw === "indicator" && !postedKind) {
    return { ok: false, error: `Enter a valid ${label} filter.` };
  }
  if (postedKind && postedKind !== kindRaw) {
    form.set(`${prefix}Kind`, postedKind);
  }
  const parsed = parseDcaFilterForm(form, prefix, true, label);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, filter: parsed.spec, signal: null };
}

export function writeHardExitFormFields(
  form: FormData,
  prefix: string,
  draft: HardExitDraft | null | undefined,
): void {
  form.delete(`${prefix}Trigger`);
  form.delete(`${prefix}TriggerBy`);
  form.delete(`${prefix}TriggerCompare`);
  form.delete(`${prefix}TriggerPrice`);
  form.delete(`${prefix}WebhookId`);
  if (!draft || isPriceRuleDraft(draft)) {
    writeDcaFilterFormFields(form, prefix, null);
    return;
  }
  form.set(`${prefix}Trigger`, draft.trigger);
  if (draft.trigger === "unset") {
    writeDcaFilterFormFields(form, prefix, null);
    return;
  }
  if (draft.trigger === "price") {
    writeDcaFilterFormFields(form, prefix, null);
    form.set(`${prefix}TriggerBy`, draft.triggerBy);
    form.set(`${prefix}TriggerCompare`, draft.compare);
    form.set(`${prefix}TriggerPrice`, draft.price);
    return;
  }
  if (draft.trigger === "webhook") {
    writeDcaFilterFormFields(form, prefix, null);
    if (draft.webhookId.trim()) {
      form.set(`${prefix}WebhookId`, draft.webhookId.trim());
    }
    return;
  }
  if (draft.trigger === "retrace") {
    writeDcaFilterFormFields(form, prefix, null);
    form.set(`${prefix}RetraceSource`, draft.source);
    form.set(`${prefix}RetraceFrom`, draft.from);
    form.set(`${prefix}RetracePct`, draft.pct);
    form.set(`${prefix}RetraceLookback`, draft.lookback);
    form.set(`${prefix}RetraceTimeframe`, draft.timeframe);
    return;
  }
  writeDcaFilterFormFields(form, prefix, draft.spec);
}

export function writeTemplateHardExitFields(
  form: FormData,
  prefix: string,
  filter: DcaFilterSpec | null | undefined,
  stored: unknown,
  webhookId: string,
  notes: string[],
  label: string,
): void {
  if (isWebhookTemplate(stored)) {
    if (!webhookId) {
      notes.push(
        `${label} signal needs a webhook on this desk. Hard Exit was left off.`,
      );
      writeHardExitFormFields(form, prefix, null);
      return;
    }
    writeHardExitFormFields(form, prefix, {
      trigger: "webhook",
      webhookId,
    });
    return;
  }
  const signal = hardExitSignalFromJson(stored);
  if (signal?.trigger === "price") {
    writeHardExitFormFields(form, prefix, {
      trigger: "price",
      triggerBy: signal.triggerBy,
      compare: signal.compare,
      price: String(signal.price),
    });
    return;
  }
  const spec = filter ?? null;
  writeHardExitFormFields(
    form,
    prefix,
    spec ? hardExitFromFilter(spec) : null,
  );
}

export function hardExitSignalToJson(
  signal: HardExitSignal | null | undefined,
): HardExitSignal | null {
  return signal ?? null;
}

export function hardExitSignalFromJson(value: unknown): HardExitSignal | null {
  const row = jsonRow(value);
  if (!row) {
    return null;
  }
  if (row.trigger === "webhook") {
    const webhookId = String(row.webhookId ?? "").trim();
    return webhookId ? { trigger: "webhook", webhookId } : null;
  }
  if (row.trigger !== "price") {
    return null;
  }
  const price = hardExitPrice(row.price);
  if (price == null) {
    return null;
  }
  return {
    trigger: "price",
    triggerBy: parseTriggerBy(row.triggerBy),
    compare: parseSitCompare(row.compare),
    price,
  };
}

export function templateHardExitNeedsWebhook(value: unknown): boolean {
  return isWebhookTemplate(value);
}

export function hardExitMet(input: {
  filter?: DcaFilterSpec | null;
  signal?: HardExitSignal | null;
  side: FuturesSide;
  closes?: number[] | null;
  bars?: SupertrendBar[] | null;
  prices?: {
    last: number | null;
    mark: number | null;
    index: number | null;
  } | null;
  firedWebhookId?: string | null;
  /** Buy is long, sell is short. Undefined keeps an id match. Null does not close. */
  signalSide?: FuturesSide | null;
}): boolean {
  const signal = input.signal;
  if (signal?.trigger === "price") {
    const price = input.prices?.[signal.triggerBy] ?? null;
    if (price == null || !Number.isFinite(price)) {
      return false;
    }
    return signal.compare === "gte" ? price >= signal.price : price <= signal.price;
  }
  if (signal?.trigger === "webhook") {
    return (
      Boolean(input.firedWebhookId) &&
      input.firedWebhookId === signal.webhookId &&
      webhookActionMatches({
        role: "exit",
        side: input.side,
        signalSide: input.signalSide,
      })
    );
  }
  if (!input.filter) {
    return false;
  }
  return dcaFilterMet({
    spec: input.filter,
    side: input.side,
    closes: input.closes,
    bars: input.bars,
  });
}

function hardExitPrice(value: unknown): number | null {
  if (value == null || String(value).trim() === "") {
    return null;
  }
  const price = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(price) && price > 0 ? price : null;
}

function parseTriggerBy(value: unknown): FuturesTrigger {
  const raw = String(value ?? "").trim();
  return raw === "mark" || raw === "index" ? raw : "last";
}

function parseSitCompare(value: unknown): "gte" | "lte" {
  return String(value ?? "").trim() === "lte" ? "lte" : "gte";
}

function jsonRow(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return jsonRow(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function isWebhookTemplate(value: unknown): boolean {
  const row = jsonRow(value);
  return row?.trigger === "webhook";
}
