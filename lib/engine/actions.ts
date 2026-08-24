"use server";

import {
  blockedRuleDeletes,
  paperLayerToRow,
  parsePaperRulesForm,
} from "@/lib/engine/rules";
import { loadAccountUsage } from "@/lib/accounts/store";
import {
  formatStrategyDetachBlockers,
  strategyDetachBlockers,
} from "@/lib/accounts/model";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { parseReduceOnly } from "@/lib/engine/settings";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { parseUsableBookShare } from "@/lib/opportunities/capacity";
import { writeEventLog } from "@/lib/logs/write";
import { getSessionContext } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const RULES_PATH = "/strategies/cash-and-carry/automations";

export async function savePaperRules(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member: user, account } = session;

  const parsed = parsePaperRulesForm(formData);
  if (!parsed.ok) {
    redirect(`${RULES_PATH}?error=${encodeURIComponent(parsed.error)}`);
  }

  const supabase = createServiceClient();
  if (!supabase) {
    redirect(`${RULES_PATH}?error=${encodeURIComponent("Auth is not configured.")}`);
  }

  const clearReduceOnly = parsed.config.layers.length === 0;
  const { error: settingsError } = await supabase
    .from("paper_engine_settings")
    .upsert({
      user_id: user.id,
      account_id: account.id,
      enabled: parsed.config.enabled,
      ...(clearReduceOnly ? { reduce_only: false } : {}),
      updated_at: new Date().toISOString(),
    });

  if (settingsError) {
    await writeEventLog({
      level: "error",
      scope: "strategy",
      event: "automations.save_failed",
      message: settingsError.message,
      userId: user.id,
      accountId: account.id,
      strategy: "cash-and-carry",
    });
    redirect(`${RULES_PATH}?error=${encodeURIComponent(settingsError.message)}`);
  }

  const { data: existing, error: loadError } = await supabase
    .from("paper_rules")
    .select("id")
    .eq("account_id", account.id);

  if (loadError) {
    await writeEventLog({
      level: "error",
      scope: "strategy",
      event: "automations.save_failed",
      message: loadError.message,
      userId: user.id,
      accountId: account.id,
      strategy: "cash-and-carry",
    });
    redirect(`${RULES_PATH}?error=${encodeURIComponent(loadError.message)}`);
  }

  const keepIds = new Set(
    parsed.config.layers
      .map((layer) => layer.id)
      .filter((id): id is number => id !== null && Number.isFinite(id)),
  );
  const staleIds = (existing ?? [])
    .map((row) => Number(row.id))
    .filter((id) => !keepIds.has(id));

  if (staleIds.length > 0) {
    const { data: openRows, error: openError } = await supabase
      .from("paper_carries")
      .select("rule_id")
      .eq("account_id", account.id)
      .in("status", ["open", "closing"])
      .in("rule_id", staleIds);

    if (openError) {
      await writeEventLog({
        level: "error",
        scope: "strategy",
        event: "automations.save_failed",
        message: openError.message,
        userId: user.id,
        accountId: account.id,
        strategy: "cash-and-carry",
      });
      redirect(`${RULES_PATH}?error=${encodeURIComponent(openError.message)}`);
    }

    const blocked = blockedRuleDeletes(
      staleIds,
      (openRows ?? [])
        .map((row) => Number((row as { rule_id: unknown }).rule_id))
        .filter((id) => Number.isFinite(id)),
    );
    if (blocked.length > 0) {
      redirect(
        `${RULES_PATH}?error=${encodeURIComponent("Cannot remove a rule set that has an open position.")}`,
      );
    }

    const { error } = await supabase
      .from("paper_rules")
      .delete()
      .eq("account_id", account.id)
      .in("id", staleIds);
    if (error) {
      await writeEventLog({
        level: "error",
        scope: "strategy",
        event: "automations.save_failed",
        message: error.message,
        userId: user.id,
        accountId: account.id,
        strategy: "cash-and-carry",
      });
      redirect(`${RULES_PATH}?error=${encodeURIComponent(error.message)}`);
    }
  }

  for (const layer of parsed.config.layers) {
    const payload = paperLayerToRow(user.id, layer, account.id);
    if (layer.id !== null) {
      const { error } = await supabase
        .from("paper_rules")
        .update(payload)
        .eq("id", layer.id)
        .eq("account_id", account.id);
      if (error) {
        await writeEventLog({
          level: "error",
          scope: "strategy",
          event: "automations.save_failed",
          message: error.message,
          userId: user.id,
          accountId: account.id,
          strategy: "cash-and-carry",
        });
        redirect(`${RULES_PATH}?error=${encodeURIComponent(error.message)}`);
      }
    } else {
      const { error } = await supabase.from("paper_rules").insert(payload);
      if (error) {
        await writeEventLog({
          level: "error",
          scope: "strategy",
          event: "automations.save_failed",
          message: error.message,
          userId: user.id,
          accountId: account.id,
          strategy: "cash-and-carry",
        });
        redirect(`${RULES_PATH}?error=${encodeURIComponent(error.message)}`);
      }
    }
  }

  await writeEventLog({
    scope: "strategy",
    event: "automations.saved",
    message: `Saved ${parsed.config.layers.length} automation layer(s)`,
    userId: user.id,
    accountId: account.id,
    strategy: "cash-and-carry",
    data: {
      enabled: parsed.config.enabled,
      layerCount: parsed.config.layers.length,
      ...(clearReduceOnly ? { reduceOnly: false } : {}),
    },
  });

  revalidatePath("/account/exchanges");
  revalidatePath("/account");
  revalidatePath("/account/book");
  revalidatePath("/strategies/cash-and-carry");
  redirect(`${RULES_PATH}?saved=1`);
}

