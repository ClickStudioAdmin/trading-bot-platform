import type { FuturesSide } from "@/lib/futures/model";
import { futuresPnlUsdt } from "@/lib/futures/math";

export function dcaClipSizeAt(
  clipIndex: number,
  clipSize: number,
  sizeMultiplier: number,
): number {
  if (!(clipSize > 0) || !(sizeMultiplier > 0) || clipIndex < 0) {
    return 0;
  }
  return clipSize * sizeMultiplier ** clipIndex;
}

export function dcaDipPctAt(
  addIndex: number,
  dipPct: number,
  deviationMultiplier: number,
): number {
  if (!(dipPct > 0) || !(deviationMultiplier > 0) || addIndex < 0) {
    return 0;
  }
  return dipPct * deviationMultiplier ** addIndex;
}

export function dcaSafetyPrices(input: {
  side: FuturesSide;
  entryPrice: number;
  maxClips: number;
  dipPct: number;
  deviationMultiplier: number;
}): number[] {
  if (!(input.entryPrice > 0) || input.maxClips < 2 || !(input.dipPct > 0)) {
    return [];
  }
  const prices: number[] = [];
  let previous = input.entryPrice;
  for (let add = 0; add < input.maxClips - 1; add += 1) {
    const dip = dcaDipPctAt(add, input.dipPct, input.deviationMultiplier);
    previous =
      input.side === "long"
        ? previous * (1 - dip / 100)
        : previous * (1 + dip / 100);
    if (!(previous > 0)) {
      break;
    }
    prices.push(previous);
  }
  return prices;
}

export function dcaMaxDropCoveredPct(input: {
  side: FuturesSide;
  maxClips: number | null;
  dipPct: number | null;
  deviationMultiplier: number;
}): number | null {
  if (input.maxClips === null || input.maxClips < 2 || input.dipPct === null) {
    return null;
  }
  const prices = dcaSafetyPrices({
    side: input.side,
    entryPrice: 100,
    maxClips: input.maxClips,
    dipPct: input.dipPct,
    deviationMultiplier: input.deviationMultiplier,
  });
  const last = prices[prices.length - 1];
  if (last === undefined) {
    return null;
  }
  if (input.side === "long") {
    return ((100 - last) / 100) * 100;
  }
  return ((last - 100) / 100) * 100;
}

export function dcaLastClipDeviationPct(input: {
  side: FuturesSide;
  maxClips: number | null;
  dipPct: number | null;
  deviationMultiplier: number;
}): number | null {
  return dcaMaxDropCoveredPct(input);
}

export const DCA_LADDER_PREVIEW_MAX = 40;

export type DcaLadderLevel = {
  index: number;
  price: number;
  deviationPct: number;
  size: number;
  qty: number;
  orderUsdt: number;
  totalUsdt: number;
  averagePrice: number;
  profitUsdt: number;
};

export function dcaTakeProfitPrice(input: {
  side: FuturesSide;
  firstPrice: number;
  averagePrice: number;
  takeProfitPct: number | null;
  takeProfitBasis: "average" | "first_entry";
}): number | null {
  if (!(input.firstPrice > 0) || !(input.averagePrice > 0)) {
    return null;
  }
  if (input.takeProfitPct !== null && input.takeProfitPct > 0) {
    const basis =
      input.takeProfitBasis === "first_entry"
        ? input.firstPrice
        : input.averagePrice;
    return input.side === "long"
      ? basis * (1 + input.takeProfitPct / 100)
      : basis * (1 - input.takeProfitPct / 100);
  }
  return input.firstPrice;
}

export function dcaLadderProfitUsdt(input: {
  side: FuturesSide;
  qty: number;
  firstPrice: number;
  averagePrice: number;
  takeProfitPct: number | null;
  takeProfitBasis: "average" | "first_entry";
}): number {
  const exit = dcaTakeProfitPrice(input);
  if (exit === null || !(input.qty > 0) || !(input.averagePrice > 0)) {
    return 0;
  }
  return futuresPnlUsdt({
    side: input.side,
    qty: input.qty,
    entryPrice: input.averagePrice,
    exitPrice: exit,
  });
}

