import { applyOpportunityFilters } from "@/lib/opportunities/filter";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import { pairKey } from "@/lib/paper/open";

export type PaperEngineLayer = {
  id: number | null;
  sortOrder: number;
  notionalUsdt: number;
  minNetApr: number | null;
  minDte: number | null;
  maxDte: number | null;
  minCapacityUsdt: number | null;
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
  spotSymbol: string;
  futureSymbol: string;
  notionalUsdt: number;
  ruleId: number | null;
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
  exits?: PositionExits;
};

export type EngineEntry = {
  opportunity: ScannedOpportunity;
  layer: PaperEngineLayer;
};

export type ExitReason = "dte" | "mark_apr" | "take_profit" | "stop_loss";

export type EngineExit = {
  position: EngineMarkedPosition;
  reason: ExitReason;
};

export function decideEntries(
  scan: ScannedOpportunity[],
  opens: EngineOpenPosition[],
  config: PaperEngineConfig,
): EngineEntry[] {
  if (!config.enabled) {
    return [];
  }

  const taken = new Set(
    opens.map((row) => pairKey(row.spotSymbol, row.futureSymbol)),
  );
  const ranked = [...scan].sort(
    (a, b) =>
      (b.netApr ?? Number.NEGATIVE_INFINITY) -
      (a.netApr ?? Number.NEGATIVE_INFINITY),
  );
  const usedByLayer = new Map<string, { count: number; notional: number }>();
  for (const open of opens) {
    if (open.ruleId === null) {
      continue;
    }
    const key = layerUsageKey({ id: open.ruleId, sortOrder: 0 });
    const used = usedByLayer.get(key) ?? { count: 0, notional: 0 };
    used.count += 1;
    used.notional += open.notionalUsdt;
    usedByLayer.set(key, used);
  }

  const chosen: EngineEntry[] = [];
  for (const opportunity of ranked) {
    if (taken.has(pairKey(opportunity.spotSymbol, opportunity.futureSymbol))) {
      continue;
    }
    const layer = bestMatchingLayer(opportunity, config.layers);
    if (!layer || !(layer.notionalUsdt > 0)) {
      continue;
    }
    const key = layerUsageKey(layer);
    const used = usedByLayer.get(key) ?? { count: 0, notional: 0 };
    if (layer.maxOpenCount !== null && used.count + 1 > layer.maxOpenCount) {
      continue;
    }
    if (
      layer.maxOpenNotionalUsdt !== null &&
      used.notional + layer.notionalUsdt > layer.maxOpenNotionalUsdt
    ) {
      continue;
    }
    usedByLayer.set(key, {
      count: used.count + 1,
      notional: used.notional + layer.notionalUsdt,
    });
    taken.add(pairKey(opportunity.spotSymbol, opportunity.futureSymbol));
    chosen.push({ opportunity, layer });
  }
  return chosen;
}

export function decideExits(
  positions: EngineMarkedPosition[],
  config: PaperEngineConfig,
): EngineExit[] {
  if (!config.enabled) {
    return [];
  }

  const byId = new Map(
    config.layers
      .filter((layer) => layer.id !== null)
      .map((layer) => [layer.id, layer]),
  );
  const exits: EngineExit[] = [];
  for (const position of positions) {
    if (position.ruleId === null) {
      continue;
    }
    const layer = byId.get(position.ruleId);
    if (!layer) {
      continue;
    }
    const reason = exitReason(position, position.exits ?? layer);
    if (reason) {
      exits.push({ position, reason });
    }
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
      minCapacityUsdt: layer.minCapacityUsdt,
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
