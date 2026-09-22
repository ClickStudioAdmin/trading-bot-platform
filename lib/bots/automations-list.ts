import { automationsBotBlotterHref } from "@/lib/bots/automations-path";
import {
  compareTableNum,
  compareTableText,
  type TableSortDir,
} from "@/lib/table-chrome";
import type { DcaPlaybook } from "@/lib/dca/playbook";
import type { PaperLayerFormValues } from "@/lib/engine/rules";
import type { FuturesAutomationFormValues } from "@/lib/futures/automation";
import {
  dcaStatusFromLegs,
  statusOptionsFor,
  type BotDeskKind,
} from "@/lib/bots/status";
import {
  filterFuturesBlotterRows,
  filterPaperBlotterRows,
} from "@/lib/desk-blotter-filters";
import { futuresClosedStats } from "@/lib/futures/stats";
import type { FuturesPosition } from "@/lib/futures/model";
import { paperDeskStats } from "@/lib/paper/rows";
import type { PaperCarryRow } from "@/lib/paper/rows";

export type AutomationsBotBlotter = {
  positionCount: number;
  roePct: number | null;
};

export type AutomationsBotSortRow = {
  name: string;
  pair: string;
  status: string;
  summary: string;
  positionCount: number;
  roePct: number | null;
};

export function compareAutomationsBot(
  left: AutomationsBotSortRow,
  right: AutomationsBotSortRow,
  key: string,
  dir: TableSortDir,
): number {
  if (key === "name") {
    return compareTableText(left.name || "Bot", right.name || "Bot", dir);
  }
  if (key === "pair") {
    return compareTableText(left.pair, right.pair, dir);
  }
  if (key === "recipe") {
    return compareTableText(left.summary, right.summary, dir);
  }
  if (key === "status") {
    return compareTableText(left.status, right.status, dir);
  }
  if (key === "positions") {
    return compareTableNum(left.positionCount, right.positionCount, dir);
  }
  if (key === "performance") {
    if (left.roePct == null && right.roePct == null) {
      return 0;
    }
    if (left.roePct == null) {
      return 1;
    }
    if (right.roePct == null) {
      return -1;
    }
    return compareTableNum(left.roePct, right.roePct, dir);
  }
  return 0;
}

export const EMPTY_AUTOMATIONS_BOT_BLOTTER: AutomationsBotBlotter = {
  positionCount: 0,
  roePct: null,
};

type FuturesBlotterRow = {
  ruleId: string | null;
  ruleName: string | null;
  symbol: string;
  side: string;
  source: string;
};

type FuturesClosedBlotterRow = FuturesBlotterRow & {
  realizedUsdt: number;
  notionalUsdt: number;
  leverage: number | null;
  openedAtMs: number;
  closedAtMs: number | null;
};

type PaperBlotterRow = {
  ruleId: number | null;
  baseCoin: string;
  spotSymbol: string;
  futureSymbol: string;
  notionalUsdt: number;
  realizedUsdt?: number | null;
};

export function futuresAutomationsBotBlotter(
  botId: string,
  open: readonly FuturesBlotterRow[],
  closed: readonly FuturesClosedBlotterRow[],
  playbooks: readonly {
    id: string;
    name: string;
    symbol: string;
    direction: string;
  }[] = [],
  hintPlaybookId?: (row: FuturesBlotterRow) => string | null | undefined,
  fallbackLeverage: number | null = null,
): AutomationsBotBlotter {
  const filters = { bot: botId, pair: "", side: "" as const };
  const openRows = filterFuturesBlotterRows(
    open,
    filters,
    playbooks,
    hintPlaybookId,
  );
  const closedRows = filterFuturesBlotterRows(
    closed,
    filters,
    playbooks,
    undefined,
    { inferBot: false },
  );
  return {
    positionCount: openRows.length,
    roePct: futuresClosedStats(
      closedRows as unknown as FuturesPosition[],
      fallbackLeverage,
    ).roePct,
  };
}

export function paperAutomationsBotBlotter(
  botId: string,
  open: readonly PaperBlotterRow[],
  closed: readonly PaperBlotterRow[],
): AutomationsBotBlotter {
  const filters = { bot: botId, pair: "", side: "" as const };
  return {
    positionCount: filterPaperBlotterRows(open, filters).length,
    roePct: paperDeskStats(
      [],
      filterPaperBlotterRows(closed, filters) as PaperCarryRow[],
    ).realizedPct,
  };
}

