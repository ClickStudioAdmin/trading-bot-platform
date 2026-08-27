"use server";

import { parseFuturesAutomationForm } from "./automation";
import {
  futuresAutomationsAreRunning,
  saveFuturesAutomationRules,
} from "./automation-load";
import { runFuturesCommand } from "./command";
import { parseFuturesAction } from "./model";
import { safeFuturesReturnPath } from "./path";
import {
  parseOptionalPositive,
  parseOptionalPositiveInt,
} from "./risk";
import { loadFuturesSettings } from "./settings";
import { handleFuturesWebhook } from "./webhook-handle";
import {
  createFuturesWebhook,
  deleteFuturesWebhook,
  loadWebhookTokenForTest,
  renameFuturesWebhook,
  rotateFuturesWebhookToken,
} from "./webhook-load";
import { parseWebhookKind } from "./webhook";
import {
  deskAllowsManualPerpTicket,
  deskAllowsOrderWebhooks,
  deskAllowsPerpsRecipes,
  deskAllowsSignalWebhooks,
  deskManualBuySellBlockReason,
  deskPath,
  formatStrategyDetachBlockers,
  strategyDetachBlockers,
  withQuery,
} from "@/lib/accounts/model";
import { requirePerpsUiSession } from "@/lib/accounts/guard";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { writeEventLog } from "@/lib/logs/write";
import { FUTURES_PATHS, FUTURES_STRATEGY_ID } from "@/lib/strategies/registry";
import { createServiceClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function fail(next: string, message: string): never {
  redirect(withQuery(next, { paperError: message }));
}

function settingsFail(accountId: string, message: string): never {
  redirect(deskPath(FUTURES_PATHS.settings, accountId, { error: message }));
}

function webhookFail(accountId: string, message: string): never {
  redirect(deskPath(FUTURES_PATHS.webhooks, accountId, { error: message }));
}

export async function submitFuturesTrade(formData: FormData) {
  const next = safeFuturesReturnPath(String(formData.get("next") ?? ""));
  const session = await requirePerpsUiSession();
  const { member, account } = session;
  const parsed = parseFuturesAction(formData.get("action"));
  if (
    !deskAllowsManualPerpTicket(account.deskType) &&
    parsed.ok &&
    (parsed.action === "buy" || parsed.action === "sell")
  ) {
    fail(
      next,
      deskManualBuySellBlockReason(account.deskType) ??
        "This desk does not take Buy or Sell from the ticket.",
    );
  }
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
  redirect(withQuery(next, { paper: result.flash }));
}

export async function saveFuturesTpsl(formData: FormData) {
  const next = safeFuturesReturnPath(String(formData.get("next") ?? ""));
  const session = await requirePerpsUiSession();
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
  redirect(withQuery(next, { paper: result.flash }));
}

export async function saveFuturesTrailing(formData: FormData) {
  const next = safeFuturesReturnPath(String(formData.get("next") ?? ""));
  const session = await requirePerpsUiSession();
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
  redirect(withQuery(next, { paper: result.flash }));
}

export async function cancelFuturesWorking(formData: FormData) {
  const next = safeFuturesReturnPath(String(formData.get("next") ?? ""));
  const session = await requirePerpsUiSession();
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
  redirect(withQuery(next, { paper: result.flash }));
}

export async function closeAllFutures(formData: FormData) {
  const next = safeFuturesReturnPath(String(formData.get("next") ?? ""));
  const session = await requirePerpsUiSession();
  const { member, account } = session;
  const result = await runFuturesCommand({
    actor: {
      userId: member.id,
      accountId: account.id,
      mode: account.mode,
    },
    command: {
      kind: "close-all",
      scope: formData.get("scope"),
      confirm: formData.get("confirm"),
      setReduceOnly: formData.get("setReduceOnly"),
      idempotencyKey: formData.get("idempotencyKey"),
    },
  });
  if (!result.ok) {
    fail(next, result.error);
  }
  redirect(withQuery(next, { paper: result.flash }));
}

export async function amendFuturesWorking(formData: FormData) {
  const next = safeFuturesReturnPath(String(formData.get("next") ?? ""));
  const session = await requirePerpsUiSession();
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
  redirect(withQuery(next, { paper: result.flash }));
}

export async function saveFuturesSettings(formData: FormData) {
  const session = await requirePerpsUiSession();
  const { member: user, account } = session;
  const supabase = createServiceClient();
  if (!supabase) {
    settingsFail(account.id, "Auth is not configured.");
  }

  const reduceOnly =
    formData.get("reduceOnly") === "on" ||
    formData.get("reduceOnly") === "true";
  const maxValue = parseOptionalPositive(
    formData.get("maxValuePerSymbol") ?? formData.get("maxNotionalPerSymbol"),
    "Max value per symbol",
  );
  if (!maxValue.ok) {
    settingsFail(account.id, maxValue.error);
  }
  const maxRows = parseOptionalPositiveInt(
    formData.get("maxOpenPositions") ?? formData.get("maxOpenRows"),
    "Max open positions",
  );
  if (!maxRows.ok) {
    settingsFail(account.id, maxRows.error);
  }

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
        settingsFail(account.id, formatStrategyDetachBlockers(detach));
      }
    }
    if (connectionId) {
      const connections = await listExchangeConnections(user.id);
      const match = connections.find((item) => item.id === connectionId);
      if (!match) {
        settingsFail(account.id, "Pick an exchange key saved on this login.");
      } else if (match.status !== "active" && match.id !== current.connectionId) {
        settingsFail(account.id, "That connection is not active.");
      }
    }
  }

  const { error } = await supabase.from("strategy_settings").upsert({
    user_id: user.id,
    account_id: account.id,
    strategy_id: FUTURES_STRATEGY_ID,
    reduce_only: reduceOnly,
    max_notional_per_symbol: maxValue.value,
    max_open_rows: maxRows.value,
    ...(accountCanHoldConnections(account.mode) && bindSubmitted
      ? { exchange_connection_id: connectionId }
      : {}),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    settingsFail(account.id, error.message);
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
      maxValuePerSymbol: maxValue.value,
      maxOpenPositions: maxRows.value,
      ...(bindSubmitted ? { exchangeConnectionId: connectionId } : {}),
    },
  });

  revalidatePath("/account/exchanges");
  revalidatePath(FUTURES_PATHS.root);
  revalidatePath(FUTURES_PATHS.settings);
  redirect(deskPath(FUTURES_PATHS.settings, account.id, { saved: "1" }));
}

