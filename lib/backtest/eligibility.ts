import type {
  DcaTemplateRecipe,
  PerpsTemplateRecipe,
  TemplateRecipe,
} from "@/lib/templates/recipe";

export function canBacktestDcaRecipe(
  recipe: DcaTemplateRecipe,
): { ok: true } | { ok: false; error: string } {
  if (recipe.startKind === "webhook") {
    return {
      ok: false,
      error:
        "Webhook-start DCA cannot be backtested. Use price, indicator, or trend.",
    };
  }
  const hasClip = recipe.clipSize > 0;
  const hasBudget =
    recipe.maxValue != null &&
    recipe.maxValue > 0 &&
    recipe.maxClips != null &&
    recipe.maxClips > 0;
  if (!hasClip && !hasBudget) {
    return { ok: false, error: "This DCA bot needs a clip size." };
  }
  return { ok: true };
}

export function canBacktestPerpsRecipe(
  recipe: PerpsTemplateRecipe,
): { ok: true } | { ok: false; error: string } {
  if (
    recipe.entrySource === "webhook" ||
    (recipe.direction === "both" && recipe.shortEntry?.entrySource === "webhook")
  ) {
    return {
      ok: false,
      error: "Webhook-entry bots cannot be backtested. Use a price When.",
    };
  }
  const size = Number(String(recipe.size).replace(/,/g, "").trim());
  if (!(size > 0)) {
    return { ok: false, error: "This bot needs a size before it can replay." };
  }
  if (recipe.entrySource === "indicator" || recipe.entrySource === "trend") {
    if (!recipe.indicator?.kind || !recipe.indicator.timeframe) {
      return { ok: false, error: "This bot needs Indicator or Trend settings." };
    }
  } else {
    const trigger = Number(String(recipe.triggerPrice).replace(/,/g, "").trim());
    if (!(trigger > 0)) {
      return { ok: false, error: "This bot needs a When price." };
    }
  }
  const short = recipe.direction === "both" ? recipe.shortEntry : null;
  if (short?.entrySource === "indicator" || short?.entrySource === "trend") {
    if (!short.indicator?.kind || !short.indicator.timeframe) {
      return { ok: false, error: "The short entry needs Indicator or Trend settings." };
    }
  } else if (short && short.entrySource === "price") {
    if (!(short.triggerPrice > 0)) {
      return { ok: false, error: "The short entry needs a When price." };
    }
  }
  return { ok: true };
}

export function libraryTemplateCanBacktest(recipe: TemplateRecipe): boolean {
  if (recipe.kind === "dca") {
    return canBacktestDcaRecipe(recipe).ok;
  }
  if (recipe.kind === "flex") {
    return canBacktestPerpsRecipe(recipe).ok;
  }
  return false;
}
