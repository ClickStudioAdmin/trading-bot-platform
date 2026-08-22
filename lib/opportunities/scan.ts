import {
  fetchBybitOrderbook,
  fetchBybitTickers,
} from "@/lib/exchanges/bybit/client";
import { listCarryPairs } from "@/lib/exchanges/bybit/list-carry-pairs";
import type { CarryPair } from "@/lib/exchanges/bybit/universe";
import {
  DELIVERY_FEE_RATE,
  ENTRY_FEE_RATE,
  ORDERBOOK_LEVELS,
  SLIPPAGE_RATE,
  pairCapacityUsdt,
  type BookLevel,
} from "@/lib/opportunities/capacity";
import { rankOpportunity } from "@/lib/opportunities/math";

export type ScannedOpportunity = {
  baseCoin: string;
  spotSymbol: string;
  futureSymbol: string;
  deliveryTimeMs: number;
  deliveryDate: string;
  daysToExpiry: number;
  futureBid: number;
  spotAsk: number;
  executableBasis: number;
  feeRate: number;
  netBasis: number;
  netApr: number | null;
  capacityUsdt: number;
};

function levelsFromBook(rows: string[][] | undefined): BookLevel[] {
  return (rows ?? [])
    .map(([price, size]) => ({
      price: Number(price),
      size: Number(size),
    }))
    .filter((level) => Number.isFinite(level.price) && Number.isFinite(level.size));
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => run()),
  );
  return results;
}

function tickerLevel(
  price: string | undefined,
  size: string | undefined,
): BookLevel | null {
  const parsedPrice = Number(price);
  const parsedSize = Number(size);
  if (!(parsedPrice > 0) || !(parsedSize > 0)) {
    return null;
  }
  return { price: parsedPrice, size: parsedSize };
}

export async function scanCarryOpportunities(
  nowMs = Date.now(),
): Promise<ScannedOpportunity[]> {
  const pairs = await listCarryPairs();
  const [spotTickers, linearTickers] = await Promise.all([
    fetchBybitTickers("spot"),
    fetchBybitTickers("linear"),
  ]);

  const scanned = await mapPool(pairs, 6, async (pair: CarryPair) => {
    const spotTicker = spotTickers.get(pair.spotSymbol);
    const futureTicker = linearTickers.get(pair.futureSymbol);
    if (!spotTicker || !futureTicker) {
      return null;
    }

    let spotAsks = levelsFromBook(
      (await fetchBybitOrderbook("spot", pair.spotSymbol, ORDERBOOK_LEVELS).catch(
        () => ({ a: [] }),
      )).a,
    );
    let futureBids = levelsFromBook(
      (await fetchBybitOrderbook(
        "linear",
        pair.futureSymbol,
        ORDERBOOK_LEVELS,
      ).catch(() => ({ b: [] }))).b,
    );

    if (spotAsks.length === 0) {
      const fallback = tickerLevel(spotTicker.ask1Price, spotTicker.ask1Size);
      if (fallback) {
        spotAsks = [fallback];
      }
    }
    if (futureBids.length === 0) {
      const fallback = tickerLevel(futureTicker.bid1Price, futureTicker.bid1Size);
      if (fallback) {
        futureBids = [fallback];
      }
    }
    if (spotAsks.length === 0 || futureBids.length === 0) {
      return null;
    }

    const spotAsk = spotAsks[0].price;
    const futureBid = futureBids[0].price;
    const ranked = rankOpportunity({
      futureBid,
      spotAsk,
      feeRate: ENTRY_FEE_RATE,
      slippageRate: SLIPPAGE_RATE,
      deliveryFeeRate: DELIVERY_FEE_RATE,
      deliveryTimeMs: pair.deliveryTimeMs,
      nowMs,
    });

    return {
      baseCoin: pair.baseCoin,
      spotSymbol: pair.spotSymbol,
      futureSymbol: pair.futureSymbol,
      deliveryTimeMs: pair.deliveryTimeMs,
      deliveryDate: new Date(pair.deliveryTimeMs).toISOString().slice(0, 10),
      daysToExpiry: ranked.daysToExpiry,
      futureBid,
      spotAsk,
      executableBasis: ranked.executableBasis,
      feeRate: ENTRY_FEE_RATE + SLIPPAGE_RATE + DELIVERY_FEE_RATE,
      netBasis: ranked.netBasis,
      netApr: ranked.netApr,
      capacityUsdt: pairCapacityUsdt(spotAsks, futureBids),
    };
  });

  const rows: ScannedOpportunity[] = [];
  for (const row of scanned) {
    if (row) {
      rows.push(row);
    }
  }
  rows.sort((a, b) => (b.netApr ?? -999) - (a.netApr ?? -999));
  return rows;
}
