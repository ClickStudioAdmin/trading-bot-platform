import { automationsBotBlotterHref } from "@/lib/bots/automations-path";
import {
  compareTableNum,
  compareTableText,
  pruneRemovedIds,
  type TableSortDir,
} from "@/lib/table-chrome";
import type { DcaPlaybook } from "@/lib/dca/playbook";
import type { PaperLayerFormValues } from "@/lib/engine/rules";
import { parsePaperRulesForm } from "@/lib/engine/rules";
import type { FuturesAutomationFormValues } from "@/lib/futures/automation";
import {
  paperFormToSnapshotSource,
  snapshotPaperRecipe,
  snapshotPerpsRecipe,
  type PaperTemplateRecipe,
  type PerpsTemplateRecipe,
} from "@/lib/templates/recipe";
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

export type AutomationsBotFilters = {
  q: string;
  pair: string;
  status: string;
};

export const EMPTY_AUTOMATIONS_BOT_FILTERS: AutomationsBotFilters = {
  q: "",
  pair: "",
  status: "",
};

const AUTOMATIONS_SORT_KEYS = new Set([
  "name",
  "pair",
  "recipe",
  "status",
  "positions",
  "performance",
]);

export type AutomationsListView = {
  filters: AutomationsBotFilters;
  sortKey: string;
  sortDir: TableSortDir;
  page: number;
  scrollY: number;
};

export const DEFAULT_AUTOMATIONS_LIST_VIEW: AutomationsListView = {
  filters: EMPTY_AUTOMATIONS_BOT_FILTERS,
  sortKey: "name",
  sortDir: "asc",
  page: 1,
  scrollY: 0,
};

export function automationsListViewKey(pathname: string, deskId: string): string {
  return `tbp-automations-list:${pathname}:${deskId}`;
}

export function parseAutomationsListView(raw: unknown): AutomationsListView | null {
  if (typeof raw !== "string" || !raw) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const row = parsed as Record<string, unknown>;
  const filters = row.filters;
  if (!filters || typeof filters !== "object") {
    return null;
  }
  const fields = filters as Record<string, unknown>;
  if (
    typeof fields.q !== "string" ||
    typeof fields.pair !== "string" ||
    typeof fields.status !== "string" ||
    typeof row.sortKey !== "string" ||
    !AUTOMATIONS_SORT_KEYS.has(row.sortKey) ||
    (row.sortDir !== "asc" && row.sortDir !== "desc") ||
    typeof row.page !== "number" ||
    !Number.isInteger(row.page) ||
    row.page < 1 ||
    typeof row.scrollY !== "number" ||
    !Number.isFinite(row.scrollY) ||
    row.scrollY < 0
  ) {
    return null;
  }
  return {
    filters: { q: fields.q, pair: fields.pair, status: fields.status },
    sortKey: row.sortKey,
    sortDir: row.sortDir,
    page: row.page,
    scrollY: row.scrollY,
  };
}

export function serializeAutomationsListView(view: AutomationsListView): string {
  return JSON.stringify(view);
}

export function automationsBotFiltersActive(
  filters: AutomationsBotFilters,
): boolean {
  return Boolean(filters.q.trim() || filters.pair.trim() || filters.status);
}

export function missingById<T extends { id: string | null | undefined }>(
  currentIds: ReadonlySet<string>,
  incoming: readonly T[],
): T[] {
  return incoming.filter((row) => Boolean(row.id) && !currentIds.has(row.id!));
}

/**
 * The bots list keeps local rows and prepends ones the server just added.
 * A desk change replaces the list. The previous desk's bots must not stay on screen.
 * `omitIds` are rows the user already removed. A stale server payload must not
 * put those rows back, and a later payload that drops them must not leave the
 * local copy on screen.
 */
export function rowsForDesk<T>(input: {
  deskChanged: boolean;
  current: readonly T[];
  incoming: readonly T[];
  id: (row: T) => string | null | undefined;
  omitIds?: ReadonlySet<string>;
}): readonly T[] {
  if (input.deskChanged) {
    return input.incoming;
  }
  const omit = input.omitIds;
  const current =
    omit && omit.size > 0
      ? input.current.filter((row) => {
          const id = input.id(row);
          return !id || !omit.has(id);
        })
      : input.current;
  const seen = new Set(
    current.flatMap((row) => {
      const id = input.id(row);
      return id ? [id] : [];
    }),
  );
  const fresh = missingById(
    seen,
    input.incoming.flatMap((row) => {
      const id = input.id(row);
      if (id && omit?.has(id)) {
        return [];
      }
      return [{ id, row }];
    }),
  ).map((item) => item.row);
  if (fresh.length === 0) {
    return current.length === input.current.length ? input.current : current;
  }
  return [...fresh, ...current];
}

/**
 * Visible bots for one desk. Removed ids stay hidden until both the local
 * list and the server payload have dropped them. A desk change shows that
 * desk's payload and clears the removed set.
 */
export function deskBotRows<T>(input: {
  deskChanged: boolean;
  current: readonly T[];
  incoming: readonly T[];
  removedIds: ReadonlySet<string>;
  id: (row: T) => string | null | undefined;
}): { rows: readonly T[]; removedIds: ReadonlySet<string> } {
  if (input.deskChanged) {
    return {
      rows: input.incoming,
      removedIds:
        input.removedIds.size === 0 ? input.removedIds : new Set<string>(),
    };
  }
  const present: string[] = [];
  for (const row of input.incoming) {
    const id = input.id(row);
    if (id) {
      present.push(id);
    }
  }
  for (const row of input.current) {
    const id = input.id(row);
    if (id) {
      present.push(id);
    }
  }
  const removedIds = pruneRemovedIds(input.removedIds, present);
  return {
    rows: rowsForDesk({
      deskChanged: false,
      current: input.current,
      incoming: input.incoming,
      id: input.id,
      omitIds: removedIds,
    }),
    removedIds,
  };
}

