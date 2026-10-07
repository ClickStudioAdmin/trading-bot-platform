import { BYBIT_PUBLIC_REST, type BybitInstrument } from "./universe";

type BybitBody<T> = {
  retCode: number;
  retMsg: string;
  result?: T;
};

const BYBIT_PUBLIC_ATTEMPTS = 4;

class BybitPublicError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "BybitPublicError";
    this.retryable = retryable;
  }
}

/** Rate limits and brief venue outages are worth another try. A blocked IP is not. */
export function bybitPublicCallShouldRetry(input: {
  httpStatus?: number | null;
  retCode?: number | null;
  retMsg?: string | null;
  networkError?: boolean;
}): boolean {
  if (input.networkError) {
    return true;
  }
  const status = input.httpStatus ?? 0;
  if (status === 408 || status === 429 || status >= 500) {
    return true;
  }
  const code = input.retCode ?? 0;
  if (code === 10006 || code === 10016 || code === 10018) {
    return true;
  }
  const msg = (input.retMsg ?? "").toLowerCase();
  return (
    msg.includes("too many") ||
    msg.includes("rate limit") ||
    msg.includes("system error")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function bybitGetOnce<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(`${BYBIT_PUBLIC_REST}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
  } catch (cause) {
    const message =
      cause instanceof Error && cause.message
        ? cause.message
        : `Bybit ${path} failed`;
    throw new BybitPublicError(message, true);
  }
  if (!response.ok) {
    if (response.status === 403) {
      throw new BybitPublicError(
        `Bybit HTTP 403 on ${path}. Bybit blocks many US cloud IPs. Vercel functions must run in Sydney (syd1).`,
        false,
      );
    }
    throw new BybitPublicError(
      `Bybit HTTP ${response.status} on ${path}`,
      bybitPublicCallShouldRetry({ httpStatus: response.status }),
    );
  }

  let body: BybitBody<T>;
  try {
    body = (await response.json()) as BybitBody<T>;
  } catch {
    throw new BybitPublicError(`Bybit ${path}: unreadable response`, true);
  }
  if (body.retCode !== 0 || !body.result) {
    const retMsg = body.retMsg || String(body.retCode);
    throw new BybitPublicError(
      `Bybit ${path}: ${retMsg}`,
      bybitPublicCallShouldRetry({
        retCode: body.retCode,
        retMsg,
      }),
    );
  }
  return body.result;
}

async function bybitGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  let last: BybitPublicError | null = null;
  for (let attempt = 0; attempt < BYBIT_PUBLIC_ATTEMPTS; attempt += 1) {
    try {
      return await bybitGetOnce<T>(path, params);
    } catch (cause) {
      const error =
        cause instanceof BybitPublicError
          ? cause
          : new BybitPublicError(
              cause instanceof Error && cause.message
                ? cause.message
                : `Bybit ${path} failed`,
              true,
            );
      last = error;
      if (!error.retryable || attempt === BYBIT_PUBLIC_ATTEMPTS - 1) {
        throw error;
      }
      await sleep(200 * 2 ** attempt);
    }
  }
  throw last ?? new BybitPublicError(`Bybit ${path} failed`, false);
}

type InstrumentsResult = {
  list?: BybitInstrument[];
  nextPageCursor?: string;
};

export async function fetchBybitInstruments(
  category: "linear" | "spot",
  symbol?: string,
): Promise<BybitInstrument[]> {
  const rows: BybitInstrument[] = [];
  let cursor: string | undefined;

  do {
    const params: Record<string, string> = {
      category,
      limit: "1000",
    };
    if (symbol) {
      params.symbol = symbol;
    }
    if (cursor) {
      params.cursor = cursor;
    }
    const result = await bybitGet<InstrumentsResult>(
      "/v5/market/instruments-info",
      params,
    );
    rows.push(...(result.list ?? []));
    cursor = result.nextPageCursor || undefined;
  } while (cursor);

  return rows;
}

export type BybitTicker = {
  symbol: string;
  lastPrice?: string;
  bid1Price?: string;
  ask1Price?: string;
  bid1Size?: string;
  ask1Size?: string;
  markPrice?: string;
  indexPrice?: string;
};

export async function fetchBybitTicker(
  category: "linear" | "spot",
  symbol: string,
): Promise<BybitTicker | null> {
  const result = await bybitGet<{ list?: BybitTicker[] }>(
    "/v5/market/tickers",
    { category, symbol },
  );
  return result.list?.find((row) => row.symbol === symbol) ?? result.list?.[0] ?? null;
}

export async function fetchBybitTickers(
  category: "linear" | "spot",
): Promise<Map<string, BybitTicker>> {
  const result = await bybitGet<{ list?: BybitTicker[] }>(
    "/v5/market/tickers",
    { category },
  );
  const map = new Map<string, BybitTicker>();
  for (const ticker of result.list ?? []) {
    map.set(ticker.symbol, ticker);
  }
  return map;
}

export type BybitOrderbook = {
  b?: string[][];
  a?: string[][];
};

export async function fetchBybitOrderbook(
  category: "linear" | "spot",
  symbol: string,
  limit = 5,
): Promise<BybitOrderbook> {
  return bybitGet<BybitOrderbook>("/v5/market/orderbook", {
    category,
    symbol,
    limit: String(limit),
  });
}

export type BybitKlineBar = {
  timeMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

function parseBybitKlineRow(row: string[]): BybitKlineBar | null {
  const timeMs = Number(row[0]);
  const open = Number(row[1]);
  const high = Number(row[2]);
  const low = Number(row[3]);
  const close = Number(row[4]);
  if (
    !(timeMs > 0) ||
    !(open > 0) ||
    !(high > 0) ||
    !(low > 0) ||
    !(close > 0)
  ) {
    return null;
  }
  return { timeMs, open, high, low, close };
}

export async function fetchBybitKlineBars(input: {
  symbol: string;
  interval: "5" | "15" | "30" | "60" | "120" | "240" | "360" | "720" | "D";
  limit?: number;
  startMs?: number;
  endMs?: number;
}): Promise<BybitKlineBar[]> {
  const params: Record<string, string> = {
    category: "linear",
    symbol: input.symbol,
    interval: input.interval,
    limit: String(Math.min(1000, input.limit ?? 80)),
  };
  if (input.startMs != null) {
    params.start = String(input.startMs);
  }
  if (input.endMs != null) {
    params.end = String(input.endMs);
  }
  const result = await bybitGet<{ list?: string[][] }>(
    "/v5/market/kline",
    params,
  );
  const bars: BybitKlineBar[] = [];
  for (const row of [...(result.list ?? [])].reverse()) {
    const parsed = parseBybitKlineRow(row);
    if (parsed) {
      bars.push(parsed);
    }
  }
  return bars;
}

export async function fetchBybitKlines(input: {
  symbol: string;
  interval: "5" | "15" | "30" | "60" | "120" | "240" | "360" | "720" | "D";
  limit?: number;
}): Promise<number[]> {
  const bars = await fetchBybitKlineBars(input);
  return bars.map((row) => row.close);
}
