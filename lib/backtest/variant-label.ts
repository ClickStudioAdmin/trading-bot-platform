import { recipeParamRows } from "@/lib/backtest/library";
import { isoDateUtc, type BacktestRecipe } from "@/lib/backtest/model";

type VariantSnapshot = {
  id?: string;
  status?: string;
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
      `Initial balance ${money(base.startingUsdt)} → ${money(next.startingUsdt)}`,
    );
  }
  if (base.fromMs !== next.fromMs) {
    changes.push(
      `Window start ${isoDateUtc(base.fromMs)} → ${isoDateUtc(next.fromMs)}`,
    );
  }
  if (base.toMs !== next.toMs) {
    changes.push(
      `Window end ${isoDateUtc(base.toMs)} → ${isoDateUtc(next.toMs)}`,
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
