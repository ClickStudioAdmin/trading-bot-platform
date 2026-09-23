import {
  deskAllowsDcaPlaybooks,
  deskAllowsPerpsRecipes,
  type TradingAccount,
} from "@/lib/accounts/model";
import { listTradingAccounts } from "@/lib/accounts/store";
import type { BacktestRecipe } from "@/lib/backtest/model";
import {
  canQueueUserBacktest,
  deskBacktestBotCandidates,
  findMatchingBacktestDeskBot,
  type BacktestDeskBot,
  type BacktestDeskBotOption,
} from "@/lib/backtest/library";
import { parseDcaPlaybookRow, type DcaPlaybook } from "@/lib/dca/playbook";
import {
  parseFuturesAutomationRow,
  type FuturesAutomationRule,
} from "@/lib/futures/automation";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  snapshotDcaRecipe,
  snapshotPerpsRecipe,
} from "@/lib/templates/recipe";

type BotSummary = {
  id: string;
  name: string;
  symbol: string;
  accountId: string;
};

export async function listDeskBacktestBots(
  userId: string,
): Promise<BacktestDeskBotOption[]> {
  const desks = await listTradingAccounts(userId);
  const dcaDesks = desks.filter((desk) => deskAllowsDcaPlaybooks(desk));
  const perpsDesks = desks.filter((desk) => deskAllowsPerpsRecipes(desk));
  const [playbooks, rules] = await Promise.all([
    listBotSummaries(
      "dca_playbooks",
      dcaDesks.map((desk) => desk.id),
    ),
    listBotSummaries(
      "futures_automation_rules",
      perpsDesks.map((desk) => desk.id),
    ),
  ]);
  return [
    ...optionsForDesks(dcaDesks, playbooks, "dca"),
    ...optionsForDesks(perpsDesks, rules, "perps"),
  ];
}

export async function loadDeskBacktestBot(
  userId: string,
  botId: string,
): Promise<
  { ok: true; bot: BacktestDeskBot } | { ok: false; error: string }
> {
  const parsed = parseDeskBotId(botId);
  if (!parsed) {
    return { ok: false, error: "Unknown bot." };
  }
  const desks = await listTradingAccounts(userId);
  const allowed = desks.filter((desk) =>
    parsed.kind === "dca"
      ? deskAllowsDcaPlaybooks(desk)
      : deskAllowsPerpsRecipes(desk),
  );
  const bot = await recipeForBot(parsed, allowed);
  if (!bot) {
    return { ok: false, error: "That bot is not on a desk you can backtest." };
  }
  const allowedRecipe = canQueueUserBacktest(bot.recipe);
  if (!allowedRecipe.ok) {
    return allowedRecipe;
  }
  return { ok: true, bot };
}

/** Full recipes only for bots on the same symbol. Used to label a saved run. */
export async function matchDeskBacktestBot(
  userId: string,
  recipe: BacktestRecipe,
  options?: readonly BacktestDeskBotOption[],
): Promise<BacktestDeskBot | null> {
  const listed = options ?? (await listDeskBacktestBots(userId));
  const candidates = deskBacktestBotCandidates(listed, recipe);
  if (candidates.length === 0) {
    return null;
  }
  const loaded = await loadCandidateRecipes(candidates);
  return findMatchingBacktestDeskBot(recipe, loaded);
}

function parseDeskBotId(
  botId: string,
): { kind: "dca" | "perps"; id: string } | null {
  const sep = botId.indexOf(":");
  const kind = botId.slice(0, sep);
  const id = botId.slice(sep + 1).trim();
  if ((kind !== "dca" && kind !== "perps") || !id) {
    return null;
  }
  return { kind, id };
}

