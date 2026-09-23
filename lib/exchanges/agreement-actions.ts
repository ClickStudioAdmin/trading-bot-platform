"use server";

import { enableBybitAgreementChoice } from "@/lib/exchanges/agreement-store";
import type { BybitAgreementKind } from "@/lib/exchanges/agreement";
import {
  getExchangeConnectionForUser,
  listExchangeConnections,
} from "@/lib/exchanges/store";
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

export async function enableBybitAgreementGroups(input: {
  kind?: BybitAgreementKind;
}): Promise<
  { ok: true } | { ok: false; error: string; reason?: "needs-connection" }
> {
  const session = await getSessionContext();
  if (!session) {
    return { ok: false, error: "Sign in to enable those contracts." };
  }
  const kind =
    input.kind === "tradfi" || input.kind === "oil" ? input.kind : null;
  if (!kind) {
    return { ok: false, error: "That contract group was not found." };
  }
  const connections = await listExchangeConnections(session.member.id);
  const bybit = connections.filter((row) => row.venue === "bybit");
  if (bybit.length === 0) {
    return {
      ok: false,
      error: "Save the Bybit connection first.",
      reason: "needs-connection",
    };
  }
  const results = await Promise.all(
    bybit.map((row) =>
      enableBybitAgreementChoice({
        connectionId: row.id,
        kind,
      }),
    ),
  );
  const failed = results.find((result) => !result.ok);
  if (failed) {
    return failed;
  }
  revalidatePath(ACCOUNT_EXCHANGES_HREF);
  revalidatePath("/account/sub-accounts");
  revalidatePath(FUTURES_PATHS.automations);
  revalidatePath(FUTURES_PATHS.positions);
  revalidatePath(FUTURES_PATHS.webhooks);
  return { ok: true };
}
