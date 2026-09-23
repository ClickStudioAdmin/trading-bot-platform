"use server";

import { getSessionMember } from "@/lib/auth/session";
import { loadDeskBacktestBot } from "@/lib/backtest/desk-bots";

export async function loadBacktestDeskBotAction(botId: string) {
  const member = await getSessionMember();
  if (!member) {
    return { ok: false as const, error: "Sign in to load a desk bot." };
  }
  return loadDeskBacktestBot(member.id, botId);
}
