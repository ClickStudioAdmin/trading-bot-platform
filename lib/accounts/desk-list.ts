import type { DeskCloseKind } from "@/lib/accounts/close";
import {
  AUTOMATED_DESK_TYPES,
  MANUAL_DESK_TYPES,
  formatAccountMode,
  formatDeskType,
  type AccountDeleteBlock,
  type DeskType,
  type TradingAccount,
  type TradingAccountMode,
} from "@/lib/accounts/model";
import {
  formatEnvironmentLabel,
  formatVenueLabel,
  type ExchangeConnection,
} from "@/lib/exchanges/connections";
import {
  compareTableNum,
  compareTableText,
  type TableSortDir,
} from "@/lib/table-chrome";

/** Same order as the sidebar: automated types, then manual Perps. */
export const DESK_LIST_TYPES: readonly DeskType[] = [
  ...AUTOMATED_DESK_TYPES,
  ...MANUAL_DESK_TYPES,
];

export type DeskListStatus = "active" | "inactive";

export type DeskListUsage = {
  openCount: number;
  botCount: number;
  workingCount: number;
  botsOn: number;
  futuresConnectionId: string | null;
  strategyConnectionId: string | null;
  blocks: readonly AccountDeleteBlock[];
  sourceClosed?: boolean;
  closeKind?: DeskCloseKind | null;
};

export type DeskListRow = {
  account: TradingAccount;
  openCount: number;
  botCount: number;
  workingCount: number;
  botsOn: number;
  blocks: readonly AccountDeleteBlock[];
  sourceClosed: boolean;
  closeKind: DeskCloseKind | null;
  status: DeskListStatus;
  exchange: string | null;
  connection: string | null;
  environment: string | null;
  /** Venue-specific environment name, when it is longer than the column label. */
  environmentTitle: string | null;
  detailLines: readonly [string, string, string];
};

export type DeskListFilters = {
  name: string;
  type: "all" | DeskType;
  mode: "all" | TradingAccountMode;
  exchange: string;
  environment: string;
  status: "all" | DeskListStatus;
};

export const EMPTY_DESK_LIST_FILTERS: DeskListFilters = {
  name: "",
  type: "all",
  mode: "all",
  exchange: "all",
  environment: "all",
  status: "all",
};

const DCA_ON_STATUSES = new Set(["armed", "stop_adding"]);

/** Matches `dcaLegIsRunning`: a playbook is on when either leg is armed or stop-adding. */
export function dcaLegStatusesOn(
  longStatus: unknown,
  shortStatus: unknown,
): boolean {
  return (
    DCA_ON_STATUSES.has(String(longStatus ?? "")) ||
    DCA_ON_STATUSES.has(String(shortStatus ?? ""))
  );
}

export function deskDetailLines(input: {
  openCount: number;
  botCount: number;
  workingCount: number;
}): readonly [string, string, string] {
  return [
    countLine(input.botCount, "Bot", "Bots"),
    countLine(input.openCount, "Open position", "Open positions"),
    countLine(input.workingCount, "Open order", "Open orders"),
  ];
}

function countLine(count: number, one: string, many: string): string {
  const n = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  return `${n} ${n === 1 ? one : many}`;
}

export function deskListStatus(botsOn: number): DeskListStatus {
  return botsOn > 0 ? "active" : "inactive";
}

export function formatDeskListStatus(status: DeskListStatus): string {
  return status === "active" ? "Active" : "Inactive";
}

export function deskListOptionValue(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  return text || "—";
}

export function boundDeskConnection<T extends { id: string }>(
  usage: Pick<DeskListUsage, "futuresConnectionId" | "strategyConnectionId"> | undefined,
  connections: readonly T[],
): T | null {
  const id = usage?.futuresConnectionId ?? usage?.strategyConnectionId ?? null;
  if (!id) {
    return null;
  }
  return connections.find((row) => row.id === id) ?? null;
}

export function deskExchangeView(
  account: Pick<TradingAccount, "mode" | "venue" | "venueEnvironment">,
  connection: Pick<ExchangeConnection, "label" | "venue" | "environment"> | null,
): {
  exchange: string | null;
  connection: string | null;
  environment: string | null;
  environmentTitle: string | null;
} {
  const venueId = connection?.venue || account.venue;
  const environmentId = connection?.environment || account.venueEnvironment;
  const exchange = venueId ? formatVenueLabel(venueId) : "";
  const label = connection?.label?.trim() || "";
  const place = deskEnvironmentNames(account.mode, venueId, environmentId);
  if (account.mode === "live" && !connection) {
    return { exchange: null, connection: null, ...place };
  }
  return {
    exchange: exchange || label || null,
    connection: label && exchange && label !== exchange ? label : null,
    ...place,
  };
}

