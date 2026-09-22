export type DeskBlotterBotOption = {
  id: string;
  name: string;
};

export const DESK_BLOTTER_ALL_BOTS_LABEL = "Desk Wide (all bots)";

export type DeskBlotterFilters = {
  bot: string;
  pair: string;
  side: "" | "long" | "short";
};

export const EMPTY_DESK_BLOTTER_FILTERS: DeskBlotterFilters = {
  bot: "",
  pair: "",
  side: "",
};

function firstParam(
  value: string | string[] | undefined | null,
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw ?? "").trim();
}

export function parseDeskBlotterFilters(
  params: Record<string, string | string[] | undefined> | null | undefined,
): DeskBlotterFilters {
  const sideRaw = firstParam(params?.side).toLowerCase();
  return {
    bot: firstParam(params?.bot),
    pair: firstParam(params?.pair),
    side: sideRaw === "long" || sideRaw === "short" ? sideRaw : "",
  };
}

export function deskBlotterFiltersActive(filters: DeskBlotterFilters): boolean {
  return Boolean(filters.bot || filters.pair || filters.side);
}

export function matchDeskBlotterRow(
  row: {
    botId?: string | null;
    pair: string;
    side?: string | null;
  },
  filters: DeskBlotterFilters,
): boolean {
  if (filters.bot && (row.botId ?? "") !== filters.bot) {
    return false;
  }
  if (filters.side && (row.side ?? "").toLowerCase() !== filters.side) {
    return false;
  }
  if (filters.pair) {
    const needle = filters.pair.toLowerCase();
    if (!row.pair.toLowerCase().includes(needle)) {
      return false;
    }
  }
  return true;
}

export function resolveFuturesRowBotId(
  row: {
    ruleId: string | null;
    ruleName: string | null;
    symbol: string;
    side: string;
    source: string;
  },
  playbooks: readonly {
    id: string;
    name: string;
    symbol: string;
    direction: string;
  }[],
  hintPlaybookId?: string | null,
): string | null {
  if (row.ruleId) {
    return row.ruleId;
  }
  if (hintPlaybookId) {
    return hintPlaybookId;
  }
  if (row.source !== "engine" && !row.ruleName) {
    return null;
  }
  const matches = playbooks.filter((playbook) => {
    if (playbook.symbol !== row.symbol) {
      return false;
    }
    return playbook.direction === "both" || playbook.direction === row.side;
  });
  if (matches.length === 1) {
    return matches[0]?.id ?? null;
  }
  return matches.find((playbook) => playbook.name === row.ruleName)?.id ?? null;
}

export function filterFuturesBlotterRows<
  T extends {
    ruleId: string | null;
    ruleName: string | null;
    symbol: string;
    side: string;
    source: string;
  },
>(
  rows: readonly T[],
  filters: DeskBlotterFilters,
  playbooks: readonly {
    id: string;
    name: string;
    symbol: string;
    direction: string;
  }[] = [],
  hintPlaybookId?: (row: T) => string | null | undefined,
): T[] {
  if (!deskBlotterFiltersActive(filters)) {
    return [...rows];
  }
  return rows.filter((row) =>
    matchDeskBlotterRow(
      {
        botId: resolveFuturesRowBotId(
          row,
          playbooks,
          hintPlaybookId?.(row) ?? null,
        ),
        pair: row.symbol,
        side: row.side,
      },
      filters,
    ),
  );
}

export function filterFuturesWorkingRows<
  T extends {
    symbol: string;
    side: string;
    source: string;
    ruleName: string | null;
  },
>(
  rows: readonly T[],
  filters: DeskBlotterFilters,
  playbooks: readonly {
    id: string;
    name: string;
    symbol: string;
    direction: string;
  }[] = [],
  hintPlaybookId?: (row: T) => string | null | undefined,
): T[] {
  if (!deskBlotterFiltersActive(filters)) {
    return [...rows];
  }
  return rows.filter((row) =>
    matchDeskBlotterRow(
      {
        botId: resolveFuturesRowBotId(
          {
            ruleId: null,
            ruleName: row.ruleName,
            symbol: row.symbol,
            side: row.side,
            source: row.source,
          },
          playbooks,
          hintPlaybookId?.(row) ?? null,
        ),
        pair: row.symbol,
        side: row.side,
      },
      filters,
    ),
  );
}

export function filterPaperBlotterRows<
  T extends {
    ruleId: number | null;
    baseCoin: string;
    spotSymbol: string;
    futureSymbol: string;
  },
>(rows: readonly T[], filters: DeskBlotterFilters): T[] {
  return rows.filter((row) =>
    matchDeskBlotterRow(
      {
        botId: row.ruleId == null ? null : String(row.ruleId),
        pair: `${row.baseCoin} ${row.spotSymbol} ${row.futureSymbol}`,
      },
      filters,
    ),
  );
}
