import {
  deskDisplayMode,
  formatAccountUsageStatus,
  pathWithDesk,
  type DeskType,
  type OverviewAttention,
  type TradingAccountMode,
} from "@/lib/accounts/model";
import { parseAutomationMode } from "@/lib/engine/decide";
import { criticalDeskHref } from "@/lib/notifications/critical-model";
import { memberOverviewAttention } from "@/lib/notifications/badge-model";

export type OverviewDeskFacts = {
  id: string;
  name: string;
  mode: TradingAccountMode;
  deskType: DeskType;
  venueEnvironment: string | null;
  copy: boolean;
  openCount: number;
  carryOpenCount: number;
  futuresOpenCount: number;
  workingCount: number;
  botsOn: number;
  reduceOnly: boolean;
  bound: boolean;
  critical: boolean;
};

export type OverviewStats = {
  desks: number;
  paper: number;
  demo: number;
  live: number;
  copy: number;
  openPositions: number;
  carryOpen: number;
  futuresOpen: number;
  openOrders: number;
  orderDesks: number;
  botsOn: number;
  botDesks: number;
};

export function countArmedRules(modes: readonly unknown[]): number {
  let count = 0;
  for (const mode of modes) {
    if (parseAutomationMode(mode) !== "disabled") {
      count += 1;
    }
  }
  return count;
}

export function overviewStats(desks: readonly OverviewDeskFacts[]): OverviewStats {
  const stats: OverviewStats = {
    desks: desks.length,
    paper: 0,
    demo: 0,
    live: 0,
    copy: 0,
    openPositions: 0,
    carryOpen: 0,
    futuresOpen: 0,
    openOrders: 0,
    orderDesks: 0,
    botsOn: 0,
    botDesks: 0,
  };
  for (const desk of desks) {
    const display = deskDisplayMode(desk);
    if (display === "paper") {
      stats.paper += 1;
    } else if (display === "demo") {
      stats.demo += 1;
    } else {
      stats.live += 1;
    }
    if (desk.copy) {
      stats.copy += 1;
    }
    stats.openPositions += desk.openCount;
    stats.carryOpen += desk.carryOpenCount;
    stats.futuresOpen += desk.futuresOpenCount;
    stats.openOrders += desk.workingCount;
    if (desk.workingCount > 0) {
      stats.orderDesks += 1;
    }
    stats.botsOn += desk.botsOn;
    if (desk.botsOn > 0) {
      stats.botDesks += 1;
    }
  }
  return stats;
}

export function overviewDeskHint(stats: OverviewStats): string {
  const parts: string[] = [];
  if (stats.paper > 0) {
    parts.push(`${stats.paper} Paper`);
  }
  if (stats.demo > 0) {
    parts.push(`${stats.demo} Demo`);
  }
  if (stats.live > 0) {
    parts.push(`${stats.live} Live`);
  }
  if (stats.copy === 1) {
    parts.push("1 Copy");
  } else if (stats.copy > 1) {
    parts.push(`${stats.copy} Copy`);
  }
  return parts.length > 0 ? parts.join(" · ") : "None yet";
}

export function overviewPositionsHint(stats: OverviewStats): string {
  const parts: string[] = [];
  if (stats.carryOpen === 1) {
    parts.push("1 Cash and Carry");
  } else if (stats.carryOpen > 1) {
    parts.push(`${stats.carryOpen} Cash and Carry`);
  }
  if (stats.futuresOpen === 1) {
    parts.push("1 Perps");
  } else if (stats.futuresOpen > 1) {
    parts.push(`${stats.futuresOpen} Perps`);
  }
  return parts.length > 0 ? parts.join(" · ") : "None open";
}

export function overviewOrdersHint(stats: OverviewStats): string {
  if (stats.orderDesks === 0) {
    return "None working";
  }
  if (stats.orderDesks === 1) {
    return "on 1 desk";
  }
  return `on ${stats.orderDesks} desks`;
}

export function overviewBotsHint(stats: OverviewStats): string {
  if (stats.botDesks === 0) {
    return "None armed";
  }
  if (stats.botDesks === 1) {
    return "on 1 desk";
  }
  return `on ${stats.botDesks} desks`;
}

export function deskIsInPlay(desk: OverviewDeskFacts): boolean {
  return (
    desk.critical ||
    desk.openCount > 0 ||
    desk.workingCount > 0 ||
    desk.botsOn > 0 ||
    desk.reduceOnly ||
    (desk.mode === "live" && !desk.bound)
  );
}

function inPlayRank(desk: OverviewDeskFacts): number {
  if (desk.critical) {
    return 0;
  }
  if (desk.mode === "live" && !desk.bound) {
    return 1;
  }
  if (desk.reduceOnly) {
    return 2;
  }
  if (desk.openCount > 0) {
    return 3;
  }
  if (desk.workingCount > 0) {
    return 4;
  }
  return 5;
}

