"use server";

import { runFuturesCommand } from "./command";
import { safeFuturesReturnPath } from "./path";
import { loadFuturesSettings } from "./settings";
import {
  formatStrategyDetachBlockers,
  strategyDetachBlockers,
} from "@/lib/accounts/model";
import { getSessionContext } from "@/lib/auth/session";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_PATHS, FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function fail(next: string, message: string): never {
  redirect(`${next}?paperError=${encodeURIComponent(message)}`);
}

function settingsFail(message: string): never {
  redirect(
    `${FUTURES_PATHS.settings}?error=${encodeURIComponent(message)}`,
  );
}

export async function submitFuturesTrade(formData: FormData) {
  const next = safeFuturesReturnPath(String(formData.get("next") ?? ""));
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member, account } = session;
  const result = await runFuturesCommand({
    actor: {
      userId: member.id,
      accountId: account.id,
      mode: account.mode,
    },
    command: {
      kind: "place",
      action: formData.get("action"),
      symbol: formData.get("symbol"),
      orderType: formData.get("orderType"),
      positionId: formData.get("positionId"),
      size: formData.get("size") ?? formData.get("qty"),
      sizeUnit: formData.get("sizeUnit"),
      limitPrice: formData.get("limitPrice"),
      tpslForm: formData,
      trailingForm: formData,
      idempotencyKey: formData.get("idempotencyKey"),
    },
  });
  if (!result.ok) {
    fail(next, result.error);
  }
  redirect(`${next}?paper=${result.flash}`);
}

export async function saveFuturesTpsl(formData: FormData) {
  const next = safeFuturesReturnPath(String(formData.get("next") ?? ""));
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member, account } = session;
  const result = await runFuturesCommand({
    actor: {
      userId: member.id,
      accountId: account.id,
      mode: account.mode,
    },
    command: {
      kind: "set-tpsl",
      positionId: formData.get("positionId"),
      symbol: formData.get("symbol"),
      form: formData,
      idempotencyKey: formData.get("idempotencyKey"),
    },
  });
  if (!result.ok) {
    fail(next, result.error);
  }
  redirect(`${next}?paper=${result.flash}`);
}

export async function saveFuturesTrailing(formData: FormData) {
  const next = safeFuturesReturnPath(String(formData.get("next") ?? ""));
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member, account } = session;
  const result = await runFuturesCommand({
    actor: {
      userId: member.id,
      accountId: account.id,
      mode: account.mode,
    },
    command: {
      kind: "set-trailing",
      positionId: formData.get("positionId"),
      symbol: formData.get("symbol"),
      form: formData,
      idempotencyKey: formData.get("idempotencyKey"),
    },
  });
  if (!result.ok) {
    fail(next, result.error);
  }
  redirect(`${next}?paper=${result.flash}`);
}

export async function cancelFuturesWorking(formData: FormData) {
  const next = safeFuturesReturnPath(String(formData.get("next") ?? ""));
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member, account } = session;
  const result = await runFuturesCommand({
    actor: {
      userId: member.id,
      accountId: account.id,
      mode: account.mode,
    },
    command: {
      kind: "cancel-working",
      workingId: formData.get("workingId"),
      idempotencyKey: formData.get("idempotencyKey"),
    },
  });
  if (!result.ok) {
    fail(next, result.error);
  }
  redirect(`${next}?paper=${result.flash}`);
}

export async function amendFuturesWorking(formData: FormData) {
  const next = safeFuturesReturnPath(String(formData.get("next") ?? ""));
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member, account } = session;
  const result = await runFuturesCommand({
    actor: {
      userId: member.id,
      accountId: account.id,
      mode: account.mode,
    },
    command: {
      kind: "amend-working",
      workingId: formData.get("workingId"),
      qty: formData.get("qty"),
      limitPrice: formData.get("limitPrice"),
      idempotencyKey: formData.get("idempotencyKey"),
    },
  });
  if (!result.ok) {
    fail(next, result.error);
  }
  redirect(`${next}?paper=${result.flash}`);
}

