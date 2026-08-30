import { listTradingAccounts } from "@/lib/accounts/store";
import { canQueueUserBacktest, type BacktestDeskBot } from "@/lib/backtest/library";
import { listDcaPlaybooksForAccount } from "@/lib/dca/store";
import { loadFuturesAutomationRules } from "@/lib/futures/automation-load";
import {
  snapshotDcaRecipe,
  snapshotPerpsRecipe,
} from "@/lib/templates/recipe";

export async function listDeskBacktestBots(
  userId: string,
): Promise<BacktestDeskBot[]> {
  const desks = await listTradingAccounts(userId);
  const rows: BacktestDeskBot[] = [];
  for (const desk of desks) {
    if (desk.deskType === "dca") {
      const playbooks = await listDcaPlaybooksForAccount(desk.id);
      for (const playbook of playbooks) {
        const recipe = snapshotDcaRecipe(playbook);
        if (!canQueueUserBacktest(recipe).ok) {
          continue;
        }
        rows.push({
          id: `dca:${playbook.id}`,
          name: recipe.name,
          deskName: desk.name,
          recipe,
          venue: desk.venue,
          venueEnvironment: desk.venueEnvironment,
        });
      }
    }
    if (desk.deskType === "perps_bots") {
      const rules = await loadFuturesAutomationRules(desk.id);
      for (const rule of rules) {
        if (!rule.id) {
          continue;
        }
        const recipe = snapshotPerpsRecipe(rule);
        if (!canQueueUserBacktest(recipe).ok) {
          continue;
        }
        rows.push({
          id: `perps:${rule.id}`,
          name: recipe.name,
          deskName: desk.name,
          recipe,
          venue: desk.venue,
          venueEnvironment: desk.venueEnvironment,
        });
      }
    }
  }
  return rows;
}
