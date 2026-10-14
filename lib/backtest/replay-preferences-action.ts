"use server";

import { memberIsAdmin } from "@/lib/admin/access";
import { getSessionMember } from "@/lib/auth/session";
import { addedReferenceIndicatorIds, parseReplayRunIndicators } from "@/lib/backtest/replay-preferences";
import {
  loadReplayRunIndicators,
  saveReplayRunIndicators,
  saveReplayViewPreferences,
} from "@/lib/backtest/replay-preferences-store";
import { deniedNewReplayIndicatorsMessage } from "@/lib/membership/load-research-gate-access";
import { canReadBacktestRun, loadBacktestRun } from "@/lib/backtest/store";

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

export async function saveReplayRunIndicatorsAction(
  runId: string,
  input: unknown,
): Promise<{ ok: boolean }> {
  const member = await getSessionMember();
  if (!member?.emailVerifiedAt || !runId) {
    return { ok: false };
  }
  const run = await loadBacktestRun(runId);
  if (!run || !canReadBacktestRun(run, member.id, memberIsAdmin(member))) {
    return { ok: false };
  }
  const next = parseReplayRunIndicators(input);
  const previous = await loadReplayRunIndicators(member.id, run.id);
  const added = addedReferenceIndicatorIds(
    previous?.referenceIndicators ?? [],
    next.referenceIndicators,
  );
  if (added.length > 0) {
    const denied = await deniedNewReplayIndicatorsMessage(member.id);
    if (denied) {
      return { ok: false };
    }
  }
  const ok = await saveReplayRunIndicators(member.id, run.id, input);
  return { ok };
}
