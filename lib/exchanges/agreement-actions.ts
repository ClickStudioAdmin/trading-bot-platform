"use server";

import { enableBybitAgreementChoice } from "@/lib/exchanges/agreement-store";
import type { BybitAgreementKind } from "@/lib/exchanges/agreement";
import { getExchangeConnectionForUser } from "@/lib/exchanges/store";
import { getSessionContext } from "@/lib/auth/session";
import { ACCOUNT_EXCHANGES_HREF } from "@/lib/site-links";
import { FUTURES_PATHS } from "@/lib/strategies/registry";
import { revalidatePath } from "next/cache";

export async function enableBybitAgreement(input: {
  connectionId: string;
  kind?: BybitAgreementKind;
  symbol?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionContext();
  if (!session) {
    return { ok: false, error: "Sign in to enable those contracts." };
  }
  const connectionId = String(input.connectionId ?? "").trim();
  const owned = await getExchangeConnectionForUser({
    userId: session.member.id,
    connectionId,
  });
  if (!owned || owned.venue !== "bybit") {
    return { ok: false, error: "That exchange connection was not found." };
  }
  const kind =
    input.kind === "tradfi" || input.kind === "oil" ? input.kind : null;
  const enabled = await enableBybitAgreementChoice({
    connectionId,
    kind,
    symbol: input.symbol,
  });
  if (!enabled.ok) {
    return enabled;
  }
  revalidatePath(ACCOUNT_EXCHANGES_HREF);
  revalidatePath("/account/sub-accounts");
  revalidatePath(FUTURES_PATHS.automations);
  revalidatePath(FUTURES_PATHS.positions);
  revalidatePath(FUTURES_PATHS.webhooks);
  return { ok: true };
}
