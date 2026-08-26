import type { FuturesTradeSource } from "./model";

const LEGACY_WEBHOOK_NAME = "TradingView";

export function isFuturesWebhookOrigin(
  source: FuturesTradeSource,
  ruleName?: string | null,
  webhookNames?: readonly string[],
): boolean {
  if (source === "webhook") {
    return true;
  }
  if (source !== "engine" || webhookNames === undefined) {
    return false;
  }
  const name = String(ruleName ?? "").trim();
  if (!name) {
    return false;
  }
  if (name === LEGACY_WEBHOOK_NAME) {
    return true;
  }
  return webhookNames.some((row) => row.trim() === name);
}

export function formatFuturesSourceKind(
  source: FuturesTradeSource,
  ruleName?: string | null,
  webhookNames?: readonly string[],
): "Auto" | "Manual" | "Webhook" {
  if (isFuturesWebhookOrigin(source, ruleName, webhookNames)) {
    return "Webhook";
  }
  return source === "engine" ? "Auto" : "Manual";
}

export function formatFuturesOrigin(input: {
  source: FuturesTradeSource;
  ruleName?: string | null;
  webhookNames?: readonly string[];
}): string {
  const kind = formatFuturesSourceKind(
    input.source,
    input.ruleName,
    input.webhookNames,
  );
  const name = String(input.ruleName ?? "").trim();
  if ((kind === "Auto" || kind === "Webhook") && name) {
    return `${kind} · ${name}`;
  }
  return kind;
}

export function futuresOriginLog(input: {
  source: FuturesTradeSource;
  ruleName?: string | null;
}): { source: FuturesTradeSource; ruleName?: string } {
  const ruleName = String(input.ruleName ?? "").trim();
  return ruleName
    ? { source: input.source, ruleName }
    : { source: input.source };
}

export function withFuturesOrigin(
  message: string,
  input: {
    source: FuturesTradeSource;
    ruleName?: string | null;
    webhookNames?: readonly string[];
  },
): string {
  return `${message} · ${formatFuturesOrigin(input)}`;
}

export function resolveOrderOrigin(
  order: { source: FuturesTradeSource; ruleName: string | null },
  position: { source: FuturesTradeSource; ruleName: string | null },
): { source: FuturesTradeSource; ruleName: string | null } {
  if (order.ruleName) {
    return { source: order.source, ruleName: order.ruleName };
  }
  if (order.source === position.source) {
    return { source: order.source, ruleName: position.ruleName };
  }
  return { source: order.source, ruleName: null };
}
