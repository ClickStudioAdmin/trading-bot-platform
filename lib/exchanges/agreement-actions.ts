"use server";

import { requirePerpsUiSession } from "@/lib/accounts/guard";
import { enableBybitAgreementChoice } from "@/lib/exchanges/agreement-store";
import type { BybitAgreementKind } from "@/lib/exchanges/agreement";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { loadFuturesSettings } from "@/lib/futures/settings";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { revalidatePath } from "next/cache";

export async function enableBybitAgreement(input: {
  kind?: BybitAgreementKind;
  symbol?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requirePerpsUiSession();
  if (
    session.account.venue !== "bybit" ||
    !accountCanHoldConnections(session.account.mode)
  ) {
    return { ok: false, error: "This desk does not trade those Bybit contracts." };
  }
  const kind =
    input.kind === "tradfi" || input.kind === "oil" ? input.kind : null;
  const settings = await loadFuturesSettings(session.account.id);
  const enabled = await enableBybitAgreementChoice({
    connectionId: settings.connectionId,
    kind,
    symbol: input.symbol,
  });
  if (!enabled.ok) {
    return enabled;
  }
  revalidatePath(FUTURES_PATHS.automations);
  revalidatePath(FUTURES_PATHS.positions);
  revalidatePath(FUTURES_PATHS.webhooks);
  return { ok: true };
}
