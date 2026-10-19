"use server";

import { memberIsAdmin } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";
import {
  backtestsForBotRecipes,
  loadDeskBacktestBot,
} from "@/lib/backtest/desk-bots";
import type { TemplateBacktestLink } from "@/lib/backtest/model";

export async function loadBacktestDeskBotAction(botId: string) {
  const member = await getSessionMember();
  if (!member) {
    return { ok: false as const, error: "Sign in to load a desk bot." };
  }
  return loadDeskBacktestBot(member.id, botId);
}

export async function backtestsForBotRecipesAction(
  bots: Array<{ id: string; recipe: unknown }>,
): Promise<Record<string, TemplateBacktestLink[]>> {
  const member = await getSessionMember();
  if (!member?.emailVerifiedAt) {
    return {};
  }
  return backtestsForBotRecipes({
    userId: member.id,
    isAdmin: memberIsAdmin(member),
    bots: Array.isArray(bots) ? bots : [],
  });
}