export async function saveFuturesSettings(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member: user, account } = session;
  const supabase = createServiceClient();
  if (!supabase) {
    settingsFail("Auth is not configured.");
  }

  const reduceOnly =
    formData.get("reduceOnly") === "on" ||
    formData.get("reduceOnly") === "true";

  let connectionId: string | null = null;
  const bindSubmitted = formData.has("exchangeConnectionId");
  if (accountCanHoldConnections(account.mode) && bindSubmitted) {
    const nextId = String(formData.get("exchangeConnectionId") ?? "").trim();
    connectionId = nextId === "" || nextId === "none" ? null : nextId;
    const current = await loadFuturesSettings(account.id);
    if (current.connectionId !== null && connectionId !== current.connectionId) {
      const opens = await loadOpenFuturesCount(account.id, user.id);
      const detach = strategyDetachBlockers({
        openCount: opens,
        automationsRunning: false,
      });
      if (detach.length > 0) {
        settingsFail(formatStrategyDetachBlockers(detach));
      }
    }
    if (connectionId) {
      const connections = await listExchangeConnections(user.id, account.id);
      const match = connections.find((item) => item.id === connectionId);
      if (!match) {
        settingsFail("Pick an exchange connection on this account.");
      } else if (match.status !== "active" && match.id !== current.connectionId) {
        settingsFail("That connection is not active.");
      }
    }
  }

  const { error } = await supabase.from("strategy_settings").upsert({
    user_id: user.id,
    account_id: account.id,
    strategy_id: FUTURES_STRATEGY_ID,
    reduce_only: reduceOnly,
    ...(accountCanHoldConnections(account.mode) && bindSubmitted
      ? { exchange_connection_id: connectionId }
      : {}),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    settingsFail(error.message);
  }

  await writeEventLog({
    scope: "strategy",
    event: "settings.saved",
    message: "Saved futures settings",
    userId: user.id,
    accountId: account.id,
    strategy: FUTURES_STRATEGY_ID,
    data: {
      reduceOnly,
      ...(bindSubmitted ? { exchangeConnectionId: connectionId } : {}),
    },
  });

  revalidatePath("/account/exchanges");
  revalidatePath(FUTURES_PATHS.root);
  revalidatePath(FUTURES_PATHS.settings);
  redirect(`${FUTURES_PATHS.settings}?saved=1`);
}

export async function detachFuturesConnection() {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member: user, account } = session;
  if (!accountCanHoldConnections(account.mode)) {
    redirect(FUTURES_PATHS.settings);
  }
  const supabase = createServiceClient();
  if (!supabase) {
    settingsFail("Auth is not configured.");
  }
  const settings = await loadFuturesSettings(account.id);
  if (!settings.connectionId) {
    redirect(FUTURES_PATHS.settings);
  }
  const opens = await loadOpenFuturesCount(account.id, user.id);
  const blocks = strategyDetachBlockers({
    openCount: opens,
    automationsRunning: false,
  });
  if (blocks.length > 0) {
    settingsFail(formatStrategyDetachBlockers(blocks));
  }
  const { error } = await supabase
    .from("strategy_settings")
    .update({
      exchange_connection_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", account.id)
    .eq("user_id", user.id)
    .eq("strategy_id", FUTURES_STRATEGY_ID);
  if (error) {
    settingsFail(error.message);
  }
  await writeEventLog({
    scope: "strategy",
    event: "settings.saved",
    message: "Detached futures exchange connection",
    userId: user.id,
    accountId: account.id,
    strategy: FUTURES_STRATEGY_ID,
    data: { exchangeConnectionId: null },
  });
  revalidatePath("/account/exchanges");
  revalidatePath(FUTURES_PATHS.root);
  revalidatePath(FUTURES_PATHS.settings);
  redirect(`${FUTURES_PATHS.settings}?saved=1`);
}

async function loadOpenFuturesCount(
  accountId: string,
  userId: string,
): Promise<number> {
  const supabase = createServiceClient();
  if (!supabase) {
    return 0;
  }
  const { count: positions } = await supabase
    .from("futures_positions")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .eq("status", "open");
  const { count: working } = await supabase
    .from("futures_working_orders")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .eq("user_id", userId)
    .eq("status", "open");
  return (positions ?? 0) + (working ?? 0);
}
