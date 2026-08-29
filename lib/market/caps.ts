const COINGECKO_MARKETS =
  "https://api.coingecko.com/api/v3/coins/markets";
const CACHE_MS = 15 * 60_000;
const PAGE_SIZE = 250;
const PAGES = 2;

type CoinGeckoMarket = {
  symbol?: unknown;
  market_cap?: unknown;
};

let cache: { at: number; caps: Map<string, number> } | null = null;
let inflight: Promise<Map<string, number>> | null = null;

export function marketCapByBase(
  rows: readonly { symbol: string; market_cap: number }[],
): Map<string, number> {
  const caps = new Map<string, number>();
  for (const row of rows) {
    const key = row.symbol.trim().toUpperCase();
    if (!key || caps.has(key)) {
      continue;
    }
    if (Number.isFinite(row.market_cap) && row.market_cap > 0) {
      caps.set(key, row.market_cap);
    }
  }
  return caps;
}

export function formatMarketCap(value: number | null): string {
  if (value === null || !(value > 0)) {
    return "—";
  }
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(1)}T`;
  }
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(1)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(1)}M`;
  }
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export async function loadMarketCaps(): Promise<Map<string, number>> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    return cache.caps;
  }
  if (inflight) {
    return inflight;
  }
  inflight = fetchMarketCaps()
    .then((caps) => {
      cache = { at: Date.now(), caps };
      return caps;
    })
    .catch(() => cache?.caps ?? new Map<string, number>())
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function fetchMarketCaps(): Promise<Map<string, number>> {
  const rows: { symbol: string; market_cap: number }[] = [];
  for (let page = 1; page <= PAGES; page += 1) {
    const url = new URL(COINGECKO_MARKETS);
    url.searchParams.set("vs_currency", "usd");
    url.searchParams.set("order", "market_cap_desc");
    url.searchParams.set("per_page", String(PAGE_SIZE));
    url.searchParams.set("page", String(page));
    url.searchParams.set("sparkline", "false");
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      throw new Error(`CoinGecko HTTP ${response.status}`);
    }
    const body = (await response.json()) as CoinGeckoMarket[];
    if (!Array.isArray(body)) {
      throw new Error("CoinGecko markets payload was not a list.");
    }
    for (const row of body) {
      const symbol = String(row.symbol ?? "").trim();
      const marketCap = Number(row.market_cap);
      if (symbol && Number.isFinite(marketCap) && marketCap > 0) {
        rows.push({ symbol, market_cap: marketCap });
      }
    }
  }
  return marketCapByBase(rows);
}
