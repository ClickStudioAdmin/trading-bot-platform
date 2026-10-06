"use server";

import { getSessionMember } from "@/lib/auth/session";
import { saveReplayViewPreferences } from "@/lib/backtest/replay-preferences-store";

export async function saveReplayViewPreferencesAction(
  input: unknown,
): Promise<{ ok: boolean }> {
  const member = await getSessionMember();
  if (!member?.emailVerifiedAt) {
    return { ok: false };
  }
  const ok = await saveReplayViewPreferences(member.id, input);
  return { ok };
}
