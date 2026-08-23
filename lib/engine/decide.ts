import { unwindClipUsdt } from "@/lib/engine/clip";
import { applyOpportunityFilters } from "@/lib/opportunities/filter";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import { pairKey } from "@/lib/paper/open";

export type PaperSizeType = "fixed" | "dynamic";

export type PaperEngineLayer = {
  id: number | null;
  name: string;
  sortOrder: number;
  sizeType: PaperSizeType;
  exitSizeType: PaperSizeType;
  notionalUsdt: number;
  minNetApr: number | null;
  minDte: number | null;
  maxDte: number | null;
  minCapacityUsdt: number | null;
  minSizeUsdt: number | null;
  maxOpenCount: number | null;
  maxOpenNotionalUsdt: number | null;
  closeMaxDte: number | null;
  closeMinNetApr: number | null;
  takeProfitPct: number | null;
  stopLossPct: number | null;
};

export type PaperEngineConfig = {
  enabled: boolean;
  layers: PaperEngineLayer[];
};

export type EngineOpenPosition = {
  id?: number;
  spotSymbol: string;
  futureSymbol: string;
  notionalUsdt: number;
  ruleId: number | null;
  unwinding?: boolean;
  openedAtMs?: number;
};

export type PositionExits = {
  closeMaxDte: number | null;
  closeMinNetApr: number | null;
  takeProfitPct: number | null;
  stopLossPct: number | null;
};

export type EngineMarkedPosition = EngineOpenPosition & {
  daysToExpiry: number | null;
  markNetApr: number | null;
  pnlPct: number | null;
  capacityUsdt?: number | null;
  openedAtMs?: number;
  exits?: PositionExits;
};

export type EngineEntry = {
  opportunity: ScannedOpportunity;
  layer: PaperEngineLayer;
  notionalUsdt: number;
  carryId: number | null;
};

export type ExitReason =
  | "dte"
  | "mark_apr"
  | "take_profit"
  | "stop_loss"
  | "unwind";

export type EngineExit = {
  position: EngineMarkedPosition;
  reason: ExitReason;
  closeNotionalUsdt: number;
};

export function decideEntries(
  scan: ScannedOpportunity[],
  opens: EngineOpenPosition[],
  config: PaperEngineConfig,
): EngineEntry[] {
  if (!config.enabled) {
    return [];
  }

  const occupied = new Set(
    opens.map((row) => pairKey(row.spotSymbol, row.futureSymbol)),
  );
  const unwindingPairs = new Set(
    opens
      .filter((row) => row.unwinding)
      .map((row) => pairKey(row.spotSymbol, row.futureSymbol)),
  );
  const clippedThisTick = new Set<string>();
  const ranked = [...scan].sort(
    (a, b) =>
      (b.netApr ?? Number.NEGATIVE_INFINITY) -
      (a.netApr ?? Number.NEGATIVE_INFINITY),
  );
  const usedByLayer = new Map<
    string,
    { pairs: Set<string>; notional: number }
  >();
  for (const open of opens) {
    if (open.ruleId === null) {
      continue;
    }
    const key = layerUsageKey({ id: open.ruleId, sortOrder: 0 });
    const used = usedByLayer.get(key) ?? { pairs: new Set(), notional: 0 };
    used.pairs.add(pairKey(open.spotSymbol, open.futureSymbol));
    used.notional += open.notionalUsdt;
    usedByLayer.set(key, used);
  }

  const chosen: EngineEntry[] = [];
  for (const opportunity of ranked) {
    const pair = pairKey(opportunity.spotSymbol, opportunity.futureSymbol);
    if (unwindingPairs.has(pair)) {
      continue;
    }
    const layer = bestMatchingLayer(opportunity, config.layers);
    if (!layer) {
      continue;
    }
    if (layer.sizeType === "fixed" && occupied.has(pair)) {
      continue;
    }
    if (layer.sizeType === "dynamic" && clippedThisTick.has(pair)) {
      continue;
    }
    const key = layerUsageKey(layer);
    const used = usedByLayer.get(key) ?? { pairs: new Set(), notional: 0 };
    const pairHeld = used.pairs.has(pair);
    const maxPairs = layer.maxOpenCount ?? 1;
    if (!pairHeld && used.pairs.size >= maxPairs) {
      continue;
    }
    const remainingUsdt =
      layer.maxOpenNotionalUsdt === null
        ? null
        : layer.maxOpenNotionalUsdt - used.notional;
    const notionalUsdt = entryNotionalUsdt(layer, opportunity, remainingUsdt);
    if (notionalUsdt === null) {
      continue;
    }
    const carryId = pairHeld
      ? existingCarryId(opens, layer.id, pair)
      : null;
    if (pairHeld && carryId === null) {
      continue;
    }
    const nextPairs = new Set(used.pairs);
    nextPairs.add(pair);
    usedByLayer.set(key, {
      pairs: nextPairs,
      notional: used.notional + notionalUsdt,
    });
    if (layer.sizeType === "fixed") {
      occupied.add(pair);
    } else {
      clippedThisTick.add(pair);
    }
    chosen.push({ opportunity, layer, notionalUsdt, carryId });
  }
  return chosen;
}

