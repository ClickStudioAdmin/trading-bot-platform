import type {
  DcaTemplateRecipe,
  PerpsTemplateRecipe,
  TemplateRecipe,
} from "@/lib/templates/recipe";

export function canBacktestDcaRecipe(
  recipe: DcaTemplateRecipe,
): { ok: true } | { ok: false; error: string } {
  if (
    recipe.startKind === "webhook" ||
    (recipe.direction === "both" && recipe.shortStartKind === "webhook")
  ) {
    return {
      ok: false,
      error:
        "Webhook-start DCA cannot be backtested. Use price, indicator, or trend.",
    };
  }
  if (recipe.startKind === "price" && !(Number(recipe.armTrigger?.price) > 0)) {
    return { ok: false, error: "This DCA bot needs a start price." };
  }
  if (recipe.startKind === "indicator" || recipe.startKind === "trend") {
    if (!recipe.indicatorKind || !recipe.indicatorTimeframe) {
      return { ok: false, error: "This DCA bot needs Indicator or Trend settings." };
    }
  }
  if (recipe.startKind === "retrace" && !(recipe.retrace && recipe.retrace.pct > 0)) {
    return { ok: false, error: "This DCA bot needs a retrace %." };
  }
  if (recipe.direction === "both") {
    const shortKind = recipe.shortStartKind ?? recipe.startKind;
    if (shortKind === "price") {
      const price = recipe.shortStartKind
        ? recipe.shortArmTrigger?.price
        : (recipe.shortArmTrigger?.price ?? recipe.armTrigger?.price);
      if (!(Number(price) > 0)) {
        return { ok: false, error: "The short start needs a price." };
      }
    }
    if (shortKind === "indicator" || shortKind === "trend") {
      const kind = recipe.shortStartKind
        ? recipe.shortIndicatorKind
        : (recipe.shortIndicatorKind ?? recipe.indicatorKind);
      const timeframe = recipe.shortStartKind
        ? recipe.shortIndicatorTimeframe
        : (recipe.shortIndicatorTimeframe ?? recipe.indicatorTimeframe);
      if (!kind || !timeframe) {
        return {
          ok: false,
          error: "The short start needs Indicator or Trend settings.",
        };
      }
    }
    if (shortKind === "retrace") {
      const spec = recipe.shortStartKind
        ? recipe.shortRetrace
        : (recipe.shortRetrace ?? recipe.retrace);
      if (!(spec && spec.pct > 0)) {
        return { ok: false, error: "The short start needs a retrace %." };
      }
    }
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
  if (recipe.entrySource !== "" && !(size > 0)) {
    return { ok: false, error: "This bot needs a size before it can replay." };
  }
  const longEntry = perpsEntryBacktestError(recipe, false);
  if (longEntry) {
    return { ok: false, error: longEntry };
  }
  const short = recipe.direction === "both" ? recipe.shortEntry : null;
  if (recipe.direction === "both" && short) {
    const shortEntry = perpsEntryBacktestError(
      {
        entrySource: short.entrySource,
        triggerPrice: String(short.triggerPrice),
        indicator: short.indicator,
        retrace: short.retrace,
      },
      true,
    );
    if (shortEntry) {
      return { ok: false, error: shortEntry };
    }
  }
  return { ok: true };
}

function perpsEntryBacktestError(
  recipe: {
    entrySource: PerpsTemplateRecipe["entrySource"];
    triggerPrice: PerpsTemplateRecipe["triggerPrice"];
    indicator?: PerpsTemplateRecipe["indicator"];
    retrace?: PerpsTemplateRecipe["retrace"];
  },
  short: boolean,
): string | null {
  if (recipe.entrySource === "webhook") {
    return null;
  }
  if (recipe.entrySource === "indicator" || recipe.entrySource === "trend") {
    if (!recipe.indicator?.kind || !recipe.indicator.timeframe) {
      return short
        ? "The short entry needs Indicator or Trend settings."
        : "This bot needs Indicator or Trend settings.";
    }
    return null;
  }
  if (recipe.entrySource === "retrace") {
    if (!(recipe.retrace && recipe.retrace.pct > 0)) {
      return short
        ? "The short entry needs a retrace %."
        : "This bot needs a retrace %.";
    }
    return null;
  }
  if (recipe.entrySource !== "price") {
    return short ? "Select a Short condition type." : "Select a condition type.";
  }
  const trigger = Number(String(recipe.triggerPrice).replace(/,/g, "").trim());
  if (!(trigger > 0)) {
    return short
      ? "The short entry needs a When price."
      : "This bot needs a When price.";
  }
  return null;
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