export function dcaLadderProfitRange(
  levels: readonly DcaLadderLevel[],
): { min: number; max: number } | null {
  if (levels.length === 0) {
    return null;
  }
  let min = levels[0]?.profitUsdt ?? 0;
  let max = min;
  for (const row of levels) {
    min = Math.min(min, row.profitUsdt);
    max = Math.max(max, row.profitUsdt);
  }
  return { min, max };
}

export function dcaLadderLevels(input: {
  side: FuturesSide;
  entryPrice: number;
  maxClips: number | null;
  dipPct: number | null;
  clipSize: number;
  sizeUnit: "qty" | "usdt";
  sizeMultiplier: number;
  deviationMultiplier: number;
  takeProfitPct?: number | null;
  takeProfitBasis?: "average" | "first_entry";
}): DcaLadderLevel[] {
  const count = Math.min(input.maxClips ?? 0, DCA_LADDER_PREVIEW_MAX);
  if (
    count < 1 ||
    !(input.clipSize > 0) ||
    !(input.sizeMultiplier > 0) ||
    !(input.entryPrice > 0)
  ) {
    return [];
  }
  const first = input.entryPrice;
  const addPrices =
    input.dipPct !== null && input.dipPct > 0 && count >= 2
      ? dcaSafetyPrices({
          side: input.side,
          entryPrice: first,
          maxClips: count,
          dipPct: input.dipPct,
          deviationMultiplier: input.deviationMultiplier,
        })
      : [];
  const prices = [first, ...addPrices];
  while (prices.length < count) {
    prices.push(prices[prices.length - 1] ?? first);
  }
  const rows: DcaLadderLevel[] = [];
  let totalQty = 0;
  let weighted = 0;
  let totalUsdt = 0;
  for (let i = 0; i < count; i += 1) {
    const price = prices[i] ?? first;
    if (!(price > 0)) {
      break;
    }
    const size = dcaClipSizeAt(i, input.clipSize, input.sizeMultiplier);
    const qty = input.sizeUnit === "qty" ? size : size / price;
    const orderUsdt = input.sizeUnit === "usdt" ? size : size * price;
    totalQty += qty;
    weighted += price * qty;
    totalUsdt += orderUsdt;
    const averagePrice = totalQty > 0 ? weighted / totalQty : price;
    rows.push({
      index: i + 1,
      price,
      deviationPct: ((price - first) / first) * 100,
      size,
      qty: totalQty,
      orderUsdt,
      totalUsdt,
      averagePrice,
      profitUsdt: dcaLadderProfitUsdt({
        side: input.side,
        qty: totalQty,
        firstPrice: first,
        averagePrice,
        takeProfitPct: input.takeProfitPct ?? null,
        takeProfitBasis: input.takeProfitBasis ?? "average",
      }),
    });
  }
  return rows;
}

export function dcaRequiredUsdt(input: {
  clipSize: number;
  sizeUnit: "qty" | "usdt";
  maxClips: number | null;
  sizeMultiplier: number;
  mark: number | null;
}): number | null {
  const clips = input.maxClips ?? 1;
  if (!(clips > 0) || !(input.clipSize > 0)) {
    return null;
  }
  let totalQtyOrUsdt = 0;
  for (let i = 0; i < clips; i += 1) {
    totalQtyOrUsdt += dcaClipSizeAt(i, input.clipSize, input.sizeMultiplier);
  }
  if (input.sizeUnit === "usdt") {
    return totalQtyOrUsdt;
  }
  if (input.mark === null || !(input.mark > 0)) {
    return null;
  }
  return totalQtyOrUsdt * input.mark;
}

export function dcaBreakevenPrice(input: {
  side: FuturesSide;
  basisPrice: number;
  offsetPct: number;
}): number {
  const offset = Math.max(0, input.offsetPct);
  if (input.side === "long") {
    return input.basisPrice * (1 + offset / 100);
  }
  return input.basisPrice * (1 - offset / 100);
}

export function dcaTrailingDistance(mark: number, trailingPct: number): number {
  if (!(mark > 0) || !(trailingPct > 0)) {
    return 0;
  }
  return mark * (trailingPct / 100);
}

export function dcaTrailingActivationPrice(input: {
  side: FuturesSide;
  basisPrice: number;
  triggerPct: number;
}): number {
  if (input.side === "long") {
    return input.basisPrice * (1 + input.triggerPct / 100);
  }
  return input.basisPrice * (1 - input.triggerPct / 100);
}
