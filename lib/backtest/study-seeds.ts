import {
  listAllTradingAccounts,
  loadTradingAccountById,
} from "@/lib/accounts/store";
import { listDcaPlaybooksForAccount, loadDcaPlaybookById } from "@/lib/dca/store";
import { loadFuturesAutomationRules } from "@/lib/futures/automation-load";
import { snapshotDcaRecipe, snapshotPerpsRecipe } from "@/lib/templates/recipe";
import { canBacktestDcaRecipe } from "./replay-dca";
import type { BacktestDeskType, BacktestRecipe } from "./model";

export type StudySeedOption = {
  key: string;
  label: string;
  accountId: string;
  deskType: BacktestDeskType;
  venue: string;
  venueEnvironment: string | null;
  recipe: BacktestRecipe;
};

export type LoadedStudySeed = StudySeedOption & {
  botId: string;
};

function seedKey(kind: BacktestDeskType, accountId: string, botId: string): string {
  return `${kind}:${accountId}:${botId}`;
}

export function parseStudySeedKey(
  raw: unknown,
): { kind: BacktestDeskType; accountId: string; botId: string } | null {
  const text = String(raw ?? "").trim();
  const match = /^(dca|perps):([0-9a-f-]{36}):([0-9a-f-]{36})$/i.exec(text);
  if (!match) {
    return null;
  }
  return {
    kind: match[1] === "dca" ? "dca" : "perps",
    accountId: match[2],
    botId: match[3],
  };
}

export async function listStudySeedOptions(): Promise<StudySeedOption[]> {
  const desks = await listAllTradingAccounts();
  const rows: StudySeedOption[] = [];
  for (const desk of desks) {
    if (desk.deskType === "dca") {
      const playbooks = await listDcaPlaybooksForAccount(desk.id);
      for (const playbook of playbooks) {
        const recipe = snapshotDcaRecipe(playbook);
        if (!(recipe.clipSize > 0)) {
          continue;
        }
        rows.push({
          key: seedKey("dca", desk.id, playbook.id),
          label: `${desk.ownerName} · ${desk.name} · ${recipe.name} · ${recipe.symbol}`,
          accountId: desk.id,
          deskType: "dca",
          venue: desk.venue,
          venueEnvironment: desk.venueEnvironment,
          recipe,
        });
      }
    }
    if (desk.deskType === "perps_bots") {
      const rules = await loadFuturesAutomationRules(desk.id);
      for (const rule of rules) {
        if (!rule.id || rule.action === "flatten") {
          continue;
        }
        const recipe = snapshotPerpsRecipe(rule);
        if (!(Number(String(recipe.triggerPrice).replace(/,/g, "")) > 0)) {
          continue;
        }
        if (!(Number(String(recipe.size).replace(/,/g, "")) > 0)) {
          continue;
        }
        rows.push({
          key: seedKey("perps", desk.id, rule.id),
          label: `${desk.ownerName} · ${desk.name} · ${recipe.name} · ${recipe.symbol}`,
          accountId: desk.id,
          deskType: "perps",
          venue: desk.venue,
          venueEnvironment: desk.venueEnvironment,
          recipe,
        });
      }
    }
  }
  return rows;
}

export async function loadStudySeed(
  key: string,
): Promise<LoadedStudySeed | null> {
  const parsed = parseStudySeedKey(key);
  if (!parsed) {
    return null;
  }
  const desk = await loadTradingAccountById(parsed.accountId);
  if (!desk) {
    return null;
  }
  if (parsed.kind === "dca") {
    if (desk.deskType !== "dca") {
      return null;
    }
    const playbook = await loadDcaPlaybookById(parsed.botId, desk.id);
    if (!playbook) {
      return null;
    }
    const recipe = snapshotDcaRecipe(playbook);
    if (!canBacktestDcaRecipe({ ...recipe, startKind: "immediate" }).ok) {
      return null;
    }
    return {
      key,
      label: `${desk.name} · ${recipe.name}`,
      accountId: desk.id,
      deskType: "dca",
      venue: desk.venue,
      venueEnvironment: desk.venueEnvironment,
      recipe,
      botId: playbook.id,
    };
  }
  if (desk.deskType !== "perps_bots") {
    return null;
  }
  const rules = await loadFuturesAutomationRules(desk.id);
  const rule = rules.find((row) => row.id === parsed.botId);
  if (!rule || rule.action === "flatten") {
    return null;
  }
  const recipe = snapshotPerpsRecipe(rule);
  if (!(Number(String(recipe.size).replace(/,/g, "")) > 0)) {
    return null;
  }
  if (!(Number(String(recipe.triggerPrice).replace(/,/g, "")) > 0)) {
    return null;
  }
  return {
    key,
    label: `${desk.name} · ${recipe.name}`,
    accountId: desk.id,
    deskType: "perps",
    venue: desk.venue,
    venueEnvironment: desk.venueEnvironment,
    recipe,
    botId: rule.id ?? parsed.botId,
  };
}
