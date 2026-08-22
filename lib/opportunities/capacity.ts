export const ENTRY_FEE_RATE = 0.00155;
export const SLIPPAGE_RATE = 0.0005;
export const DELIVERY_FEE_RATE = 0;
export const CAPACITY_BOOK_SHARE = 0.25;
export const ORDERBOOK_LEVELS = 5;

export type BookLevel = {
  price: number;
  size: number;
};

export function walkNotional(
  levels: BookLevel[],
  side: "buy" | "sell",
  maxImpact: number,
  maxLevels: number,
): number {
  const slice = levels.slice(0, maxLevels).filter(
    (level) => level.price > 0 && level.size > 0,
  );
  if (slice.length === 0) {
    return 0;
  }

  const touch = slice[0].price;
  let quote = 0;

  for (const level of slice) {
    const impact =
      side === "buy"
        ? (level.price - touch) / touch
        : (touch - level.price) / touch;
    if (impact > maxImpact) {
      break;
    }
    quote += level.price * level.size;
  }

  return quote;
}

export function pairCapacityUsdt(
  spotAsks: BookLevel[],
  futureBids: BookLevel[],
): number {
  const spot = walkNotional(
    spotAsks,
    "buy",
    SLIPPAGE_RATE,
    ORDERBOOK_LEVELS,
  );
  const future = walkNotional(
    futureBids,
    "sell",
    SLIPPAGE_RATE,
    ORDERBOOK_LEVELS,
  );
  return Math.min(spot, future) * CAPACITY_BOOK_SHARE;
}
