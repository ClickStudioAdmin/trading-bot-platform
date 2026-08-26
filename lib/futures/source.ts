import type { FuturesTradeSource } from "./model";

export function formatFuturesSourceKind(
  source: FuturesTradeSource,
): "Auto" | "Manual" {
  return source === "engine" ? "Auto" : "Manual";
}

export function formatFuturesOrigin(input: {
  source: FuturesTradeSource;
  ruleName?: string | null;
}): string {
  const kind = formatFuturesSourceKind(input.source);
  const name = String(input.ruleName ?? "").trim();
  if (kind === "Auto" && name) {
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
  input: { source: FuturesTradeSource; ruleName?: string | null },
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
