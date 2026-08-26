import type { FuturesSide } from "@/lib/futures/model";

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
