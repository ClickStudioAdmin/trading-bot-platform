import type { FuturesSide } from "@/lib/futures/model";
import { futuresPnlUsdt } from "@/lib/futures/math";
import { positionMarginUsdt } from "@/lib/futures/stats";
import {
  formatPerpMinQty,
  perpEffectiveMaxQty,
} from "@/lib/exchanges/bybit/ticket-size";

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

export function dcaGeometricSizeSum(
  clips: number,
  sizeMultiplier: number,
): number | null {
  if (!(clips > 0) || !Number.isFinite(clips) || !(sizeMultiplier > 0)) {
    return null;
  }
  const count = Math.floor(clips);
  if (sizeMultiplier === 1) {
    return count;
  }
  return (sizeMultiplier ** count - 1) / (sizeMultiplier - 1);
}

export function dcaClipFromBudget(input: {
  maxValue: number | null;
  maxClips: number | null;
  sizeMultiplier: number;
  sizeUnit: "qty" | "usdt";
  mark?: number | null;
}): number | null {
  if (
    input.maxValue == null ||
    !(input.maxValue > 0) ||
    input.maxClips == null ||
    !(input.maxClips > 0)
  ) {
    return null;
  }
  const sum = dcaGeometricSizeSum(input.maxClips, input.sizeMultiplier);
  if (sum == null || !(sum > 0)) {
    return null;
  }
  if (input.sizeUnit === "usdt") {
    return input.maxValue / sum;
  }
  if (input.mark == null || !(input.mark > 0)) {
    return null;
  }
  return input.maxValue / (sum * input.mark);
}

export function dcaClipQtyAt(
  clipIndex: number,
  clipSize: number,
  sizeMultiplier: number,
  sizeUnit: "qty" | "usdt",
  price: number,
): number {
  const size = dcaClipSizeAt(clipIndex, clipSize, sizeMultiplier);
  if (!(size > 0) || !(price > 0)) {
    return 0;
  }
  return sizeUnit === "qty" ? size : size / price;
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
export const DCA_LADDER_CHECK_MAX = 500;

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
  lossUsdt: number | null;
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
  return dcaLadderFieldRange(levels, (row) => row.profitUsdt);
}

export function dcaStopLossPrice(input: {
  side: FuturesSide;
  firstPrice: number;
  averagePrice: number;
  stopLossPct: number | null;
  stopLossBasis: "average" | "first_entry";
}): number | null {
  if (
    input.stopLossPct === null ||
    !(input.stopLossPct > 0) ||
    !(input.firstPrice > 0) ||
    !(input.averagePrice > 0)
  ) {
    return null;
  }
  const basis =
    input.stopLossBasis === "first_entry"
      ? input.firstPrice
      : input.averagePrice;
  return input.side === "long"
    ? basis * (1 - input.stopLossPct / 100)
    : basis * (1 + input.stopLossPct / 100);
}

export function dcaPlannedExits(input: {
  side: FuturesSide;
  entryPrice: number | null;
  firstFillPrice: number | null;
  mark: number | null;
  takeProfitPct: number | null;
  stopLossPct: number | null;
  takeProfitBasis: "average" | "first_entry";
  stopLossBasis: "average" | "first_entry";
  trailingPct: number | null;
}): {
  takeProfit: number | null;
  stopLoss: number | null;
  trailingStop: number | null;
} {
  const entry = input.entryPrice;
  const first = input.firstFillPrice ?? entry;
  const takeProfit =
    input.takeProfitPct !== null &&
    first !== null &&
    entry !== null
      ? dcaTakeProfitPrice({
          side: input.side,
          firstPrice: first,
          averagePrice: entry,
          takeProfitPct: input.takeProfitPct,
          takeProfitBasis: input.takeProfitBasis,
        })
      : null;
  const stopLoss =
    input.stopLossPct !== null && first !== null && entry !== null
      ? dcaStopLossPrice({
          side: input.side,
          firstPrice: first,
          averagePrice: entry,
          stopLossPct: input.stopLossPct,
          stopLossBasis: input.stopLossBasis,
        })
      : null;
  const trailFrom = input.mark ?? entry;
  const trailingStop =
    input.trailingPct !== null && trailFrom !== null && trailFrom > 0
      ? dcaTrailingDistance(trailFrom, input.trailingPct)
      : null;
  return {
    takeProfit,
    stopLoss,
    trailingStop: trailingStop !== null && trailingStop > 0 ? trailingStop : null,
  };
}