export function filterAutomationsBots<
  T extends {
    name: string;
    pair: string;
    status: string;
    statusKey?: string;
  },
>(rows: readonly T[], filters: AutomationsBotFilters): T[] {
  const q = filters.q.trim().toLowerCase();
  const pair = filters.pair.trim().toLowerCase();
  const status = filters.status.trim();
  if (!q && !pair && !status) {
    return [...rows];
  }
  return rows.filter((row) => {
    if (q && !(row.name || "Bot").toLowerCase().includes(q)) {
      return false;
    }
    if (pair && !row.pair.toLowerCase().includes(pair)) {
      return false;
    }
    if (status && (row.statusKey ?? row.status) !== status) {
      return false;
    }
    return true;
  });
}

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

type PlaybookOwner = {
  id: string;
  name: string;
  symbol: string;
  direction: string;
};

/** Closed rows written before DCA stamped rule_id. One current bot, same name and pair. */
export function unstampedClosedBotId(
  row: {
    ruleId: string | null;
    ruleName: string | null;
    symbol: string;
    side: string;
  },
  playbooks: readonly PlaybookOwner[],
): string | null {
  if (row.ruleId) {
    return null;
  }
  const name = String(row.ruleName ?? "").trim();
  if (!name) {
    return null;
  }
  const matches = playbooks.filter((playbook) => {
    if (playbook.symbol !== row.symbol || playbook.name !== name) {
      return false;
    }
    return playbook.direction === "both" || playbook.direction === row.side;
  });
  return matches.length === 1 ? (matches[0]?.id ?? null) : null;
}

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
  const namedRows = closed.filter(
    (row) => unstampedClosedBotId(row, playbooks) === botId,
  );
  return {
    positionCount: openRows.length,
    roePct: futuresClosedStats(
      [...closedRows, ...namedRows] as unknown as FuturesPosition[],
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
  activityPath: string,
  accountId?: string,
): {
  positionCount: number;
  roePct: number | null;
  positionsHref: string;
  performanceHref: string;
  activityHref: string;
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
    activityHref: automationsBotBlotterHref(activityPath, accountId, botId),
  };
}

function perpsListDirection(rule: FuturesAutomationFormValues): string {
  if (rule.formAction === "close_long") return "Close long";
  if (rule.formAction === "close_short") return "Close short";
  if (rule.direction === "both") return "Both";
  if (rule.direction === "short" || rule.formAction === "sell") return "Short";
  return "Long";
}

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

/** Base coin for a USDT perp symbol. Cash and Carry has no locked pair. */
export function botPairBaseCoin(symbol: string): string {
  const raw = symbol.trim();
  if (/usdt$/i.test(raw) && raw.length > 4) {
    return raw.slice(0, -4);
  }
  return raw;
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
  return `${rule.symbol} · ${perpsListDirection(rule)}`;
}

export function perpsBotSummary(rule: FuturesAutomationFormValues): string {
  const entry = PERPS_ENTRY_LABEL[rule.entrySource] ?? "Price";
  const size = rule.size.trim()
    ? `${rule.size}${rule.sizeUnit === "usdt" ? " USDT" : ""}`
    : "";
  return [perpsListDirection(rule), entry, rule.orderType, size]
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

function numberOrNull(value: string): number | null {
  const text = value.trim();
  if (!text) {
    return null;
  }
  const parsed = Number(text.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Recipe shown in the bots-list parameters popup. Same snapshot the backtest queue stores. */
export function perpsListRecipe(
  layer: FuturesAutomationFormValues,
): PerpsTemplateRecipe {
  const closing =
    layer.formAction === "close_long" || layer.formAction === "close_short";
  const action = closing ? "flatten" : layer.formAction === "sell" ? "sell" : "buy";
  const closeSide =
    layer.formAction === "close_short"
      ? "short"
      : layer.formAction === "close_long"
        ? "long"
        : null;
  return snapshotPerpsRecipe({
    name: layer.name,
    symbol: layer.symbol,
    action,
    closeSide,
    orderType: layer.orderType,
    sizeUnit: layer.sizeUnit,
    size: numberOrNull(layer.size),
    limitPrice: numberOrNull(layer.limitPrice),
    entrySource: layer.entrySource,
    triggerBy: layer.triggerBy,
    triggerCompare: layer.triggerCompare,
    triggerPrice: numberOrNull(layer.triggerPrice) ?? 0,
    skipIfOpen: layer.skipIfOpen,
    tpsl: layer.tpsl,
    trailing: layer.trailing,
    indicator: layer.indicator,
    retrace: layer.retrace ?? null,
    addStack: layer.addStack ?? null,
    confirm: layer.confirm,
    entryStack: layer.entryStack,
    exitIf: layer.exitIf,
    exitHard: layer.exitHard ?? null,
    exitStack: layer.exitStack ?? null,
    exitActions: layer.exitActions ?? null,
    breakevenActivationPct: numberOrNull(layer.breakevenActivationPct),
    breakevenOffsetPct: numberOrNull(layer.breakevenOffsetPct),
    direction: layer.direction,
    shortEntry: layer.shortEntry ?? null,
  });
}

/** Recipe shown in the Cash and Carry bots-list parameters popup. */
export function paperListRecipe(
  layer: PaperLayerFormValues,
): PaperTemplateRecipe | null {
  const parsed = parsePaperRulesForm(paperFormToSnapshotSource(layer));
  if (!parsed.ok) {
    return null;
  }
  const engine = parsed.config.layers[0];
  return engine ? snapshotPaperRecipe(engine) : null;
}
