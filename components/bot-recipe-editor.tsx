"use client";

import { useState } from "react";
import { DcaPlaybookForm } from "@/components/dca-playbook-form";
import { PerpsRecipeForm } from "@/components/futures-rules-form";
import type { BacktestRecipe } from "@/lib/backtest/model";
import { BYBIT_DCA_UI, HYPERLIQUID_DCA_UI } from "@/lib/dca/ui-policy";
import type { LinearPerp } from "@/lib/exchanges/bybit/perp";
import {
  dcaRecipePlaybookSeed,
  perpsRecipeFormSeed,
  type DcaTemplateRecipe,
  type PerpsTemplateRecipe,
} from "@/lib/templates/recipe";

export function BotRecipeEditor({
  recipe,
  options,
  venue,
  symbol,
  onSymbolChange,
  onChange,
  onIssuesChange,
}: {
  recipe: BacktestRecipe;
  options: LinearPerp[];
  venue: string;
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  onChange: (recipe: BacktestRecipe, fromUser?: boolean) => void;
  onIssuesChange: (issues: string[]) => void;
}) {
  if (recipe.kind === "perps") {
    return (
      <PerpsRecipeMount
        recipe={recipe}
        options={options}
        venue={venue}
        symbol={symbol}
        onSymbolChange={onSymbolChange}
        onChange={onChange}
        onIssuesChange={onIssuesChange}
      />
    );
  }
  if (recipe.kind !== "dca") {
    return null;
  }
  return (
    <DcaRecipeMount
      recipe={recipe}
      options={options}
      venue={venue}
      symbol={symbol}
      onSymbolChange={onSymbolChange}
      onChange={onChange}
      onIssuesChange={onIssuesChange}
    />
  );
}

function DcaRecipeMount({
  recipe,
  options,
  venue,
  symbol,
  onSymbolChange,
  onChange,
  onIssuesChange,
}: {
  recipe: DcaTemplateRecipe;
  options: LinearPerp[];
  venue: string;
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  onChange: (recipe: BacktestRecipe, fromUser?: boolean) => void;
  onIssuesChange: (issues: string[]) => void;
}) {
  const [seed] = useState(() => dcaRecipePlaybookSeed(recipe));
  const policy = venue === "hyperliquid" ? HYPERLIQUID_DCA_UI : BYBIT_DCA_UI;
  return (
    <DcaPlaybookForm
      playbook={null}
      seed={seed}
      options={options}
      signalWebhooks={[]}
      policy={policy}
      embedded
      controlledSymbol={symbol}
      onSymbolChange={onSymbolChange}
      onRecipeChange={(result) => {
        onIssuesChange(result.error ? [result.error] : []);
        if (result.recipe) {
          onChange(result.recipe, result.fromUser);
        }
      }}
    />
  );
}

function PerpsRecipeMount({
  recipe,
  options,
  venue,
  symbol,
  onSymbolChange,
  onChange,
  onIssuesChange,
}: {
  recipe: PerpsTemplateRecipe;
  options: LinearPerp[];
  venue: string;
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  onChange: (recipe: BacktestRecipe, fromUser?: boolean) => void;
  onIssuesChange: (issues: string[]) => void;
}) {
  const [seed] = useState(() => perpsRecipeFormSeed(recipe));
  const quote = venue === "hyperliquid" ? "USDC" : "USDT";
  return (
    <PerpsRecipeForm
      seed={seed}
      options={options}
      quoteLabel={quote}
      venueId={venue === "hyperliquid" ? "hyperliquid" : "bybit"}
      controlledSymbol={symbol}
      onSymbolChange={onSymbolChange}
      onRecipeChange={(next, error, fromUser) => {
        onIssuesChange(error ? [error] : []);
        onChange(next, fromUser);
      }}
    />
  );
}