export function dcaLadderLossUsdt(input: {
  side: FuturesSide;
  qty: number;
  firstPrice: number;
  averagePrice: number;
  stopLossPct: number | null;
  stopLossBasis: "average" | "first_entry";
}): number | null {
  const exit = dcaStopLossPrice(input);
  if (exit === null || !(input.qty > 0) || !(input.averagePrice > 0)) {
    return null;
  }
  const pnl = futuresPnlUsdt({
    side: input.side,
    qty: input.qty,
    entryPrice: input.averagePrice,
    exitPrice: exit,
  });
  return Math.max(0, -pnl);
}

export function dcaLadderLossRange(
  levels: readonly DcaLadderLevel[],
): { min: number; max: number } | null {
  return dcaLadderFieldRange(levels, (row) => row.lossUsdt);
}

function dcaLadderFieldRange(
  levels: readonly DcaLadderLevel[],
  valueOf: (row: DcaLadderLevel) => number | null,
): { min: number; max: number } | null {
  const values = levels
    .map(valueOf)
    .filter((value): value is number => value !== null);
  if (values.length === 0) {
    return null;
  }
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function dcaLadderOrderPrices(input: {
  side: FuturesSide;
  entryPrice: number;
  count: number;
  dipPct: number | null;
  deviationMultiplier: number;
}): number[] {
  if (!(input.entryPrice > 0) || input.count < 1) {
    return [];
  }
  const first = input.entryPrice;
  const addPrices =
    input.dipPct !== null && input.dipPct > 0 && input.count >= 2
      ? dcaSafetyPrices({
          side: input.side,
          entryPrice: first,
          maxClips: input.count,
          dipPct: input.dipPct,
          deviationMultiplier: input.deviationMultiplier,
        })
      : [];
  const prices = [first, ...addPrices];
  while (prices.length < input.count) {
    prices.push(prices[prices.length - 1] ?? first);
  }
  return prices.slice(0, input.count);
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
  stopLossPct?: number | null;
  stopLossBasis?: "average" | "first_entry";
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
  const prices = dcaLadderOrderPrices({
    side: input.side,
    entryPrice: first,
    count,
    dipPct: input.dipPct,
    deviationMultiplier: input.deviationMultiplier,
  });
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
      lossUsdt: dcaLadderLossUsdt({
        side: input.side,
        qty: totalQty,
        firstPrice: first,
        averagePrice,
        stopLossPct: input.stopLossPct ?? null,
        stopLossBasis: input.stopLossBasis ?? "average",
      }),
    });
  }
  return rows;
}

