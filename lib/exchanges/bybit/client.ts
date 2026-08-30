import { BYBIT_PUBLIC_REST, type BybitInstrument } from "./universe";

type BybitBody<T> = {
  retCode: number;
  retMsg: string;
  result?: T;
};

async function bybitGet<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(`${BYBIT_PUBLIC_REST}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        `Bybit HTTP 403 on ${path}. Bybit blocks many US cloud IPs. Vercel functions must run in Sydney (syd1).`,
      );
    }
    throw new Error(`Bybit HTTP ${response.status} on ${path}`);
  }

  const body = (await response.json()) as BybitBody<T>;
  if (body.retCode !== 0 || !body.result) {
    throw new Error(`Bybit ${path}: ${body.retMsg || body.retCode}`);
  }
  return body.result;
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