async function listBotSummaries(
  table: "dca_playbooks" | "futures_automation_rules",
  accountIds: string[],
): Promise<BotSummary[]> {
  const supabase = createServiceClient();
  if (!supabase || accountIds.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from(table)
    .select("id,name,symbol,account_id")
    .in("account_id", accountIds);
  if (error || !data) {
    return [];
  }
  return data.flatMap((row) => {
    const record = row as Record<string, unknown>;
    const id = String(record.id ?? "").trim();
    const accountId = String(record.account_id ?? "").trim();
    if (!id || !accountId) {
      return [];
    }
    return [
      {
        id,
        name: String(record.name ?? "").trim() || "Bot",
        symbol: String(record.symbol ?? "").trim(),
        accountId,
      },
    ];
  });
}

function optionsForDesks(
  desks: TradingAccount[],
  rows: BotSummary[],
  kind: "dca" | "perps",
): BacktestDeskBotOption[] {
  const byAccount = new Map<string, BotSummary[]>();
  for (const row of rows) {
    const list = byAccount.get(row.accountId) ?? [];
    list.push(row);
    byAccount.set(row.accountId, list);
  }
  const options: BacktestDeskBotOption[] = [];
  for (const desk of desks) {
    for (const row of byAccount.get(desk.id) ?? []) {
      options.push({
        id: `${kind}:${row.id}`,
        name: row.name,
        symbol: row.symbol,
        kind,
        deskId: desk.id,
        deskName: desk.name,
        venue: desk.venue,
        venueEnvironment: desk.venueEnvironment,
      });
    }
  }
  return options;
}

async function recipeForBot(
  parsed: { kind: "dca" | "perps"; id: string },
  desks: TradingAccount[],
): Promise<BacktestDeskBot | null> {
  const supabase = createServiceClient();
  const accountIds = desks.map((desk) => desk.id);
  if (!supabase || accountIds.length === 0) {
    return null;
  }
  const table =
    parsed.kind === "dca" ? "dca_playbooks" : "futures_automation_rules";
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", parsed.id)
    .in("account_id", accountIds)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  const record = data as Record<string, unknown>;
  const desk = desks.find((row) => row.id === String(record.account_id ?? ""));
  if (!desk) {
    return null;
  }
  if (parsed.kind === "dca") {
    const playbook = parseDcaPlaybookRow(record);
    return playbook ? botFromPlaybook(playbook, desk) : null;
  }
  return botFromRule(parseFuturesAutomationRow(record), desk);
}

async function loadCandidateRecipes(
  candidates: readonly BacktestDeskBotOption[],
): Promise<BacktestDeskBot[]> {
  const supabase = createServiceClient();
  if (!supabase) {
    return [];
  }
  const dca = candidates.filter((row) => row.kind === "dca");
  const perps = candidates.filter((row) => row.kind === "perps");
  const [playbooks, rules] = await Promise.all([
    loadRows(
      "dca_playbooks",
      dca.map((row) => row.id.slice(row.id.indexOf(":") + 1)),
      dca.map((row) => row.deskId),
    ),
    loadRows(
      "futures_automation_rules",
      perps.map((row) => row.id.slice(row.id.indexOf(":") + 1)),
      perps.map((row) => row.deskId),
    ),
  ]);
  const desks = new Map<string, BacktestDeskBotOption>();
  for (const row of candidates) {
    desks.set(row.deskId, row);
  }
  const bots: BacktestDeskBot[] = [];
  for (const row of playbooks) {
    const playbook = parseDcaPlaybookRow(row);
    const option = playbook ? desks.get(playbook.accountId) : undefined;
    if (!playbook || !option) {
      continue;
    }
    const bot = botFromPlaybook(playbook, option);
    if (canQueueUserBacktest(bot.recipe).ok) {
      bots.push(bot);
    }
  }
  for (const row of rules) {
    const option = desks.get(String(row.account_id ?? ""));
    const bot = option
      ? botFromRule(parseFuturesAutomationRow(row), option)
      : null;
    if (bot && canQueueUserBacktest(bot.recipe).ok) {
      bots.push(bot);
    }
  }
  return bots;
}

async function loadRows(
  table: "dca_playbooks" | "futures_automation_rules",
  ids: string[],
  accountIds: string[],
): Promise<Record<string, unknown>[]> {
  const supabase = createServiceClient();
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const uniqueAccounts = [...new Set(accountIds.filter(Boolean))];
  if (!supabase || uniqueIds.length === 0 || uniqueAccounts.length === 0) {
    return [];
  }
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .in("id", uniqueIds)
    .in("account_id", uniqueAccounts);
  if (error || !data) {
    return [];
  }
  return data as Record<string, unknown>[];
}

function botFromPlaybook(
  playbook: DcaPlaybook,
  desk: {
    id: string;
    name: string;
    venue: string;
    venueEnvironment: string | null;
  },
): BacktestDeskBot {
  const recipe = snapshotDcaRecipe(playbook);
  return {
    id: `dca:${playbook.id}`,
    name: recipe.name,
    symbol: recipe.symbol,
    kind: "dca",
    deskId: desk.id,
    deskName: desk.name,
    recipe,
    venue: desk.venue,
    venueEnvironment: desk.venueEnvironment,
  };
}

function botFromRule(
  rule: FuturesAutomationRule,
  desk: {
    id: string;
    name: string;
    venue: string;
    venueEnvironment: string | null;
  },
): BacktestDeskBot | null {
  if (!rule.id) {
    return null;
  }
  const recipe = snapshotPerpsRecipe(rule);
  return {
    id: `perps:${rule.id}`,
    name: recipe.name,
    symbol: recipe.symbol,
    kind: "perps",
    deskId: desk.id,
    deskName: desk.name,
    recipe,
    venue: desk.venue,
    venueEnvironment: desk.venueEnvironment,
  };
}
