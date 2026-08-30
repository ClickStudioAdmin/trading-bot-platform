"use client";

import { canBacktestDcaRecipe } from "@/lib/backtest/replay-dca";
import { canBacktestPerpsRecipe } from "@/lib/backtest/replay";
import type { BacktestRecipe } from "@/lib/backtest/model";
import { recipesMatchForBacktest } from "@/lib/templates/recipe";

export type BacktestLibraryItem = {
  id: string;
  name: string;
  recipe: BacktestRecipe;
};

export function toBacktestLibraryItem(row: {
  id: string;
  name: string;
  recipe: { kind: string };
}): BacktestLibraryItem | null {
  if (row.recipe.kind !== "perps" && row.recipe.kind !== "dca") {
    return null;
  }
  return row as BacktestLibraryItem;
}

function canReplay(recipe: BacktestRecipe) {
  return recipe.kind === "dca"
    ? canBacktestDcaRecipe(recipe)
    : canBacktestPerpsRecipe(recipe);
}

function DisabledBacktest({ title }: { title: string }) {
  return (
    <span className="inline-flex" title={title}>
      <button
        type="button"
        disabled
        className="pointer-events-none shrink-0 rounded-control px-2 py-0.5 text-xs text-ink-muted opacity-40"
      >
        Backtest
      </button>
    </span>
  );
}

export function findBacktestableTemplate(
  current: BacktestRecipe | null,
  templates: BacktestLibraryItem[],
): BacktestLibraryItem | null {
  if (!current || !canReplay(current).ok) {
    return null;
  }
  return (
    templates.find(
      (row) =>
        recipesMatchForBacktest(current, row.recipe) && canReplay(row.recipe).ok,
    ) ?? null
  );
}

export function BacktestTemplateLink({
  current,
  templates,
  venueId,
  venueEnvironment = null,
}: {
  current: BacktestRecipe | null;
  templates: BacktestLibraryItem[];
  venueId: string;
  venueEnvironment?: string | null;
}) {
  if (!current) {
    return (
      <DisabledBacktest title="Save this configuration as a template first." />
    );
  }
  const allowed = canReplay(current);
  if (!allowed.ok) {
    return <DisabledBacktest title={allowed.error} />;
  }
  const match = findBacktestableTemplate(current, templates);
  if (!match) {
    return (
      <DisabledBacktest title="Save this configuration as a template first." />
    );
  }
  const params = new URLSearchParams({
    template: match.id,
    venue: venueId,
  });
  if (venueEnvironment) {
    params.set("env", venueEnvironment);
  }
  return (
    <a
      href={`/account/backtests?${params.toString()}`}
      target="_blank"
      rel="noreferrer"
      className="shrink-0 rounded-control px-2 py-0.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink"
    >
      Backtest
    </a>
  );
}