const SETTINGS_PATH = "/strategies/cash-and-carry/settings";

export async function savePaperSettings(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member: user, account } = session;

  const parsed = parseUsableBookShare(formData.get("usableBookShare"));
  if (typeof parsed !== "number") {
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(parsed.error)}`);
  }

  const supabase = createServiceClient();
  if (!supabase) {
    redirect(
      `${SETTINGS_PATH}?error=${encodeURIComponent("Auth is not configured.")}`,
    );
  }

  let connectionId: string | null = null;
  const bindSubmitted = formData.has("exchangeConnectionId");
  if (accountCanHoldConnections(account.mode) && bindSubmitted) {
    const nextId = String(formData.get("exchangeConnectionId") ?? "").trim();
    connectionId = nextId === "" || nextId === "none" ? null : nextId;
    const currentRows = await supabase
      .from("paper_engine_settings")
      .select("exchange_connection_id")
      .eq("account_id", account.id)
      .maybeSingle();
    const currentId = String(
      (currentRows.data as { exchange_connection_id?: unknown } | null)
        ?.exchange_connection_id ?? "",
    ).trim() || null;
    if (currentId !== null && connectionId !== currentId) {
      const usage = await loadAccountUsage([account]);
      const row = usage.get(account.id);
      const detach = strategyDetachBlockers({
        openCount: row?.openCount ?? 0,
        automationsRunning: Boolean(row?.automationsRunning),
      });
      if (detach.length > 0) {
        redirect(
          `${SETTINGS_PATH}?error=${encodeURIComponent(formatStrategyDetachBlockers(detach))}`,
        );
      }
    }
    if (connectionId) {
      const connections = await listExchangeConnections(user.id, account.id);
      const match = connections.find((item) => item.id === connectionId);
      if (!match) {
        redirect(
          `${SETTINGS_PATH}?error=${encodeURIComponent("Pick an exchange connection on this account.")}`,
        );
      } else if (match.status !== "active" && match.id !== currentId) {
        redirect(
          `${SETTINGS_PATH}?error=${encodeURIComponent("That connection is not active.")}`,
        );
      }
    }
  }

  const { error } = await supabase.from("paper_engine_settings").upsert({
    user_id: user.id,
    account_id: account.id,
    usable_book_share: parsed,
    ...(accountCanHoldConnections(account.mode) && bindSubmitted
      ? { exchange_connection_id: connectionId }
      : {}),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    await writeEventLog({
      level: "error",
      scope: "strategy",
      event: "settings.save_failed",
      message: error.message,
      userId: user.id,
      accountId: account.id,
      strategy: "cash-and-carry",
    });
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(error.message)}`);
  }

  await writeEventLog({
    scope: "strategy",
    event: "settings.saved",
    message: "Saved strategy settings",
    userId: user.id,
    accountId: account.id,
    strategy: "cash-and-carry",
    data: {
      usableBookShare: parsed,
      ...(bindSubmitted ? { exchangeConnectionId: connectionId } : {}),
    },
  });

  revalidatePath("/account/exchanges");
  revalidatePath("/account/book");
  revalidatePath("/strategies/cash-and-carry");
  redirect(`${SETTINGS_PATH}?saved=1`);
}

