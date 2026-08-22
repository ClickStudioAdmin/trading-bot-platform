import { applyOpportunityFilters } from "@/lib/opportunities/filter";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import { pairKey } from "@/lib/paper/open";

export type PaperEngineRules = {
  enabled: boolean;
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

export type EngineOpenPosition = {
  spotSymbol: string;
  futureSymbol: string;
  notionalUsdt: number;
};

export type EngineMarkedPosition = EngineOpenPosition & {
  daysToExpiry: number | null;
  markNetApr: number | null;
  pnlPct: number | null;
};

export type ExitReason = "dte" | "mark_apr" | "take_profit" | "stop_loss";

export type EngineExit = {
  position: EngineMarkedPosition;
  reason: ExitReason;
};

export function decideEntries(
  scan: ScannedOpportunity[],
  opens: EngineOpenPosition[],
  rules: PaperEngineRules,
): ScannedOpportunity[] {
  if (!rules.enabled || !(rules.notionalUsdt > 0)) {
    return [];
  }

  const taken = new Set(
    opens.map((row) => pairKey(row.spotSymbol, row.futureSymbol)),
  );
  const filtered = applyOpportunityFilters(scan, {
    minNetApr: rules.minNetApr,
    minDte: rules.minDte,
    maxDte: rules.maxDte,
    minCapacityUsdt: rules.minCapacityUsdt,
  })
    .filter((row) => !taken.has(pairKey(row.spotSymbol, row.futureSymbol)))
    .sort((a, b) => (b.netApr ?? Number.NEGATIVE_INFINITY) - (a.netApr ?? Number.NEGATIVE_INFINITY));

  const usedCount = opens.length;
  const usedNotional = opens.reduce((sum, row) => sum + row.notionalUsdt, 0);
  const chosen: ScannedOpportunity[] = [];

  for (const row of filtered) {
    const nextCount = usedCount + chosen.length + 1;
    const nextNotional = usedNotional + (chosen.length + 1) * rules.notionalUsdt;
    if (rules.maxOpenCount !== null && nextCount > rules.maxOpenCount) {
      break;
    }
    if (
      rules.maxOpenNotionalUsdt !== null &&
      nextNotional > rules.maxOpenNotionalUsdt
    ) {
      break;
    }
    chosen.push(row);
  }

  return chosen;
}

export function decideExits(
  positions: EngineMarkedPosition[],
  rules: PaperEngineRules,
): EngineExit[] {
  if (!rules.enabled) {
    return [];
  }

  const exits: EngineExit[] = [];
  for (const position of positions) {
    const reason = exitReason(position, rules);
    if (reason) {
      exits.push({ position, reason });
    }
  }
  return exits;
}

function exitReason(
  position: EngineMarkedPosition,
  rules: PaperEngineRules,
): ExitReason | null {
  if (
    rules.closeMaxDte !== null &&
    position.daysToExpiry !== null &&
    position.daysToExpiry <= rules.closeMaxDte
  ) {
    return "dte";
  }
  if (
    rules.closeMinNetApr !== null &&
    position.markNetApr !== null &&
    position.markNetApr < rules.closeMinNetApr
  ) {
    return "mark_apr";
  }
  if (
    rules.takeProfitPct !== null &&
    position.pnlPct !== null &&
    position.pnlPct >= rules.takeProfitPct
  ) {
    return "take_profit";
  }
  if (
    rules.stopLossPct !== null &&
    position.pnlPct !== null &&
    position.pnlPct <= rules.stopLossPct
  ) {
    return "stop_loss";
  }
  return null;
}
