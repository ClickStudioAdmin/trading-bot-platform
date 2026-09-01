"use client";

import { useState } from "react";
import { canBacktestDcaRecipe } from "@/lib/backtest/replay-dca";
import { canBacktestPerpsRecipe } from "@/lib/backtest/replay";
import { seedBacktestDraftAction } from "@/lib/backtest/actions";
import type { BacktestRecipe } from "@/lib/backtest/model";
import { recipesMatchForBacktest } from "@/lib/templates/recipe";
import {
  canQueueUserBacktest,
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

export function findBacktestableTemplate(
  current: BacktestRecipe | null,
  templates: BacktestLibraryItem[],
): BacktestLibraryItem | null {
  if (!current || !canQueueUserBacktest(current).ok) {
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
  getRecipe,
  templates,
  venueId,
  venueEnvironment = null,
}: {
  current?: BacktestRecipe | null;
  getRecipe?: () =>
    | { ok: true; recipe: BacktestRecipe }
    | { ok: false; error: string };
  templates: BacktestLibraryItem[];
  venueId: string;
  venueEnvironment?: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const loaded = getRecipe?.() ??
            (current
              ? { ok: true as const, recipe: current }
              : {
                  ok: false as const,
                  error: "Complete this bot before backtesting.",
                });
          if (!loaded.ok) {
            setError(loaded.error);
            return;
          }
          const recipe = loaded.recipe;
          const allowed = canQueueUserBacktest(recipe);
          if (!allowed.ok) {
            setError(allowed.error);
            return;
          }
          const match = findBacktestableTemplate(recipe, templates);
          const formData = new FormData();
          formData.set("recipe", JSON.stringify(recipe));
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
      {error ? (
        <span className="mt-1 max-w-56 text-right text-xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