export async function saveFuturesAutomations(formData: FormData) {
  const session = await requirePerpsUiSession();
  const { member: user, account } = session;
  if (!deskAllowsPerpsRecipes(account.deskType)) {
    if (account.deskType === "signal_follower") {
      redirect(deskPath(FUTURES_PATHS.webhooks, account.id));
    }
    redirect(deskPath(FUTURES_PATHS.automations, account.id));
  }
  const parsed = parseFuturesAutomationForm(formData);
  if (!parsed.ok) {
    redirect(
      deskPath(FUTURES_PATHS.automations, account.id, { error: parsed.error }),
    );
  }
  const supabase = createServiceClient();
  if (!supabase) {
    redirect(
      deskPath(FUTURES_PATHS.automations, account.id, {
        error: "Auth is not configured.",
      }),
    );
  }
  const saved = await saveFuturesAutomationRules({
    supabase,
    userId: user.id,
    accountId: account.id,
    rules: parsed.rules,
  });
  if (!saved.ok) {
    await writeEventLog({
      level: "error",
      scope: "strategy",
      event: "automations.save_failed",
      message: saved.error,
      userId: user.id,
      accountId: account.id,
      strategy: FUTURES_STRATEGY_ID,
    });
    redirect(
      deskPath(FUTURES_PATHS.automations, account.id, { error: saved.error }),
    );
  }
  await writeEventLog({
    scope: "strategy",
    event: "automations.saved",
    message:
      parsed.rules.length === 0
        ? "Cleared futures automations"
        : `Saved ${parsed.rules.length} futures automation ${parsed.rules.length === 1 ? "rule" : "rules"}`,
    userId: user.id,
    accountId: account.id,
    strategy: FUTURES_STRATEGY_ID,
    data: { count: parsed.rules.length },
  });
  revalidatePath(FUTURES_PATHS.automations);
  revalidatePath(FUTURES_PATHS.positions);
  redirect(deskPath(FUTURES_PATHS.automations, account.id, { saved: "1" }));
}