export function dcaClipsUntilMaxValue(input: {
  side: FuturesSide;
  entryPrice: number;
  maxValue: number;
  dipPct: number | null;
  clipSize: number;
  sizeUnit: "qty" | "usdt";
  sizeMultiplier: number;
  deviationMultiplier: number;
}): number | null {
  if (!(input.maxValue > 0) || !(input.clipSize > 0)) {
    return null;
  }
  const levels = dcaLadderLevels({
    ...input,
    maxClips: DCA_LADDER_PREVIEW_MAX,
  });
  if (levels.length === 0) {
    return null;
  }
  const hit = levels.findIndex((row) => row.totalUsdt >= input.maxValue);
  return hit === -1 ? levels.length : hit + 1;
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

export function dcaInitialMarginUsdt(
  exposureUsdt: number | null,
  leverage: number | null,
): number | null {
  if (exposureUsdt == null || !(exposureUsdt > 0)) {
    return null;
  }
  return positionMarginUsdt(exposureUsdt, leverage);
}

export function dcaPlannedOrderCount(input: {
  side: FuturesSide;
  entryPrice: number;
  maxClips: number | null;
  maxValue: number | null;
  dipPct: number | null;
  clipSize: number;
  sizeUnit: "qty" | "usdt";
  sizeMultiplier: number;
  deviationMultiplier: number;
}): number {
  if (input.maxClips !== null && input.maxClips >= 1) {
    return Math.min(Math.floor(input.maxClips), DCA_LADDER_CHECK_MAX);
  }
  if (input.maxValue !== null && input.maxValue > 0) {
    const until = dcaClipsUntilMaxValue({
      side: input.side,
      entryPrice: input.entryPrice,
      maxValue: input.maxValue,
      dipPct: input.dipPct,
      clipSize: input.clipSize,
      sizeUnit: input.sizeUnit,
      sizeMultiplier: input.sizeMultiplier,
      deviationMultiplier: input.deviationMultiplier,
    });
    return until !== null ? Math.min(until, DCA_LADDER_CHECK_MAX) : 1;
  }
  return 1;
}

export type DcaOverMaxOrder = {
  side: FuturesSide;
  orderNumber: number;
  qty: number;
  maxQty: number;
  orderType: "market" | "limit";
};

export function dcaClipOrderType(
  clipIndex: number,
  restGrid: boolean,
): "market" | "limit" {
  return restGrid && clipIndex >= 1 ? "limit" : "market";
}

export function dcaFirstOrderOverMaxQty(input: {
  side: FuturesSide;
  entryPrice: number;
  maxClips: number | null;
  maxValue: number | null;
  dipPct: number | null;
  clipSize: number;
  sizeUnit: "qty" | "usdt";
  sizeMultiplier: number;
  deviationMultiplier: number;
  restGrid: boolean;
  maxQty: number;
  maxMktQty: number;
}): DcaOverMaxOrder | null {
  if (
    !(input.clipSize > 0) ||
    !(input.sizeMultiplier > 0) ||
    !(input.entryPrice > 0)
  ) {
    return null;
  }
  const count = dcaPlannedOrderCount(input);
  const prices = dcaLadderOrderPrices({
    side: input.side,
    entryPrice: input.entryPrice,
    count,
    dipPct: input.dipPct,
    deviationMultiplier: input.deviationMultiplier,
  });
  for (let i = 0; i < count; i += 1) {
    const price = prices[i] ?? input.entryPrice;
    const qty = dcaClipQtyAt(
      i,
      input.clipSize,
      input.sizeMultiplier,
      input.sizeUnit,
      price,
    );
    const orderType = dcaClipOrderType(i, input.restGrid);
    const cap = perpEffectiveMaxQty({
      maxQty: input.maxQty,
      maxMktQty: input.maxMktQty,
      orderType,
    });
    if (cap > 0 && qty > cap) {
      return {
        side: input.side,
        orderNumber: i + 1,
        qty,
        maxQty: cap,
        orderType,
      };
    }
  }
  return null;
}

export function dcaLadderMaxOrderError(input: {
  sides: readonly FuturesSide[];
  entryPrice: number;
  maxClips: number | null;
  maxValue: number | null;
  dipPct: number | null;
  clipSize: number;
  sizeUnit: "qty" | "usdt";
  sizeMultiplier: number;
  deviationMultiplier: number;
  restGrid: boolean;
  maxQty: number;
  maxMktQty: number;
  baseCoin: string;
}): string | null {
  for (const side of input.sides) {
    const hit = dcaFirstOrderOverMaxQty({ ...input, side });
    if (!hit) {
      continue;
    }
    const qtyText = formatPerpMinQty(hit.qty);
    const maxText = formatPerpMinQty(hit.maxQty);
    const entry = `Entry # ${hit.orderNumber}`;
    const label =
      input.sides.length > 1
        ? `${hit.side === "long" ? "Long" : "Short"} ${entry}`
        : entry;
    const kind = hit.orderType === "market" ? "market maximum" : "maximum";
    return `${label} is ${qtyText} ${input.baseCoin}, above the ${maxText} ${input.baseCoin} ${kind}.`;
  }
  return null;
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

export function dcaTighterStopPrice(input: {
  side: FuturesSide;
  current: number | null;
  candidate: number | null;
}): number | null {
  if (input.candidate === null || !(input.candidate > 0)) {
    return input.current !== null && input.current > 0 ? input.current : null;
  }
  if (input.current === null || !(input.current > 0)) {
    return input.candidate;
  }
  return input.side === "long"
    ? Math.max(input.current, input.candidate)
    : Math.min(input.current, input.candidate);
}

export function dcaTighterTrailingDistance(
  current: number | null,
  candidate: number | null,
): number | null {
  if (candidate === null || !(candidate > 0)) {
    return current !== null && current > 0 ? current : null;
  }
  if (current === null || !(current > 0)) {
    return candidate;
  }
  return Math.min(current, candidate);
}

export function dcaTighterTrailingActivation(input: {
  side: FuturesSide;
  current: number | null;
  candidate: number | null;
}): number | null {
  if (input.candidate === null || !(input.candidate > 0)) {
    return input.current !== null && input.current > 0 ? input.current : null;
  }
  if (input.current === null || !(input.current > 0)) {
    return input.candidate;
  }
  return input.side === "long"
    ? Math.max(input.current, input.candidate)
    : Math.min(input.current, input.candidate);
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
