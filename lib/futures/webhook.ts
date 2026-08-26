import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  parseFuturesAction,
  parseFuturesLimitPrice,
  parseFuturesOrderType,
  parseFuturesSide,
  parseFuturesSizeUnit,
  parseFuturesSymbol,
  type FuturesAction,
  type FuturesOrderType,
  type FuturesSide,
} from "./model";
import { FUTURES_IDEMPOTENCY_MAX } from "./command";

export const WEBHOOK_TOKEN_HEX = 64;
export const WEBHOOK_RULE_NAME = "TradingView";
export const WEBHOOK_NAME_MAX = 40;
export const WEBHOOK_MAX_PER_BOOK = 8;
export type WebhookKind = "order" | "signal";

export type WebhookArmVerb = "arm" | "disarm" | "close-playbook";

export type ParsedWebhookOrder = {
  kind: "order";
  action: FuturesAction;
  closeSide: FuturesSide | null;
  symbol: string;
  orderType: FuturesOrderType;
  sizeUnit: "qty" | "usdt";
  size: string;
  limitPrice: string | null;
  idempotencyKey: string | null;
};

export type ParsedWebhookArm = {
  kind: "arm";
  verb: WebhookArmVerb;
};

export type ParsedWebhook =
  | ParsedWebhookOrder
  | ParsedWebhookArm;

export function generateWebhookToken(): string {
  return randomBytes(WEBHOOK_TOKEN_HEX / 2).toString("hex");
}

export function hashWebhookToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isWebhookTokenShape(token: string): boolean {
  return (
    token.length === WEBHOOK_TOKEN_HEX && /^[0-9a-f]+$/.test(token)
  );
}

export function webhookTokensMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function futuresWebhookOrigin(headerStore: Headers): string {
  const fromEnv = process.env.APP_BASE_URL?.trim().replace(/\/$/, "") ?? "";
  if (fromEnv) {
    return fromEnv;
  }
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (!host) {
    return "";
  }
  const proto = headerStore.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export function futuresWebhookPath(token: string): string {
  return `/api/futures/webhook/${token}`;
}

export function parseWebhookName(
  raw: unknown,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(raw ?? "").trim();
  if (name.length < 1 || name.length > WEBHOOK_NAME_MAX) {
    return {
      ok: false,
      error: `Name must be 1 to ${WEBHOOK_NAME_MAX} characters.`,
    };
  }
  return { ok: true, name };
}

export function parseWebhookKind(
  raw: unknown,
): { ok: true; kind: WebhookKind } | { ok: false; error: string } {
  const kind = String(raw ?? "order").trim().toLowerCase();
  if (kind === "order" || kind === "signal") {
    return { ok: true, kind };
  }
  return { ok: false, error: "Choose Order or Signal." };
}

export function looksLikeVenueWebhookPayload(body: unknown): boolean {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }
  const row = body as Record<string, unknown>;
  if ("retCode" in row || "retMsg" in row) {
    return true;
  }
  const hasAction =
    row.action != null || row.verb != null || row.command != null;
  return "result" in row && !hasAction;
}

export function parseWebhookJson(
  raw: unknown,
): { ok: true; body: unknown } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: true, body: raw };
  }
  const text = raw.trim();
  if (text === "") {
    return { ok: false, error: "Send a JSON body." };
  }
  try {
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: "Send a JSON body." };
  }
}

export function parseFuturesWebhook(
  body: unknown,
): { ok: true; parsed: ParsedWebhook } | { ok: false; error: string } {
  if (looksLikeVenueWebhookPayload(body)) {
    return { ok: false, error: "Rejecting a venue payload. Send desk JSON." };
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Send a JSON object." };
  }
  const row = body as Record<string, unknown>;
  const verb = parseWebhookVerb(row.action ?? row.verb ?? row.command);
  if (!verb.ok) {
    return verb;
  }
  if (verb.kind === "arm") {
    return { ok: true, parsed: { kind: "arm", verb: verb.verb } };
  }

  const symbol = parseFuturesSymbol(row.symbol ?? row.ticker);
  if (!symbol.ok) {
    return symbol;
  }
  const orderType = parseFuturesOrderType(row.orderType ?? row.order_type);
  if (!orderType.ok) {
    return orderType;
  }
  const sizeUnit = parseFuturesSizeUnit(row.sizeUnit ?? row.size_unit);
  if (!sizeUnit.ok) {
    return sizeUnit;
  }
  const closeSide = parseWebhookCloseSide(verb.action, row);
  const sizeRaw = row.size ?? row.qty ?? "";
  const needsSize = verb.action !== "flatten";
  if (needsSize && String(sizeRaw).trim() === "") {
    return { ok: false, error: "Enter a size." };
  }
  let limitPrice: string | null = null;
  if (orderType.orderType === "limit") {
    const parsedLimit = parseFuturesLimitPrice(
      row.limitPrice ?? row.limit_price,
    );
    if (!parsedLimit.ok) {
      return parsedLimit;
    }
    limitPrice = String(parsedLimit.price);
  }

  return {
    ok: true,
    parsed: {
      kind: "order",
      action: verb.action,
      closeSide,
      symbol: symbol.symbol,
      orderType: orderType.orderType,
      sizeUnit: sizeUnit.unit,
      size: String(sizeRaw).trim(),
      limitPrice,
      idempotencyKey: parseWebhookIdempotencyKey(
        row.id ?? row.idempotencyKey ?? row.idempotency_key,
      ),
    },
  };
}

function parseWebhookVerb(
  raw: unknown,
):
  | { ok: true; kind: "arm"; verb: WebhookArmVerb }
  | { ok: true; kind: "order"; action: FuturesAction }
  | { ok: false; error: string } {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  if (value === "arm") {
    return { ok: true, kind: "arm", verb: "arm" };
  }
  if (value === "disarm") {
    return { ok: true, kind: "arm", verb: "disarm" };
  }
  if (value === "close-playbook") {
    return { ok: true, kind: "arm", verb: "close-playbook" };
  }
  if (value === "close-long") {
    return { ok: true, kind: "order", action: "flatten" };
  }
  if (value === "close-short") {
    return { ok: true, kind: "order", action: "flatten" };
  }
  const action = parseFuturesAction(value);
  if (!action.ok) {
    return {
      ok: false,
      error: "Use buy, sell, close, arm, disarm, or close-playbook.",
    };
  }
  return { ok: true, kind: "order", action: action.action };
}

function parseWebhookCloseSide(
  action: FuturesAction,
  row: Record<string, unknown>,
): FuturesSide | null {
  if (action !== "flatten") {
    return null;
  }
  const raw = String(row.action ?? row.verb ?? row.command ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  if (raw === "close-long") {
    return "long";
  }
  if (raw === "close-short") {
    return "short";
  }
  return parseFuturesSide(row.side ?? row.closeSide ?? row.close_side);
}

function parseWebhookIdempotencyKey(raw: unknown): string | null {
  if (raw == null) {
    return null;
  }
  const key = String(raw).trim();
  if (key === "") {
    return null;
  }
  if (key.length <= FUTURES_IDEMPOTENCY_MAX) {
    return key;
  }
  return createHash("sha256").update(key, "utf8").digest("hex").slice(0, 32);
}
