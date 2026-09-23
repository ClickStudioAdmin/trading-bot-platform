import { loadDcaPlaybookById } from "@/lib/dca/store";
import type { DcaPlaybook } from "@/lib/dca/playbook";
import { loadFuturesAutomationRuleById } from "./automation-load";
import { loadFuturesBotBook, type FuturesOpenBook } from "./list";

export async function loadFuturesPositionsBotBook(input: {
  botId: string;
  mode: "dca" | "perps";
  recipeAccountId: string;
}): Promise<{ book: FuturesOpenBook; playbook: DcaPlaybook | null }> {
  if (input.mode === "dca") {
    const playbook = await loadDcaPlaybookById(
      input.botId,
      input.recipeAccountId,
    );
    const book = await loadFuturesBotBook(
      playbook ? { symbol: playbook.symbol } : {},
    );
    return { book, playbook };
  }
  const rule = await loadFuturesAutomationRuleById(
    input.recipeAccountId,
    input.botId,
  );
  const book = await loadFuturesBotBook(
    rule?.id ? { ruleId: rule.id, ruleName: rule.name } : {},
  );
  return { book, playbook: null };
}
