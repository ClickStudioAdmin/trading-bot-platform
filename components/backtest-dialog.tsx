"use client";

import { useState } from "react";
import {
  BotButtonLead,
  botBtnIcon,
  PreviousBacktestLink,
} from "@/components/bot-form-chrome";
import { IconBacktest } from "@/components/icons";
import {
  ResearchNoticeBanner,
  ResearchTrialLines,
  useResearchGateAccess,
} from "@/components/research-gate-access";
import {
  backtestCreateDenial,
  researchTrialLine,
  type ResearchNotice,
} from "@/lib/membership/entitlements";
import { canBacktestDcaRecipe } from "@/lib/backtest/replay-dca";
import { canBacktestPerpsRecipe } from "@/lib/backtest/replay";
import { seedBacktestDraftAction } from "@/lib/backtest/actions";
import { backtestNewHref, type BacktestRecipe } from "@/lib/backtest/model";
import { recipesMatchForBacktest } from "@/lib/templates/recipe";
import {
  canQueueUserBacktest,
  findMatchingSavedBacktest,
  toBacktestLibraryItem,
  type BacktestLibraryItem,
  type SavedBacktestMatch,
} from "@/lib/backtest/library";

export type { BacktestLibraryItem, SavedBacktestMatch };
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
  savedBacktests = [],
  venueId,
  venueEnvironment = null,
  className,
  buttonClassName,
}: {
  current?: BacktestRecipe | null;
  getRecipe?: () =>
    | { ok: true; recipe: BacktestRecipe }
    | { ok: false; error: string };
  templates: BacktestLibraryItem[];
  savedBacktests?: readonly SavedBacktestMatch[];
  venueId: string;
  venueEnvironment?: string | null;
  className?: string;
  buttonClassName?: string;
}) {
  const gate = useResearchGateAccess();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ResearchNotice | null>(null);
  const saved = findMatchingSavedBacktest(current, savedBacktests);
  const trial = gate ? researchTrialLine(gate.backtest) : null;
  return (
    <span className={className ?? "inline-flex flex-col items-end"}>
      <ResearchNoticeBanner notice={notice} className="mb-2 w-full min-w-80" />
      <ResearchTrialLines lines={trial ? [trial] : []} />
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const denial = gate ? backtestCreateDenial(gate) : null;
          if (denial) {
            setNotice(denial);
            setError(null);
            return;
          }
          setNotice(null);
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
              backtestNewHref({
                draft: result.runId,
                venue: venueId,
                env: venueEnvironment,
              }),
              "_blank",
              "noreferrer",
            );
          });
        }}
        className={
          buttonClassName ??
          "shrink-0 rounded-control px-2 py-0.5 text-xs text-ink-muted hover:bg-surface-raised hover:text-ink disabled:opacity-50"
        }
      >
        {pending ? (
          "Opening…"
        ) : (
          <BotButtonLead icon={<IconBacktest {...botBtnIcon} />}>
            Backtest
          </BotButtonLead>
        )}
      </button>
      {saved ? (
        <PreviousBacktestLink
          href={`/account/backtests/${saved.id}`}
          name={saved.name}
        />
      ) : null}
      {error ? (
        <span className="mt-1 text-xs text-danger">{error}</span>
      ) : null}
    </span>
  );
}
