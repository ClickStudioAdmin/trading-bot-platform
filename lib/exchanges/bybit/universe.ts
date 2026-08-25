export const BYBIT_PUBLIC_REST = "https://api.bybit.com";
export const BYBIT_DEMO_REST = "https://api-demo.bybit.com";

export function bybitRestHost(environmentId: string): string {
  return environmentId === "demo" ? BYBIT_DEMO_REST : BYBIT_PUBLIC_REST;
}

export const CARRY_BASE_COINS = [
  "BTC",
  "ETH",
  "SOL",
  "DOGE",
  "XRP",
  "MNT",
] as const;

export type CarryBaseCoin = (typeof CARRY_BASE_COINS)[number];

export type BybitInstrument = {
  symbol: string;
  contractType?: string;
  status: string;
  baseCoin: string;
  quoteCoin: string;
  settleCoin?: string;
  deliveryTime?: string;
  lotSizeFilter?: {
    qtyStep?: string;
    minOrderQty?: string;
    basePrecision?: string;
    minOrderAmt?: string;
    minNotionalValue?: string;
  };
};

export type CarryPair = {
  baseCoin: CarryBaseCoin;
  spotSymbol: string;
  futureSymbol: string;
  deliveryTimeMs: number;
  daysToExpiry: number;
};

export function isCarryBaseCoin(value: string): value is CarryBaseCoin {
  return (CARRY_BASE_COINS as readonly string[]).includes(value);
}

export function isDatedLinearFuture(instrument: BybitInstrument): boolean {
  if (instrument.status !== "Trading") {
    return false;
  }
  if (instrument.quoteCoin !== "USDT" && instrument.settleCoin !== "USDT") {
    return false;
  }
  if (!isCarryBaseCoin(instrument.baseCoin)) {
    return false;
  }
  const delivery = Number(instrument.deliveryTime ?? "0");
  if (!Number.isFinite(delivery) || delivery <= 0) {
    return false;
  }
  if (
    instrument.contractType &&
    instrument.contractType !== "LinearFutures"
  ) {
    return false;
  }
  return true;
}

export function isCarrySpot(instrument: BybitInstrument): boolean {
  return (
    instrument.status === "Trading" &&
    instrument.quoteCoin === "USDT" &&
    isCarryBaseCoin(instrument.baseCoin)
  );
}

export function pairCarryUniverse(
  futures: BybitInstrument[],
  spots: BybitInstrument[],
  nowMs: number,
): CarryPair[] {
  const spotByBase = new Map<string, BybitInstrument>();
  for (const spot of spots) {
    if (isCarrySpot(spot)) {
      spotByBase.set(spot.baseCoin, spot);
    }
  }

  const pairs: CarryPair[] = [];
  for (const future of futures) {
    if (!isDatedLinearFuture(future)) {
      continue;
    }
    const spot = spotByBase.get(future.baseCoin);
    if (!spot) {
      continue;
    }
    if (!isCarryBaseCoin(future.baseCoin)) {
      continue;
    }
    const deliveryTimeMs = Number(future.deliveryTime);
    pairs.push({
      baseCoin: future.baseCoin,
      spotSymbol: spot.symbol,
      futureSymbol: future.symbol,
      deliveryTimeMs,
      daysToExpiry: (deliveryTimeMs - nowMs) / 86_400_000,
    });
  }

  return pairs.sort((a, b) => {
    if (a.baseCoin !== b.baseCoin) {
      return a.baseCoin.localeCompare(b.baseCoin);
    }
    return a.deliveryTimeMs - b.deliveryTimeMs;
  });
}
