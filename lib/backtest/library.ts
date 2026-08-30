import type { BacktestRecipe } from "@/lib/backtest/model";

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
