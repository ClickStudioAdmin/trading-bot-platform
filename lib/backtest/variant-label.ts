import { recipeParamRows } from "@/lib/backtest/library";
import { isoDateUtc, type BacktestRecipe } from "@/lib/backtest/model";

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