export async function saveAccountReduceOnly(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member: user, account } = session;
  const supabase = createServiceClient();
  if (!supabase) {
    redirect(
      `${RULES_PATH}?error=${encodeURIComponent("Auth is not configured.")}`,
    );
  }

  const { count: setCount, error: countError } = await supabase
    .from("paper_rules")
    .select("id", { count: "exact", head: true })
    .eq("account_id", account.id);
  if (countError) {
    redirect(`${RULES_PATH}?error=${encodeURIComponent(countError.message)}`);
  }
  const reduceOnly =
    (setCount ?? 0) > 0 && parseReduceOnly(formData.get("reduceOnly"));

  const { error } = await supabase.from("paper_engine_settings").upsert({
    user_id: user.id,
    account_id: account.id,
    reduce_only: reduceOnly,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    await writeEventLog({
      level: "error",
      scope: "strategy",
      event: "settings.save_failed",
      message: error.message,
      userId: user.id,
      accountId: account.id,
      strategy: "cash-and-carry",
    });
    redirect(`${RULES_PATH}?error=${encodeURIComponent(error.message)}`);
  }

  await writeEventLog({
    scope: "strategy",
    event: "settings.saved",
    message: reduceOnly ? "Turned on reduce only" : "Turned off reduce only",
    userId: user.id,
    accountId: account.id,
    strategy: "cash-and-carry",
    data: { reduceOnly },
  });

  revalidatePath("/account/exchanges");
  revalidatePath("/account/book");
  revalidatePath("/strategies/cash-and-carry");
  redirect(`${RULES_PATH}?reduce=1`);
}

export async function detachStrategyConnection() {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member: user, account } = session;
  if (!accountCanHoldConnections(account.mode)) {
    redirect(SETTINGS_PATH);
  }
  const supabase = createServiceClient();
  if (!supabase) {
    redirect(
      `${SETTINGS_PATH}?error=${encodeURIComponent("Auth is not configured.")}`,
    );
  }
  const usage = await loadAccountUsage([account]);
  const row = usage.get(account.id);
  if (!row?.strategyConnectionId) {
    redirect(SETTINGS_PATH);
  }
  const blocks = strategyDetachBlockers({
    openCount: row.openCount,
    automationsRunning: row.automationsRunning,
  });
  if (blocks.length > 0) {
    redirect(
      `${SETTINGS_PATH}?error=${encodeURIComponent(formatStrategyDetachBlockers(blocks))}`,
    );
  }
  const { error } = await supabase
    .from("paper_engine_settings")
    .update({
      exchange_connection_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", account.id)
    .eq("user_id", user.id);
  if (error) {
    redirect(`${SETTINGS_PATH}?error=${encodeURIComponent(error.message)}`);
  }
  await writeEventLog({
    scope: "strategy",
    event: "settings.saved",
    message: "Detached exchange connection",
    userId: user.id,
    accountId: account.id,
    strategy: "cash-and-carry",
    data: { exchangeConnectionId: null },
  });
  revalidatePath("/account/exchanges");
  revalidatePath("/account/book");
  revalidatePath("/strategies/cash-and-carry");
  redirect(`${SETTINGS_PATH}?saved=1`);
}
