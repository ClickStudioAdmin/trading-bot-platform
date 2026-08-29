import type { BybitTicker } from "@/lib/exchanges/bybit/client";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import type { BybitInstrument } from "@/lib/exchanges/bybit/universe";
import {
  findHyperliquidAsset,
  loadHyperliquidMeta,
  loadHyperliquidMid,
  loadHyperliquidMids,
  type HyperliquidAsset,
} from "@/lib/exchanges/hyperliquid/info";

function stepFor(asset: HyperliquidAsset): number {
  return 10 ** -Math.max(0, asset.szDecimals);
}

export function hyperliquidInstrument(asset: HyperliquidAsset): BybitInstrument {
  const step = String(stepFor(asset));
  return {
    symbol: asset.coin,
    status: "Trading",
    baseCoin: asset.coin,
    quoteCoin: "USDC",
    settleCoin: "USDC",
    contractType: "LinearPerpetual",
    lotSizeFilter: {
      qtyStep: step,
      minOrderQty: step,
      maxOrderQty: "1000000",
      maxMktOrderQty: "1000000",
    },
    priceFilter: {
      tickSize: "0.0001",
      minPrice: "0.0001",
    },
  };
}

export function hyperliquidLinearPerp(asset: HyperliquidAsset): LinearPerp {
  const step = stepFor(asset);
  return {
    symbol: asset.coin,
    baseCoin: asset.coin,
    quoteCoin: "USDC",
    minQty: step,
    maxQty: 1_000_000,
    maxMktQty: 1_000_000,
    minNotional: 0,
    minPrice: 0.0001,
    tickSize: 0.0001,
  };
}

export async function loadHyperliquidLinearPerps(
  environmentId: string,
): Promise<LinearPerp[]> {
  const assets = await loadHyperliquidMeta(environmentId);
  const pinned = ["BTC", "ETH", "SOL"];
  return assets
    .map(hyperliquidLinearPerp)
    .sort((a, b) => {
      const rank = pinned.indexOf(a.baseCoin) - pinned.indexOf(b.baseCoin);
      if (pinned.includes(a.baseCoin) || pinned.includes(b.baseCoin)) {
        if (pinned.includes(a.baseCoin) && pinned.includes(b.baseCoin)) {
          return rank;
        }
        return pinned.includes(a.baseCoin) ? -1 : 1;
      }
      return a.baseCoin.localeCompare(b.baseCoin);
    });
}

export async function loadHyperliquidInstrument(
  environmentId: string,
  symbol: string,
): Promise<BybitInstrument | undefined> {
  const asset = await findHyperliquidAsset(environmentId, symbol);
  return asset ? hyperliquidInstrument(asset) : undefined;
}

export function tickerFromMid(symbol: string, mid: number): BybitTicker {
  const text = String(mid);
  return {
    symbol,
    lastPrice: text,
    markPrice: text,
    bid1Price: text,
    ask1Price: text,
  };
}

export async function loadHyperliquidTicker(
  environmentId: string,
  symbol: string,
): Promise<BybitTicker | null> {
  const mid = await loadHyperliquidMid(environmentId, symbol);
  return mid === null ? null : tickerFromMid(symbol, mid);
}

export async function loadHyperliquidTickerMap(
  environmentId: string,
): Promise<Map<string, { lastPrice?: string; bid1Price?: string; ask1Price?: string }>> {
  const mids = await loadHyperliquidMids(environmentId);
  return new Map(
    mids.map((row) => [row.coin, tickerFromMid(row.coin, row.mid)]),
  );
}