export function desksInPlay<T extends OverviewDeskFacts>(
  desks: readonly T[],
): T[] {
  return desks
    .filter(deskIsInPlay)
    .slice()
    .sort((left, right) => {
      const rank = inPlayRank(left) - inPlayRank(right);
      if (rank !== 0) {
        return rank;
      }
      return left.name.localeCompare(right.name);
    });
}

export function overviewDeskDetail(desk: OverviewDeskFacts): string {
  const parts: string[] = [];
  const usage = formatAccountUsageStatus({
    openCount: desk.openCount,
    workingCount: desk.workingCount,
    automationsRunning: desk.botsOn > 0,
    reduceOnly: desk.reduceOnly,
  });
  if (usage) {
    parts.push(usage);
  }
  if (desk.mode === "live" && !desk.bound) {
    parts.push("No key bound");
  }
  if (desk.critical) {
    parts.push("Critical issue");
  }
  return parts.join(" - ");
}

export function overviewPositionsPath(desk: {
  id: string;
  deskType: DeskType;
}): string {
  const base =
    desk.deskType === "cash_and_carry"
      ? "/strategies/cash-and-carry/positions"
      : "/strategies/futures/positions";
  return pathWithDesk(base, desk.id);
}

export function overviewBotsPath(desk: {
  id: string;
  deskType: DeskType;
  copy: boolean;
}): string {
  if (
    desk.copy ||
    desk.deskType === "manual" ||
    desk.deskType === "signal_follower"
  ) {
    return overviewPositionsPath(desk);
  }
  const base =
    desk.deskType === "cash_and_carry"
      ? "/strategies/cash-and-carry/automations"
      : "/strategies/futures/automations";
  return pathWithDesk(base, desk.id);
}

export function overviewFocusHref(
  kind: "positions" | "orders" | "bots",
  desks: readonly OverviewDeskFacts[],
): string | undefined {
  const matched = desks.filter((desk) => {
    if (kind === "positions") {
      return desk.openCount > 0;
    }
    if (kind === "orders") {
      return desk.workingCount > 0;
    }
    return desk.botsOn > 0;
  });
  if (matched.length === 0) {
    return undefined;
  }
  if (matched.length > 1) {
    return "#desks-in-play";
  }
  const desk = matched[0];
  return kind === "bots" ? overviewBotsPath(desk) : overviewPositionsPath(desk);
}

export function overviewRealized30d(
  deskType: DeskType,
  realizedUsdt: number | null | undefined,
): number | null {
  if (deskType === "cash_and_carry") {
    return null;
  }
  if (realizedUsdt == null || !Number.isFinite(realizedUsdt)) {
    return null;
  }
  return realizedUsdt;
}

export function overviewCriticalItems(
  accounts: readonly { id: string; name: string; deskType: DeskType }[],
  criticalIds: readonly string[],
): OverviewAttention[] {
  const ids = new Set(criticalIds);
  return accounts
    .filter((account) => ids.has(account.id))
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((account) => ({
      label: `${account.name} has a critical issue.`,
      href: criticalDeskHref(account),
    }));
}

export function overviewPageAttention(input: {
  accounts: readonly {
    id: string;
    name: string;
    mode: TradingAccountMode;
    venue?: string;
    deskType: DeskType;
  }[];
  binds: readonly { connectionId: string; accountId: string }[];
  pastDue: boolean;
  accountShortfall: boolean;
  copyInvite: number;
  updateCard: boolean;
  criticalIds: readonly string[];
}): OverviewAttention[] {
  return [
    ...memberOverviewAttention({
      accounts: input.accounts,
      binds: input.binds,
      pastDue: input.pastDue,
      accountShortfall: input.accountShortfall,
      copyInvite: input.copyInvite,
      updateCard: input.updateCard,
      deskCritical: 0,
    }),
    ...overviewCriticalItems(input.accounts, input.criticalIds),
  ];
}

export function overviewBoundDeskLabel(
  connectionId: string,
  binds: readonly { connectionId: string; accountId: string }[],
  accounts: readonly { id: string; name: string }[],
): string {
  const names = binds
    .filter((bind) => bind.connectionId === connectionId)
    .map(
      (bind) => accounts.find((account) => account.id === bind.accountId)?.name,
    )
    .filter((name): name is string => Boolean(name))
    .sort((left, right) => left.localeCompare(right));
  if (names.length === 0) {
    return "No desk bound";
  }
  return names.join(", ");
}

export function overviewKeyModeLabel(environment: string): "Demo" | "Live" {
  const env = environment.toLowerCase();
  return env === "demo" || env === "testnet" ? "Demo" : "Live";
}