export async function detachFuturesConnection() {
  const session = await requirePerpsUiSession();
  const { member: user, account } = session;
  if (!accountCanHoldConnections(account.mode)) {
    redirect(deskPath(FUTURES_PATHS.settings, account.id));
  }
  const supabase = createServiceClient();
  if (!supabase) {
    settingsFail(account.id, "Auth is not configured.");
  }
  const settings = await loadFuturesSettings(account.id);
  if (!settings.connectionId) {
    redirect(deskPath(FUTURES_PATHS.settings, account.id));
  }
  const opens = await loadOpenFuturesCount(account.id, user.id);
  const blocks = strategyDetachBlockers({
    openCount: opens,
    automationsRunning: await futuresAutomationsAreRunning(account.id),
  });
  if (blocks.length > 0) {
    settingsFail(account.id, formatStrategyDetachBlockers(blocks));
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
    settingsFail(account.id, error.message);
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
  redirect(deskPath(FUTURES_PATHS.settings, account.id, { saved: "1" }));
}

export async function createFuturesWebhookAction(formData: FormData) {
  const session = await requirePerpsUiSession();
  const supabase = createServiceClient();
  if (!supabase) {
    webhookFail(session.account.id, "Auth is not configured.");
  }
  const kind = parseWebhookKind(formData.get("kind"));
  if (
    kind.ok &&
    kind.kind === "signal" &&
    !deskAllowsSignalWebhooks(session.account.deskType)
  ) {
    webhookFail(session.account.id, "This desk only uses TradingView strategy webhooks.");
  }
  if (
    kind.ok &&
    kind.kind === "order" &&
    !deskAllowsOrderWebhooks(session.account.deskType)
  ) {
    webhookFail(session.account.id, "This desk only uses Signal webhooks to arm the playbook.");
  }
  const created = await createFuturesWebhook({
    supabase,
    userId: session.member.id,
    accountId: session.account.id,
    name: formData.get("name"),
    kind: formData.get("kind"),
  });
  if (!created.ok) {
    webhookFail(session.account.id, created.error);
  }
  await writeEventLog({
    scope: "strategy",
    event: "webhook.created",
    message: "Created a Futures webhook",
    userId: session.member.id,
    accountId: session.account.id,
    strategy: FUTURES_STRATEGY_ID,
  });
  revalidatePath(FUTURES_PATHS.webhooks);
  revalidatePath(FUTURES_PATHS.positions);
  revalidatePath(FUTURES_PATHS.automations);
  redirect(deskPath(FUTURES_PATHS.webhooks, session.account.id, { created: "1" }));
}

export async function renameFuturesWebhookAction(formData: FormData) {
  const session = await requirePerpsUiSession();
  const supabase = createServiceClient();
  if (!supabase) {
    webhookFail(session.account.id, "Auth is not configured.");
  }
  const webhookId = String(formData.get("webhookId") ?? "").trim();
  if (!webhookId) {
    webhookFail(session.account.id, "Pick a webhook.");
  }
  const renamed = await renameFuturesWebhook({
    supabase,
    userId: session.member.id,
    accountId: session.account.id,
    webhookId,
    name: formData.get("name"),
  });
  if (!renamed.ok) {
    webhookFail(session.account.id, renamed.error);
  }
  await writeEventLog({
    scope: "strategy",
    event: "webhook.renamed",
    message: "Renamed a Futures webhook",
    userId: session.member.id,
    accountId: session.account.id,
    strategy: FUTURES_STRATEGY_ID,
  });
  revalidatePath(FUTURES_PATHS.webhooks);
  revalidatePath(FUTURES_PATHS.automations);
  redirect(deskPath(FUTURES_PATHS.webhooks, session.account.id, { renamed: "1" }));
}

export async function rotateFuturesWebhook(formData: FormData) {
  const session = await requirePerpsUiSession();
  const supabase = createServiceClient();
  if (!supabase) {
    webhookFail(session.account.id, "Auth is not configured.");
  }
  const webhookId = String(formData.get("webhookId") ?? "").trim();
  if (!webhookId) {
    webhookFail(session.account.id, "Pick a webhook.");
  }
  const rotated = await rotateFuturesWebhookToken({
    supabase,
    userId: session.member.id,
    accountId: session.account.id,
    webhookId,
  });
  if (!rotated.ok) {
    webhookFail(session.account.id, rotated.error);
  }
  await writeEventLog({
    scope: "strategy",
    event: "webhook.rotated",
    message: "Rotated a Futures webhook URL",
    userId: session.member.id,
    accountId: session.account.id,
    strategy: FUTURES_STRATEGY_ID,
  });
  revalidatePath(FUTURES_PATHS.webhooks);
  redirect(deskPath(FUTURES_PATHS.webhooks, session.account.id, { rotated: "1" }));
}

export async function deleteFuturesWebhookAction(formData: FormData) {
  const session = await requirePerpsUiSession();
  const supabase = createServiceClient();
  if (!supabase) {
    webhookFail(session.account.id, "Auth is not configured.");
  }
  const webhookId = String(formData.get("webhookId") ?? "").trim();
  if (!webhookId) {
    webhookFail(session.account.id, "Pick a webhook.");
  }
  const removed = await deleteFuturesWebhook({
    supabase,
    userId: session.member.id,
    accountId: session.account.id,
    webhookId,
  });
  if (!removed.ok) {
    webhookFail(session.account.id, removed.error);
  }
  await writeEventLog({
    scope: "strategy",
    event: "webhook.deleted",
    message: "Deleted a Futures webhook",
    userId: session.member.id,
    accountId: session.account.id,
    strategy: FUTURES_STRATEGY_ID,
  });
  revalidatePath(FUTURES_PATHS.webhooks);
  revalidatePath(FUTURES_PATHS.positions);
  revalidatePath(FUTURES_PATHS.automations);
  redirect(deskPath(FUTURES_PATHS.webhooks, session.account.id, { deleted: "1" }));
}

export async function testFuturesWebhook(formData: FormData) {
  const next = safeFuturesReturnPath(String(formData.get("next") ?? ""));
  const successNext = safeFuturesReturnPath(
    String(formData.get("successNext") ?? next),
  );
  const session = await requirePerpsUiSession();
  const supabase = createServiceClient();
  if (!supabase) {
    fail(next, "Auth is not configured.");
  }
  const webhookId = String(formData.get("webhookId") ?? "").trim();
  const loaded = await loadWebhookTokenForTest({
    supabase,
    userId: session.member.id,
    accountId: session.account.id,
    webhookId,
  });
  if (!loaded.ok) {
    fail(next, loaded.error);
  }
  const kind = parseWebhookKind(loaded.kind);
  const testAction = String(formData.get("testAction") ?? "buy")
    .trim()
    .toLowerCase();
  const rawBody =
    kind.ok && kind.kind === "signal"
      ? { action: testAction.startsWith("close-playbook") ? "close-playbook" : testAction === "disarm" ? "disarm" : "arm" }
      : {
          action: testAction === "sell" || testAction === "close" ? testAction : "buy",
          symbol: formData.get("symbol"),
          size: formData.get("size") ?? formData.get("qty"),
          sizeUnit: formData.get("sizeUnit"),
          orderType: formData.get("orderType"),
          limitPrice: formData.get("limitPrice"),
          id: `test-${Date.now()}`.slice(0, 36),
        };
  const result = await handleFuturesWebhook({
    token: loaded.token,
    rawBody,
  });
  if (!result.body.ok) {
    fail(next, String(result.body.error ?? "Webhook test failed."));
  }
  if (result.body.accepted) {
    if (Number(result.body.fired) > 0) {
      redirect(
        withQuery(successNext, {
          paper: session.account.mode === "live" ? "live-opened" : "opened",
        }),
      );
    }
    redirect(withQuery(successNext, { paper: "webhook-arm" }));
  }
  redirect(
    withQuery(successNext, {
      paper: String(result.body.flash ?? "opened"),
    }),
  );
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
