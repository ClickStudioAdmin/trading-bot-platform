"use client";

import { useState } from "react";
import { canBacktestDcaRecipe } from "@/lib/backtest/replay-dca";
import { canBacktestPerpsRecipe } from "@/lib/backtest/replay";
import { seedBacktestDraftAction } from "@/lib/backtest/actions";
import type { BacktestRecipe } from "@/lib/backtest/model";
import { recipesMatchForBacktest } from "@/lib/templates/recipe";

import {
  toBacktestLibraryItem,
  type BacktestLibraryItem,
} from "@/lib/backtest/library";

export type { BacktestLibraryItem };
export { toBacktestLibraryItem };

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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!current) {
    return (
      <DisabledBacktest title="Complete this bot before backtesting." />
    );
  }
  const allowed = canReplay(current);
  if (!allowed.ok) {
    return <DisabledBacktest title={allowed.error} />;
  }
  const match = findBacktestableTemplate(current, templates);
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const formData = new FormData();
          formData.set("recipe", JSON.stringify(current));
          formData.set("venue", venueId);
          if (venueEnvironment) {
            formData.set("venueEnvironment", venueEnvironment);
          }
          if (match) {
            formData.set("sourceTemplateId", match.id);
          }
          setPending(true);
          setError(null);
          void seedBacktestDraftAction(formData).then((result) => {
            setPending(false);
            if (!result.ok || !result.runId) {
              setError(result.error ?? "Could not open a backtest.");
              return;
            }
            window.open(
              `/account/backtests?draft=${result.runId}&venue=${encodeURIComponent(venueId)}${
                venueEnvironment
                  ? `&env=${encodeURIComponent(venueEnvironment)}`
                  : ""
              }`,
              "_blank",
              "noreferrer",
            );
          });
        }}
        className="shrink-0 rounded-control px-2 py-0.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-50"
      >
        {pending ? "Opening…" : "Backtest"}
      </button>
      {error ? <span className="mt-1 text-xs text-danger">{error}</span> : null}
    </span>
  );
}