export function decideExits(
  positions: EngineMarkedPosition[],
  config: PaperEngineConfig,
): EngineExit[] {
  const byId = new Map(
    config.layers
      .filter((layer) => layer.id !== null)
      .map((layer) => [layer.id, layer]),
  );
  const candidates: {
    position: EngineMarkedPosition;
    reason: ExitReason;
    layer: PaperEngineLayer | null;
  }[] = [];
  for (const position of positions) {
    if (position.unwinding) {
      candidates.push({
        position,
        reason: "unwind",
        layer: position.ruleId !== null ? (byId.get(position.ruleId) ?? null) : null,
      });
      continue;
    }
    if (!config.enabled || position.ruleId === null) {
      continue;
    }
    const layer = byId.get(position.ruleId);
    if (!layer) {
      continue;
    }
    const reason = exitReason(position, position.exits ?? layer);
    if (reason) {
      candidates.push({ position, reason, layer });
    }
  }
  candidates.sort((a, b) => {
    const pairDelta = pairKey(
      a.position.spotSymbol,
      a.position.futureSymbol,
    ).localeCompare(pairKey(b.position.spotSymbol, b.position.futureSymbol));
    if (pairDelta !== 0) {
      return pairDelta;
    }
    return (a.position.openedAtMs ?? 0) - (b.position.openedAtMs ?? 0);
  });

  const bookLeft = new Map<string, number>();
  const exits: EngineExit[] = [];
  for (const { position, reason, layer } of candidates) {
    const closeNotionalUsdt = exitNotionalUsdt(layer, position, bookLeft);
    if (closeNotionalUsdt === null) {
      continue;
    }
    exits.push({ position, reason, closeNotionalUsdt });
  }
  return exits;
}

export function bestMatchingLayer(
  opportunity: ScannedOpportunity,
  layers: PaperEngineLayer[],
): PaperEngineLayer | null {
  const matches = layers.filter((layer) =>
    applyOpportunityFilters([opportunity], {
      minNetApr: layer.minNetApr,
      minDte: layer.minDte,
      maxDte: layer.maxDte,
      minCapacityUsdt:
        layer.sizeType === "dynamic" ? null : layer.minCapacityUsdt,
    }).length > 0,
  );
  if (matches.length === 0) {
    return null;
  }
  return [...matches].sort((a, b) => {
    const aprDelta =
      (b.minNetApr ?? Number.NEGATIVE_INFINITY) -
      (a.minNetApr ?? Number.NEGATIVE_INFINITY);
    if (aprDelta !== 0) {
      return aprDelta;
    }
    return a.sortOrder - b.sortOrder;
  })[0] ?? null;
}

export function entryNotionalUsdt(
  layer: PaperEngineLayer,
  opportunity: ScannedOpportunity,
  remainingUsdt: number | null = null,
): number | null {
  if (layer.sizeType !== "dynamic") {
    if (!(layer.notionalUsdt > 0)) {
      return null;
    }
    if (remainingUsdt !== null && layer.notionalUsdt > remainingUsdt) {
      return null;
    }
    return layer.notionalUsdt;
  }
  const room =
    remainingUsdt === null
      ? opportunity.capacityUsdt
      : Math.min(opportunity.capacityUsdt, remainingUsdt);
  if (!(room > 0)) {
    return null;
  }
  if (layer.minSizeUsdt !== null && room < layer.minSizeUsdt) {
    return null;
  }
  return room;
}

function exitNotionalUsdt(
  layer: PaperEngineLayer | null,
  position: EngineMarkedPosition,
  bookLeft: Map<string, number>,
): number | null {
  if (!(position.notionalUsdt > 0)) {
    return null;
  }
  const dynamic = position.unwinding || layer?.exitSizeType === "dynamic";
  if (!dynamic) {
    return position.notionalUsdt;
  }
  const pair = pairKey(position.spotSymbol, position.futureSymbol);
  const book = bookLeft.has(pair)
    ? bookLeft.get(pair)!
    : (position.capacityUsdt ?? 0);
  const clip = unwindClipUsdt(
    position.notionalUsdt,
    book,
    position.unwinding && position.ruleId === null
      ? null
      : (layer?.minSizeUsdt ?? null),
  );
  if (clip === null) {
    return null;
  }
  bookLeft.set(pair, book - clip);
  return clip;
}

function existingCarryId(
  opens: EngineOpenPosition[],
  layerId: number | null,
  pair: string,
): number | null {
  if (layerId === null) {
    return null;
  }
  const matches = opens.filter(
    (row) =>
      row.id !== undefined &&
      !row.unwinding &&
      row.ruleId === layerId &&
      pairKey(row.spotSymbol, row.futureSymbol) === pair,
  );
  if (matches.length === 0) {
    return null;
  }
  return [...matches].sort((a, b) => {
    const openedDelta = (a.openedAtMs ?? 0) - (b.openedAtMs ?? 0);
    if (openedDelta !== 0) {
      return openedDelta;
    }
    return (a.id ?? 0) - (b.id ?? 0);
  })[0]?.id ?? null;
}

function layerUsageKey(layer: { id: number | null; sortOrder: number }): string {
  return layer.id !== null ? `id:${layer.id}` : `tmp:${layer.sortOrder}`;
}

function exitReason(
  position: EngineMarkedPosition,
  exits: PositionExits,
): ExitReason | null {
  if (
    exits.closeMaxDte !== null &&
    position.daysToExpiry !== null &&
    position.daysToExpiry <= exits.closeMaxDte
  ) {
    return "dte";
  }
  if (
    exits.closeMinNetApr !== null &&
    position.markNetApr !== null &&
    position.markNetApr < exits.closeMinNetApr
  ) {
    return "mark_apr";
  }
  if (
    exits.takeProfitPct !== null &&
    position.pnlPct !== null &&
    position.pnlPct >= exits.takeProfitPct
  ) {
    return "take_profit";
  }
  if (
    exits.stopLossPct !== null &&
    position.pnlPct !== null &&
    position.pnlPct <= exits.stopLossPct
  ) {
    return "stop_loss";
  }
  return null;
}
