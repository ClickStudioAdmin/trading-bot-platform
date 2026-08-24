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
  bid1Price?: string;
  ask1Price?: string;
  bid1Size?: string;
  ask1Size?: string;
};

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