export function automationsBotBlotterCells(
  botId: string,
  blotter: Record<string, AutomationsBotBlotter> | undefined,
  positionsPath: string,
  performancePath: string,
  accountId?: string,
): {
  positionCount: number;
  roePct: number | null;
  positionsHref: string;
  performanceHref: string;
} {
  const stats = blotter?.[botId] ?? EMPTY_AUTOMATIONS_BOT_BLOTTER;
  return {
    positionCount: stats.positionCount,
    roePct: stats.roePct,
    positionsHref: automationsBotBlotterHref(positionsPath, accountId, botId),
    performanceHref: automationsBotBlotterHref(
      performancePath,
      accountId,
      botId,
    ),
  };
}

const PERPS_ACTION_LABEL: Record<
  FuturesAutomationFormValues["formAction"],
  string
> = {
  buy: "Buy",
  sell: "Sell",
  close_long: "Close long",
  close_short: "Close short",
};

const PERPS_ENTRY_LABEL: Record<string, string> = {
  price: "Price",
  webhook: "Signal",
  indicator: "Indicator",
  trend: "Trend",
};

const DCA_START_LABEL: Record<string, string> = {
  immediate: "Immediate",
  price: "Price",
  webhook: "Signal",
  indicator: "Indicator",
  trend: "Trend",
};

export function botModeLabel(desk: BotDeskKind, mode: string): string {
  return (
    statusOptionsFor(desk).find((option) => option.value === mode)?.label ??
    mode
  );
}

export function paperBotPair(): string {
  return "Carry";
}

export function paperBotSummary(layer: PaperLayerFormValues): string {
  const bits: string[] = [];
  if (layer.minApr.trim()) {
    bits.push(`Min APR ${layer.minApr}%`);
  }
  const minDte = layer.minDte.trim();
  const maxDte = layer.maxDte.trim();
  if (minDte || maxDte) {
    bits.push(`DTE ${minDte || "0"}–${maxDte || "∞"}`);
  }
  bits.push(layer.sizeType === "fixed" ? `${layer.notionalUsdt} USDT` : "Dynamic size");
  if (layer.maxOpenCount.trim()) {
    bits.push(`Max ${layer.maxOpenCount}`);
  }
  return bits.join(" · ");
}

export function perpsBotPair(rule: FuturesAutomationFormValues): string {
  return `${rule.symbol} · ${PERPS_ACTION_LABEL[rule.formAction]}`;
}

export function perpsBotSummary(rule: FuturesAutomationFormValues): string {
  const entry = PERPS_ENTRY_LABEL[rule.entrySource] ?? "Price";
  const size = rule.size.trim()
    ? `${rule.size}${rule.sizeUnit === "usdt" ? " USDT" : ""}`
    : "";
  return [PERPS_ACTION_LABEL[rule.formAction], entry, rule.orderType, size]
    .filter(Boolean)
    .join(" · ");
}

export function dcaBotPair(playbook: Pick<DcaPlaybook, "symbol" | "direction">): string {
  const side =
    playbook.direction === "both"
      ? "Both"
      : playbook.direction === "short"
        ? "Short"
        : "Long";
  return `${playbook.symbol} · ${side}`;
}

export function dcaListStatus(playbook: DcaPlaybook): string {
  return botModeLabel(
    "dca",
    dcaStatusFromLegs({
      armed:
        playbook.long.status === "armed" || playbook.short.status === "armed",
      stopAdding:
        playbook.long.status === "stop_adding" ||
        playbook.short.status === "stop_adding",
    }),
  );
}

export function dcaBotSummary(playbook: DcaPlaybook): string {
  const start = DCA_START_LABEL[playbook.startKind] ?? "Immediate";
  const clips =
    playbook.maxClips != null
      ? `${playbook.maxClips} clips`
      : playbook.maxValue != null
        ? `Max ${playbook.maxValue}`
        : "";
  const dip = playbook.dipPct != null ? `${playbook.dipPct}% dip` : "";
  return [start, clips, dip].filter(Boolean).join(" · ");
}
