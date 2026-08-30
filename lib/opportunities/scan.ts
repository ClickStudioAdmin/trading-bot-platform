import {
  fetchBybitOrderbook,
  fetchBybitTickers,
} from "@/lib/exchanges/bybit/client";
import { listCarryPairs } from "@/lib/exchanges/bybit/list-carry-pairs";
import type { CarryPair } from "@/lib/exchanges/bybit/universe";
import { loadStoredPairMeta } from "@/lib/opportunities/persist";
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

function rankedOpportunity(
  pair: { baseCoin: string; spotSymbol: string; futureSymbol: string; deliveryTimeMs: number },
  spotAsks: BookLevel[],
  futureBids: BookLevel[],
  nowMs: number,
): ScannedOpportunity | null {
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
}

async function booksForPair(spotSymbol: string, futureSymbol: string) {
  const [spotBook, futureBook] = await Promise.all([
    fetchBybitOrderbook("spot", spotSymbol, ORDERBOOK_LEVELS).catch(() => ({
      a: [] as string[][],
    })),
    fetchBybitOrderbook("linear", futureSymbol, ORDERBOOK_LEVELS).catch(() => ({
      b: [] as string[][],
    })),
  ]);
  return {
    spotAsks: levelsFromBook(spotBook.a),
    futureBids: levelsFromBook(futureBook.b),
  };
}

export async function scanOneOpportunity(
  input: {
    spotSymbol: string;
    futureSymbol: string;
    baseCoin?: string;
    deliveryTimeMs?: number;
  },
  nowMs = Date.now(),
): Promise<ScannedOpportunity | null> {
  let pair: {
    baseCoin: string;
    spotSymbol: string;
    futureSymbol: string;
    deliveryTimeMs: number;
  } | null = null;

  if (input.baseCoin && input.deliveryTimeMs) {
    pair = {
      baseCoin: input.baseCoin,
      spotSymbol: input.spotSymbol,
      futureSymbol: input.futureSymbol,
      deliveryTimeMs: input.deliveryTimeMs,
    };
  } else {
    const stored = await loadStoredPairMeta(input.spotSymbol, input.futureSymbol);
    if (stored) {
      pair = {
        baseCoin: stored.baseCoin,
        spotSymbol: input.spotSymbol,
        futureSymbol: input.futureSymbol,
        deliveryTimeMs: stored.deliveryTimeMs,
      };
    } else {
      const pairs = await listCarryPairs();
      const match = pairs.find(
        (item) =>
          item.spotSymbol === input.spotSymbol &&
          item.futureSymbol === input.futureSymbol,
      );
      if (match) {
        pair = match;
      }
    }
  }

  if (!pair) {
    return null;
  }

  const books = await booksForPair(pair.spotSymbol, pair.futureSymbol);
  return rankedOpportunity(pair, books.spotAsks, books.futureBids, nowMs);
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

    const books = await booksForPair(pair.spotSymbol, pair.futureSymbol);
    let spotAsks = books.spotAsks;
    let futureBids = books.futureBids;

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

    return rankedOpportunity(pair, spotAsks, futureBids, nowMs);
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
