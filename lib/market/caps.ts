import { marketIconsByBase } from "@/lib/market/icons";

const COINGECKO_MARKETS =
  "https://api.coingecko.com/api/v3/coins/markets";
const CACHE_MS = 15 * 60_000;
const PAGE_SIZE = 250;
const PAGES = 2;

type CoinGeckoMarket = {
  symbol?: unknown;
  market_cap?: unknown;
  image?: unknown;
};

type MarketSnapshot = {
  caps: Map<string, number>;
  icons: Map<string, string>;
};

let cache: { at: number; snapshot: MarketSnapshot } | null = null;
let inflight: Promise<MarketSnapshot> | null = null;

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
  return (await loadMarkets()).caps;
}

export async function loadMarketIcons(): Promise<Map<string, string>> {
  return (await loadMarkets()).icons;
}

async function loadMarkets(): Promise<MarketSnapshot> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    return cache.snapshot;
  }
  if (inflight) {
    return inflight;
  }
  inflight = fetchMarkets()
    .then((snapshot) => {
      cache = { at: Date.now(), snapshot };
      return snapshot;
    })
    .catch(
      () =>
        cache?.snapshot ?? {
          caps: new Map<string, number>(),
          icons: new Map<string, string>(),
        },
    )
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function fetchMarkets(): Promise<MarketSnapshot> {
  const capRows: { symbol: string; market_cap: number }[] = [];
  const iconRows: { symbol: string; image: string }[] = [];
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
      const image = String(row.image ?? "").trim();
      if (symbol && Number.isFinite(marketCap) && marketCap > 0) {
        capRows.push({ symbol, market_cap: marketCap });
      }
      if (symbol && image) {
        iconRows.push({ symbol, image });
      }
    }
  }
  return {
    caps: marketCapByBase(capRows),
    icons: marketIconsByBase(iconRows),
  };
}
