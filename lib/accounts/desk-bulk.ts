import type { DeskCloseKind } from "@/lib/accounts/close";
import {
  disableDeskConfirmBody,
  disableDeskSuccessBody,
  DISABLE_DESK_SUCCESS,
  type DeskDisableBotKind,
} from "@/lib/accounts/disable-desk";
import {
  formatDeleteBlockers,
  type AccountDeleteBlock,
  type TradingAccountMode,
} from "@/lib/accounts/model";
import type { DeskListStatus } from "@/lib/accounts/desk-list";

export type DeskBulkTarget = {
  id: string;
  name: string;
  status: DeskListStatus;
  blocks: readonly AccountDeleteBlock[];
  closeKind: DeskCloseKind | null;
  /** Omitted on the desk list. The server sets this when an id is not owned. */
  found?: boolean;
};

export function parseBulkDeskIds(values: readonly unknown[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const id = String(value ?? "").trim();
    if (!id || seen.has(id) || id.includes(".") || id.includes(",")) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function deskBulkName(name: string): string {
  const trimmed = name.trim();
  return trimmed || "Desk";
}

export function bulkDisableBlockReason(
  rows: readonly { name: string; status: DeskListStatus }[],
): string | null {
  const inactive = rows.filter((row) => row.status === "inactive");
  if (inactive.length === 0) {
    return null;
  }
  const names = inactive.map((row) => deskBulkName(row.name)).join(", ");
  return inactive.length === 1
    ? `Disable can’t include ${names}. That desk is already inactive.`
    : `Disable can’t include ${names}. Those desks are already inactive.`;
}

export function deskBulkDeleteRowReason(row: {
  blocks: readonly AccountDeleteBlock[];
  closeKind: DeskCloseKind | null;
}): string | null {
  if (row.closeKind === "archive") {
    return "Close it from the row. Followers keep their copy for six months";
  }
  if (row.closeKind === "revoke") {
    return "Close it from the row so invited members are told";
  }
  if (row.blocks.length > 0) {
    return formatDeleteBlockers(row.blocks);
  }
  return null;
}

/**
 * Why Delete stays off. A desk that must be closed from its row, or that
 * still has bots or positions, is named. Selecting every desk is refused
 * even when each row could be deleted on its own.
 */
export function bulkDeskDeleteBlockReason(
  rows: readonly {
    name: string;
    found?: boolean;
    blocks: readonly AccountDeleteBlock[];
    closeKind: DeskCloseKind | null;
  }[],
  ownedCount: number,
): string | null {
  if (rows.length === 0) {
    return null;
  }
  if (rows.some((row) => row.found === false)) {
    return "That desk was not found.";
  }
  const problems = rows.flatMap((row) => {
    const reason = deskBulkDeleteRowReason(row);
    return reason ? [`${deskBulkName(row.name)} (${reason})`] : [];
  });
  if (problems.length > 0) {
    return `Delete can’t include ${problems.join(", ")}.`;
  }
  if (rows.length >= ownedCount) {
    return "Keep at least one desk.";
  }
  return null;
}

export function bulkDisableConfirmBody(
  rows: readonly { name: string; kind: DeskDisableBotKind }[],
): string {
  if (rows.length === 1) {
    return disableDeskConfirmBody(rows[0]?.name ?? "Desk", rows[0]?.kind ?? "none");
  }
  const kinds = new Set(rows.map((row) => row.kind));
  if (kinds.size === 1 && kinds.has("copy")) {
    return "Pause copying on these desks, then close every open position and cancel working orders. This cannot be undone.";
  }
  if (kinds.size === 1 && kinds.has("none")) {
    return "These desks have no bots. Open positions will be closed and working orders cancelled. This cannot be undone.";
  }
  return "Turn every bot off on these desks, then close every open position and cancel working orders. This cannot be undone.";
}

export function bulkDeleteConfirmBody(names: readonly string[]): string {
  if (names.length === 1) {
    return `Remove ${deskBulkName(names[0] ?? "")} and its closed history?`;
  }
  return "Remove these desks and their closed history?";
}

export function bulkDeleteSuccess(count: number): string {
  return count === 1 ? "Desk deleted." : `${count} desks deleted.`;
}

export function bulkDisableSuccess(count: number): string {
  return count === 1 ? DISABLE_DESK_SUCCESS : "Desks disabled.";
}

export function bulkDisableSuccessDetail(input: {
  count: number;
  closed: number;
  cancelled: number;
}): string | null {
  if (input.count !== 1) {
    return null;
  }
  return disableDeskSuccessBody({
    closed: input.closed,
    cancelled: input.cancelled,
  });
}

/** Delete the open desk last so the switch lands on a desk that stays. */
export function bulkDeleteOrder(
  ids: readonly string[],
  currentId: string,
): string[] {
  const rest = ids.filter((id) => id !== currentId);
  return ids.includes(currentId) ? [...rest, currentId] : [...rest];
}

export function pickBulkDeleteSwitch<
  T extends { id: string; mode: TradingAccountMode },
>(
  remaining: readonly T[],
  doomedIds: readonly string[],
  requestedId: unknown,
): T | null {
  const doomed = new Set(doomedIds);
  const survivors = remaining.filter((account) => !doomed.has(account.id));
  const requested = String(requestedId ?? "").trim();
  return (
    survivors.find((account) => account.id === requested) ??
    survivors.find((account) => account.mode === "paper") ??
    survivors[0] ??
    null
  );
}