/** Column label is Demo, Live, or Paper. Hover keeps a longer venue name. */
function deskEnvironmentNames(
  mode: TradingAccount["mode"],
  venueId: string,
  environmentId: string | null,
): { environment: string | null; environmentTitle: string | null } {
  const id = String(environmentId ?? "").trim();
  if (!id) {
    return {
      environment: mode === "paper" ? "Paper" : null,
      environmentTitle: null,
    };
  }
  const full = formatEnvironmentLabel(venueId, id).replace(/ \(demo\)$/i, "");
  const key = id.toLowerCase();
  const environment =
    key === "demo" || key === "testnet"
      ? "Demo"
      : key === "live" || key === "mainnet" || key === "production"
        ? "Live"
        : full;
  return {
    environment,
    environmentTitle: full === environment ? null : full,
  };
}

export function buildDeskListRow(
  account: TradingAccount,
  usage: DeskListUsage | undefined,
  connections: readonly ExchangeConnection[],
): DeskListRow {
  const openCount = usage?.openCount ?? 0;
  const botCount = usage?.botCount ?? 0;
  const workingCount = usage?.workingCount ?? 0;
  const botsOn = usage?.botsOn ?? 0;
  const blocks = usage?.blocks ?? [];
  const connection = boundDeskConnection(usage, connections);
  const place = deskExchangeView(account, connection);
  return {
    account,
    openCount,
    botCount,
    workingCount,
    botsOn,
    blocks,
    sourceClosed: usage?.sourceClosed ?? false,
    closeKind: usage?.closeKind ?? null,
    status: deskListStatus(botsOn),
    exchange: place.exchange,
    connection: place.connection,
    environment: place.environment,
    environmentTitle: place.environmentTitle,
    detailLines: deskDetailLines({ openCount, botCount, workingCount }),
  };
}

export function deskListFiltersActive(filters: DeskListFilters): boolean {
  return (
    filters.name.trim() !== "" ||
    filters.type !== "all" ||
    filters.mode !== "all" ||
    filters.exchange !== "all" ||
    filters.environment !== "all" ||
    filters.status !== "all"
  );
}

export function filterDeskList(
  rows: readonly DeskListRow[],
  filters: DeskListFilters,
): DeskListRow[] {
  const name = filters.name.trim().toLowerCase();
  return rows.filter((row) => {
    if (name && !row.account.name.toLowerCase().includes(name)) {
      return false;
    }
    if (filters.type !== "all" && row.account.deskType !== filters.type) {
      return false;
    }
    if (filters.mode !== "all" && row.account.mode !== filters.mode) {
      return false;
    }
    if (
      filters.exchange !== "all" &&
      deskListOptionValue(row.exchange) !== filters.exchange
    ) {
      return false;
    }
    if (
      filters.environment !== "all" &&
      deskListOptionValue(row.environment) !== filters.environment
    ) {
      return false;
    }
    if (filters.status !== "all" && row.status !== filters.status) {
      return false;
    }
    return true;
  });
}

export function deskListFilterChoices(rows: readonly DeskListRow[]): {
  types: DeskType[];
  exchanges: string[];
  environments: string[];
} {
  const types = new Set(rows.map((row) => row.account.deskType));
  const exchanges = new Set(rows.map((row) => deskListOptionValue(row.exchange)));
  const environments = new Set(
    rows.map((row) => deskListOptionValue(row.environment)),
  );
  return {
    types: DESK_LIST_TYPES.filter((type) => types.has(type)),
    exchanges: [...exchanges].sort((left, right) => left.localeCompare(right)),
    environments: [...environments].sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

export function compareDeskList(
  left: DeskListRow,
  right: DeskListRow,
  key: string,
  dir: TableSortDir,
): number {
  if (key === "name") {
    return compareTableText(left.account.name, right.account.name, dir);
  }
  if (key === "type") {
    return compareTableText(
      formatDeskType(left.account.deskType),
      formatDeskType(right.account.deskType),
      dir,
    );
  }
  if (key === "mode") {
    return compareTableText(
      formatAccountMode(left.account.mode),
      formatAccountMode(right.account.mode),
      dir,
    );
  }
  if (key === "exchange") {
    return (
      compareTableText(
        deskListOptionValue(left.exchange),
        deskListOptionValue(right.exchange),
        dir,
      ) ||
      compareTableText(left.connection ?? "", right.connection ?? "", dir)
    );
  }
  if (key === "environment") {
    return compareTableText(
      deskListOptionValue(left.environment),
      deskListOptionValue(right.environment),
      dir,
    );
  }
  if (key === "details") {
    return (
      compareTableNum(left.botCount, right.botCount, dir) ||
      compareTableNum(left.openCount, right.openCount, dir) ||
      compareTableNum(left.workingCount, right.workingCount, dir)
    );
  }
  if (key === "status") {
    return compareTableText(
      formatDeskListStatus(left.status),
      formatDeskListStatus(right.status),
      dir,
    );
  }
  return 0;
}
