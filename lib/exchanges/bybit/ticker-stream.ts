import type { BybitTicker } from "./client";

export const BYBIT_LINEAR_PUBLIC_WS = "wss://stream.bybit.com/v5/public/linear";
export const BYBIT_TICKER_ARGS_CHAR_LIMIT = 21_000;

export function bybitLinearPublicWsUrl(): string {
  return BYBIT_LINEAR_PUBLIC_WS;
}

export function bybitTickerTopic(symbol: string): string {
  return `tickers.${symbol.trim().toUpperCase()}`;
}

export function chunkBybitTopics(
  topics: readonly string[],
  maxChars = BYBIT_TICKER_ARGS_CHAR_LIMIT,
): string[][] {
  const limit = Math.max(32, Math.floor(maxChars));
  const chunks: string[][] = [];
  let current: string[] = [];
  let chars = 0;
  for (const topic of topics) {
    const next = chars + topic.length + (current.length > 0 ? 1 : 0);
    if (current.length > 0 && next > limit) {
      chunks.push(current);
      current = [topic];
      chars = topic.length;
      continue;
    }
    current.push(topic);
    chars = next;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

function keptPrice(
  next: string | undefined,
  previous: string | undefined,
): string | undefined {
  if (typeof next === "string" && next.length > 0) {
    return next;
  }
  return previous;
}

export function mergeBybitTicker(
  previous: BybitTicker | undefined,
  patch: BybitTicker,
): BybitTicker {
  return {
    symbol: patch.symbol || previous?.symbol || "",
    lastPrice: keptPrice(patch.lastPrice, previous?.lastPrice),
    bid1Price: keptPrice(patch.bid1Price, previous?.bid1Price),
    ask1Price: keptPrice(patch.ask1Price, previous?.ask1Price),
    bid1Size: keptPrice(patch.bid1Size, previous?.bid1Size),
    ask1Size: keptPrice(patch.ask1Size, previous?.ask1Size),
    markPrice: keptPrice(patch.markPrice, previous?.markPrice),
    indexPrice: keptPrice(patch.indexPrice, previous?.indexPrice),
  };
}

export function applyBybitTickerMessage(
  raw: string,
  tickers: Map<string, BybitTicker>,
): boolean {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!body || typeof body !== "object") {
    return false;
  }
  const record = body as { topic?: unknown; data?: unknown };
  if (typeof record.topic !== "string" || !record.topic.startsWith("tickers.")) {
    return false;
  }
  if (!record.data || typeof record.data !== "object") {
    return false;
  }
  const patch = record.data as BybitTicker;
  const symbol =
    (typeof patch.symbol === "string" && patch.symbol.trim()) ||
    record.topic.slice("tickers.".length);
  if (!symbol) {
    return false;
  }
  tickers.set(
    symbol,
    mergeBybitTicker(tickers.get(symbol), { ...patch, symbol }),
  );
  return true;
}

const tickers = new Map<string, BybitTicker>();
const wanted = new Set<string>();
const listeners = new Set<() => void>();
let socket: WebSocket | null = null;
let connecting = false;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectMs = 1_000;

export function readBybitLinearTickerMap(): Map<string, BybitTicker> {
  return tickers;
}

export function seedBybitLinearTickers(
  rows: ReadonlyMap<string, BybitTicker>,
): void {
  for (const [symbol, ticker] of rows) {
    if (!tickers.has(symbol)) {
      tickers.set(symbol, ticker);
    }
  }
}

export function noteBybitTickerSymbols(symbols: readonly string[]): void {
  let added = false;
  for (const symbol of symbols) {
    const clean = symbol.trim().toUpperCase();
    if (!clean || wanted.has(clean)) {
      continue;
    }
    wanted.add(clean);
    added = true;
  }
  if (added && socket && socket.readyState === WebSocket.OPEN) {
    sendSubscriptions(socket);
  }
}

export function waitForBybitTicker(timeoutMs: number): Promise<void> {
  const wait = Math.max(0, Math.floor(timeoutMs));
  return new Promise((resolve) => {
    const timer = setTimeout(finish, wait);
    const listener = () => finish();
    function finish(): void {
      clearTimeout(timer);
      listeners.delete(listener);
      resolve();
    }
    listeners.add(listener);
  });
}

function notifyTickers(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}

function sendSubscriptions(ws: WebSocket): void {
  const topics = [...wanted].map((symbol) => bybitTickerTopic(symbol));
  for (const args of chunkBybitTopics(topics)) {
    ws.send(JSON.stringify({ op: "subscribe", args }));
  }
}

function clearPing(): void {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

export function ensureBybitLinearTickerStream(): void {
  if (
    connecting ||
    (socket &&
      (socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING))
  ) {
    return;
  }
  connecting = true;
  const ws = new WebSocket(bybitLinearPublicWsUrl());
  socket = ws;
  ws.addEventListener("open", () => {
    connecting = false;
    reconnectMs = 1_000;
    sendSubscriptions(ws);
    clearPing();
    pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ op: "ping" }));
      }
    }, 20_000);
  });
  ws.addEventListener("message", (event) => {
    const text = typeof event.data === "string" ? event.data : "";
    if (text && applyBybitTickerMessage(text, tickers)) {
      notifyTickers();
    }
  });
  ws.addEventListener("close", () => {
    connecting = false;
    clearPing();
    if (socket === ws) {
      socket = null;
    }
    const wait = reconnectMs;
    reconnectMs = Math.min(10_000, reconnectMs * 2);
    setTimeout(() => ensureBybitLinearTickerStream(), wait);
  });
  ws.addEventListener("error", () => {
    ws.close();
  });
}
