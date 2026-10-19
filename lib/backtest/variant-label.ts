import { recipeParamRows } from "@/lib/backtest/library";
import {
  backtestReplayHref,
  backtestRunTitle,
  isoDateUtc,
  splitBacktestFamily,
  type BacktestRecipe,
  type BacktestRun,
} from "@/lib/backtest/model";

type VariantSnapshot = {
  id?: string;
  status?: string;
  name?: string | null;
  recipe: BacktestRecipe;
  leverage: number;
  startingUsdt: number;
  fromMs: number;
  toMs: number;
};

function money(value: number): string {
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

export function backtestVariantChanges(
  base: VariantSnapshot,
  next: VariantSnapshot,
): string[] {
  const changes: string[] = [];
  const beforeName = base.name?.trim() ?? "";
  const nextName = next.name?.trim() ?? "";
  if (beforeName && nextName && beforeName !== nextName) {
    changes.push(`Name ${beforeName} → ${nextName}`);
  }
  const before = new Map(
    recipeParamRows(base.recipe).map((row) => [row.label, row.value]),
  );
  for (const row of recipeParamRows(next.recipe)) {
    const previous = before.get(row.label);
    if (previous != null && previous !== row.value) {
      changes.push(`${row.label} ${previous} → ${row.value}`);
    }
  }
  if (base.leverage !== next.leverage) {
    changes.push(`Leverage ${base.leverage}× → ${next.leverage}×`);
  }
  if (base.startingUsdt !== next.startingUsdt) {
    changes.push(
      `Initial account balance ${money(base.startingUsdt)} → ${money(next.startingUsdt)}`,
    );
  }
  if (base.fromMs !== next.fromMs) {
    changes.push(
      `Start date ${isoDateUtc(base.fromMs)} → ${isoDateUtc(next.fromMs)}`,
    );
  }
  if (base.toMs !== next.toMs) {
    changes.push(
      `End date ${isoDateUtc(base.toMs)} → ${isoDateUtc(next.toMs)}`,
    );
  }
  return changes;
}

export function backtestVariantChangeLabel(
  base: VariantSnapshot,
  next: VariantSnapshot,
): string {
  const changes = backtestVariantChanges(base, next);
  if (changes.length === 0) {
    return "Same parameters";
  }
  const shown = changes.slice(0, 3).join(" · ");
  if (changes.length > 3) {
    return `${shown} · +${changes.length - 3} more`;
  }
  return shown;
}

export type ReplayVariantRow = {
  id: string;
  status: string;
  name: string;
  error: string | null;
  createdAtMs: number;
};

export type ReplayRelatedRole = "comparable" | "variation";

export type ReplayRelatedEntry = {
  id: string;
  role: ReplayRelatedRole;
  name: string;
  symbol: string;
  status: string;
  error: string | null;
  createdAtMs: number;
};

function relatedEntry(
  row: BacktestRun,
  role: ReplayRelatedRole,
  live: ReplayVariantRow | undefined,
): ReplayRelatedEntry {
  return {
    id: row.id,
    role,
    name: live?.name || backtestRunTitle(row),
    symbol: row.symbol,
    status: live?.status ?? row.status,
    error: live ? live.error : row.error,
    createdAtMs: live?.createdAtMs ?? row.createdAtMs,
  };
}

function byCreated(left: ReplayRelatedEntry, right: ReplayRelatedEntry): number {
  return left.createdAtMs - right.createdAtMs || left.id.localeCompare(right.id);
}

/** Comparables, then variations, oldest first. A polled row with no family record is a variation. */
export function replayRelatedList(input: {
  root: BacktestRun;
  family: readonly BacktestRun[];
  live: readonly ReplayVariantRow[];
}): { comparables: ReplayRelatedEntry[]; variations: ReplayRelatedEntry[] } {
  const liveById = new Map(input.live.map((row) => [row.id, row]));
  const split = splitBacktestFamily(input.root, input.family);
  const known = new Set(input.family.map((row) => row.id));
  const extras = input.live
    .filter((row) => row.id !== input.root.id && !known.has(row.id))
    .map(
      (row): ReplayRelatedEntry => ({
        id: row.id,
        role: "variation",
        name: row.name,
        symbol: "",
        status: row.status,
        error: row.error,
        createdAtMs: row.createdAtMs,
      }),
    );
  return {
    comparables: split.comparables
      .map((row) => relatedEntry(row, "comparable", liveById.get(row.id)))
      .sort(byCreated),
    variations: [
      ...split.variations.map((row) =>
        relatedEntry(row, "variation", liveById.get(row.id)),
      ),
      ...extras,
    ].sort(byCreated),
  };
}

export function mergeReplayVariantRows(
  family: ReplayVariantRow[],
  poll: ReplayVariantRow[] | null,
): ReplayVariantRow[] {
  if (!poll) {
    return family;
  }
  const seen = new Set(poll.map((row) => row.id));
  return [...poll, ...family.filter((row) => !seen.has(row.id))];
}

export function sameReplayVariantRows(
  left: ReplayVariantRow[],
  right: ReplayVariantRow[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((row, index) => {
    const other = right[index];
    return (
      other != null &&
      row.id === other.id &&
      row.status === other.status &&
      row.name === other.name &&
      row.error === other.error &&
      row.createdAtMs === other.createdAtMs
    );
  });
}

export function completedBacktestVariantIds(input: {
  primed: boolean;
  previousPendingIds: ReadonlySet<string>;
  previousOptimisticIds: ReadonlySet<string>;
  pendingIds: ReadonlySet<string>;
  optimisticIds: ReadonlySet<string>;
  doneIds: ReadonlySet<string>;
}): string[] {
  if (!input.primed) {
    return [];
  }
  const done: string[] = [];
  for (const id of input.previousPendingIds) {
    if (!input.pendingIds.has(id) && input.doneIds.has(id)) {
      done.push(id);
    }
  }
  for (const id of input.previousOptimisticIds) {
    if (
      input.optimisticIds.has(id) ||
      input.pendingIds.has(id) ||
      done.includes(id) ||
      !input.doneIds.has(id)
    ) {
      continue;
    }
    done.push(id);
  }
  return done;
}

/** The open variant is gone, so replay reloads the original. Other deletes stay put. */
export function replayHrefAfterVariantDelete(input: {
  deletedId: string;
  viewingId: string;
  rootId: string;
}): string | null {
  if (input.deletedId !== input.viewingId) {
    return null;
  }
  return backtestReplayHref(input.rootId);
}

export function backtestVariantsStillRunning(
  rows: Array<{ id: string; status: string }>,
  rootId: string,
): number {
  return rows.filter(
    (row) =>
      row.id !== rootId &&
      (row.status === "queued" || row.status === "running"),
  ).length;
}
