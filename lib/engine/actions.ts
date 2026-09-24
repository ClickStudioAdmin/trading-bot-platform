"use server";

import {
  bulkActionBlockReason,
  bulkModeFor,
  flattenOwnedRuleIds,
  parseBotBulkAction,
  parseBulkBotIds,
} from "@/lib/bots/status";
import {
  blockedRuleDeletes,
  paperConfigToFormValues,
  paperLayerToRow,
  parsePaperRulesForm,
  type PaperLayerFormValues,
} from "@/lib/engine/rules";
import { loadPaperRules } from "@/lib/engine/load";
import { closePaperCarryMarket } from "@/lib/paper/actions";
import { loadOpenPaperCarriesByRuleId } from "@/lib/paper/list";
import { applyDeskBindRules, loadAccountUsage } from "@/lib/accounts/store";
import {
  deskPath,
  formatStrategyDetachBlockers,
  strategyDetachBlockers,
  type TradingAccountMode,
} from "@/lib/accounts/model";
import { parseAutomationMode, type PaperEngineLayer } from "@/lib/engine/decide";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { parseReduceOnly } from "@/lib/engine/settings";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { parseUsableBookShare } from "@/lib/opportunities/capacity";
import { writeEventLog } from "@/lib/logs/write";
import { requireCashAndCarrySession } from "@/lib/accounts/guard";
import {
  commitDeskRename,
  readDeskNameFromSettingsForm,
} from "@/lib/accounts/actions";
import { createServiceClient } from "@/lib/supabase/admin";
import { afterDeskWork } from "@/lib/ui/after-desk-work";
import { deskActionError, type DeskActionResult } from "@/lib/ui/desk-action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const SETTINGS_PATH = "/strategies/cash-and-carry/settings";
const AUTOMATIONS_PATH = "/strategies/cash-and-carry/automations";

function settingsFail(accountId: string, error: string): never {
  redirect(deskPath(SETTINGS_PATH, accountId, { error }));
}

export type SavePaperRulesResult = DeskActionResult & {
  layers?: PaperLayerFormValues[];
  inUseRuleIds?: number[];
  reduceOnly?: boolean;
};

export async function savePaperRules(
  formData: FormData,
): Promise<SavePaperRulesResult> {
  const session = await requireCashAndCarrySession();
  const { member: user, account } = session;

  const parsed = parsePaperRulesForm(formData);
  if (!parsed.ok) {
    return deskActionError(parsed.error);
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return deskActionError("Auth is not configured.");
  }

  const one = String(formData.get("saveScope") ?? "").trim() === "one";
  const clearReduceOnly = !one && parsed.config.layers.length === 0;
  const savedLayers = one
    ? await upsertPaperRules({
        supabase,
        userId: user.id,
        accountId: account.id,
        layers: parsed.config.layers,
      })
    : await replacePaperRules({
        supabase,
        userId: user.id,
        accountId: account.id,
        layers: parsed.config.layers,
      });
  if (!savedLayers.ok) {
    await writeEventLog({
      level: "error",
      scope: "strategy",
      event: "automations.save_failed",
      message: savedLayers.error,
      userId: user.id,
      accountId: account.id,
      strategy: "cash-and-carry",
    });
    return deskActionError(savedLayers.error);
  }

  const loadedAfterRules = await loadPaperRules();
  const enabled = loadedAfterRules.config.layers.some(
    (layer) => layer.mode !== "disabled",
  );
  const { error: settingsError } = await supabase
    .from("paper_engine_settings")
    .upsert({
      user_id: user.id,
      account_id: account.id,
      enabled,
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
    return deskActionError(settingsError.message);
  }

  const closing =
    one && flattenOwnedRuleIds(parsed.config.layers).length > 0;
  if (closing) {
    afterDeskWork("cnc-flatten", async () => {
      const flattenErrors = await flattenOwnedPaperRules({
        supabase,
        userId: user.id,
        accountId: account.id,
        accountMode: account.mode,
        layers: parsed.config.layers,
      });
      if (flattenErrors) {
        await writeEventLog({
          level: "error",
          scope: "trade",
          event: "engine.close_failed",
          message: flattenErrors,
          userId: user.id,
          accountId: account.id,
          strategy: "cash-and-carry",
        });
      }
      revalidatePath("/strategies/cash-and-carry");
    });
  }

  await writeEventLog({
    scope: "strategy",
    event: "automations.saved",
    message:
      parsed.config.layers.length === 0
        ? "Cleared cash-and-carry automations"
        : one
          ? "Saved cash-and-carry bot"
          : `Saved ${parsed.config.layers.length} automation layer(s)`,
    userId: user.id,
    accountId: account.id,
    strategy: "cash-and-carry",
    data: {
      enabled,
      layerCount: parsed.config.layers.length,
      ...(clearReduceOnly ? { reduceOnly: false } : {}),
    },
  });

  const loaded = await loadPaperRules();
  return {
    ok: true,
    notice: closing
      ? "Bot saved. Closing carries…"
      : one
        ? "Bot saved."
        : "Bots saved.",
    layers: paperConfigToFormValues(loaded.config).layers,
    inUseRuleIds: loaded.inUseRuleIds,
    reduceOnly: loaded.config.reduceOnly,
  };
}

export async function setPaperBotModesAction(
  formData: FormData,
): Promise<SavePaperRulesResult> {
  const session = await requireCashAndCarrySession();
  const { member: user, account } = session;
  const bulk = parseBotBulkAction(formData.get("bulk"));
  const ids = parseBulkBotIds(formData);
  if (!bulk || ids.length === 0) {
    return deskActionError("Select at least one bot.");
  }
  if (bulk === "delete") {
    return deletePaperBots(user.id, account.id, ids);
  }
  const mode = parseAutomationMode(bulkModeFor("cnc", bulk));
  const supabase = createServiceClient();
  if (!supabase) {
    return deskActionError("Auth is not configured.");
  }
  const loaded = await loadPaperRules();
  const selected = loaded.config.layers.filter(
    (layer) => layer.id != null && ids.includes(String(layer.id)),
  );
  if (selected.length !== ids.length) {
    return deskActionError("That bot was not found.");
  }
  const blocked = bulkActionBlockReason(
    bulk,
    selected.map((layer) => ({ name: layer.name, statusKey: layer.mode })),
  );
  if (blocked) {
    return deskActionError(blocked);
  }
  const updated = selected.map((layer) => ({ ...layer, mode }));
  const saved = await upsertPaperRules({
    supabase,
    userId: user.id,
    accountId: account.id,
    layers: updated,
  });
  if (!saved.ok) {
    return deskActionError(saved.error);
  }
  const loadedAfter = await loadPaperRules();
  const enabled = loadedAfter.config.layers.some(
    (layer) => layer.mode !== "disabled",
  );
  const { error: settingsError } = await supabase
    .from("paper_engine_settings")
    .upsert({
      user_id: user.id,
      account_id: account.id,
      enabled,
      updated_at: new Date().toISOString(),
    });
  if (settingsError) {
    return deskActionError(settingsError.message);
  }
  const closing = flattenOwnedRuleIds(updated).length > 0;
  if (closing) {
    afterDeskWork("cnc-flatten", async () => {
      const flattenErrors = await flattenOwnedPaperRules({
        supabase,
        userId: user.id,
        accountId: account.id,
        accountMode: account.mode,
        layers: updated,
      });
      if (flattenErrors) {
        await writeEventLog({
          level: "error",
          scope: "trade",
          event: "engine.close_failed",
          message: flattenErrors,
          userId: user.id,
          accountId: account.id,
          strategy: "cash-and-carry",
        });
      }
      revalidatePath("/strategies/cash-and-carry");
    });
  }
  await writeEventLog({
    scope: "strategy",
    event: "automations.saved",
    message: `Set ${ids.length} cash-and-carry bot${ids.length === 1 ? "" : "s"} to ${mode}`,
    userId: user.id,
    accountId: account.id,
    strategy: "cash-and-carry",
    data: { ids, mode },
  });
  revalidatePath(AUTOMATIONS_PATH);
  const next = await loadPaperRules();
  return {
    ok: true,
    notice: closing ? "Bot saved. Closing carries…" : "Bot saved.",
    layers: paperConfigToFormValues(next.config).layers,
    inUseRuleIds: next.inUseRuleIds,
    reduceOnly: next.config.reduceOnly,
  };
}

async function deletePaperBots(
  userId: string,
  accountId: string,
  ids: string[],
): Promise<SavePaperRulesResult> {
  const supabase = createServiceClient();
  if (!supabase) {
    return deskActionError("Auth is not configured.");
  }
  const loaded = await loadPaperRules();
  const selected = loaded.config.layers.filter(
    (layer) => layer.id != null && ids.includes(String(layer.id)),
  );
  if (selected.length !== ids.length) {
    return deskActionError("That bot was not found.");
  }
  const blocked = selected.filter(
    (layer) => layer.id != null && loaded.inUseRuleIds.includes(layer.id),
  );
  if (blocked.length > 0) {
    const names = blocked.map((layer) => layer.name.trim() || "Bot").join(", ");
    return deskActionError(
      `Delete can’t include ${names}. Close an open position before deleting.`,
    );
  }
  const drop = new Set(ids);
  const remaining = loaded.config.layers.filter(
    (layer) => layer.id == null || !drop.has(String(layer.id)),
  );
  const saved = await replacePaperRules({
    supabase,
    userId,
    accountId,
    layers: remaining,
  });
  if (!saved.ok) {
    return deskActionError(saved.error);
  }
  const enabled = remaining.some((layer) => layer.mode !== "disabled");
  const { error: settingsError } = await supabase
    .from("paper_engine_settings")
    .upsert({
      user_id: userId,
      account_id: accountId,
      enabled,
      ...(remaining.length === 0 ? { reduce_only: false } : {}),
      updated_at: new Date().toISOString(),
    });
  if (settingsError) {
    return deskActionError(settingsError.message);
  }
  await writeEventLog({
    scope: "strategy",
    event: "automations.deleted",
    message: `Removed ${ids.length} cash-and-carry bot${ids.length === 1 ? "" : "s"}`,
    userId,
    accountId,
    strategy: "cash-and-carry",
    data: { ids },
  });
  revalidatePath(AUTOMATIONS_PATH);
  revalidatePath("/strategies/cash-and-carry");
  const next = await loadPaperRules();
  return {
    ok: true,
    notice: "Bot removed.",
    layers: paperConfigToFormValues(next.config).layers,
    inUseRuleIds: next.inUseRuleIds,
    reduceOnly: next.config.reduceOnly,
  };
}

export async function deletePaperRuleAction(
  formData: FormData,
): Promise<SavePaperRulesResult> {
  const session = await requireCashAndCarrySession();
  const { member: user, account } = session;
  const id = Number(String(formData.get("ruleId") ?? "").trim());
  if (!Number.isFinite(id)) {
    return deskActionError("That bot was not found.");
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return deskActionError("Auth is not configured.");
  }
  const loaded = await loadPaperRules();
  if (!loaded.config.layers.some((layer) => layer.id === id)) {
    return deskActionError("That bot was not found.");
  }
  if (loaded.inUseRuleIds.includes(id)) {
    return deskActionError("Cannot remove a bot that has an open position.");
  }
  const { error: unlinkError } = await supabase
    .from("paper_carries")
    .update({ rule_id: null })
    .eq("account_id", account.id)
    .eq("rule_id", id);
  if (unlinkError) {
    return deskActionError(unlinkError.message);
  }
  const remaining = loaded.config.layers.filter((layer) => layer.id !== id);
  const saved = await replacePaperRules({
    supabase,
    userId: user.id,
    accountId: account.id,
    layers: remaining,
  });
  if (!saved.ok) {
    return deskActionError(saved.error);
  }
  const enabled = remaining.some((layer) => layer.mode !== "disabled");
  const { error: settingsError } = await supabase
    .from("paper_engine_settings")
    .upsert({
      user_id: user.id,
      account_id: account.id,
      enabled,
      ...(remaining.length === 0 ? { reduce_only: false } : {}),
      updated_at: new Date().toISOString(),
    });
  if (settingsError) {
    return deskActionError(settingsError.message);
  }
  await writeEventLog({
    scope: "strategy",
    event: "automations.deleted",
    message: "Removed cash-and-carry bot",
    userId: user.id,
    accountId: account.id,
    strategy: "cash-and-carry",
    data: { ruleId: id },
  });
  revalidatePath(AUTOMATIONS_PATH);
  revalidatePath("/strategies/cash-and-carry");
  const next = await loadPaperRules();
  return {
    ok: true,
    notice: "Bot removed.",
    layers: paperConfigToFormValues(next.config).layers,
    inUseRuleIds: next.inUseRuleIds,
    reduceOnly: next.config.reduceOnly,
  };
}

async function upsertPaperRules(input: {
  supabase: NonNullable<ReturnType<typeof createServiceClient>>;
  userId: string;
  accountId: string;
  layers: PaperEngineLayer[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const layer of input.layers) {
    const payload = paperLayerToRow(input.userId, layer, input.accountId);
    if (layer.id !== null) {
      const { sort_order: _sortOrder, ...rest } = payload;
      const { error } = await input.supabase
        .from("paper_rules")
        .update(rest)
        .eq("id", layer.id)
        .eq("account_id", input.accountId);
      if (error) {
        return { ok: false, error: error.message };
      }
    } else {
      const { data: last } = await input.supabase
        .from("paper_rules")
        .select("sort_order")
        .eq("account_id", input.accountId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextSort =
        last && Number.isFinite(Number(last.sort_order))
          ? Number(last.sort_order) + 1
          : 0;
      const { error } = await input.supabase.from("paper_rules").insert({
        ...payload,
        sort_order: nextSort,
      });
      if (error) {
        return { ok: false, error: error.message };
      }
    }
  }
  return { ok: true };
}

async function replacePaperRules(input: {
  supabase: NonNullable<ReturnType<typeof createServiceClient>>;
  userId: string;
  accountId: string;
  layers: PaperEngineLayer[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing, error: loadError } = await input.supabase
    .from("paper_rules")
    .select("id")
    .eq("account_id", input.accountId);
  if (loadError) {
    return { ok: false, error: loadError.message };
  }

  const keepIds = new Set(
    input.layers
      .map((layer) => layer.id)
      .filter((id): id is number => id !== null && Number.isFinite(id)),
  );
  const staleIds = (existing ?? [])
    .map((row) => Number(row.id))
    .filter((id) => !keepIds.has(id));

  if (staleIds.length > 0) {
    const { data: openRows, error: openError } = await input.supabase
      .from("paper_carries")
      .select("rule_id")
      .eq("account_id", input.accountId)
      .in("status", ["open", "closing"])
      .in("rule_id", staleIds);
    if (openError) {
      return { ok: false, error: openError.message };
    }
    const blocked = blockedRuleDeletes(
      staleIds,
      (openRows ?? [])
        .map((row) => Number((row as { rule_id: unknown }).rule_id))
        .filter((id) => Number.isFinite(id)),
    );
    if (blocked.length > 0) {
      return { ok: false, error: "Cannot remove a bot that has an open position." };
    }
    const { error: unlinkError } = await input.supabase
      .from("paper_carries")
      .update({ rule_id: null })
      .eq("account_id", input.accountId)
      .in("rule_id", staleIds);
    if (unlinkError) {
      return { ok: false, error: unlinkError.message };
    }
    const { error } = await input.supabase
      .from("paper_rules")
      .delete()
      .eq("account_id", input.accountId)
      .in("id", staleIds);
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  for (const layer of input.layers) {
    const payload = paperLayerToRow(input.userId, layer, input.accountId);
    if (layer.id !== null) {
      const { error } = await input.supabase
        .from("paper_rules")
        .update(payload)
        .eq("id", layer.id)
        .eq("account_id", input.accountId);
      if (error) {
        return { ok: false, error: error.message };
      }
    } else {
      const { error } = await input.supabase.from("paper_rules").insert(payload);
      if (error) {
        return { ok: false, error: error.message };
      }
    }
  }
  return { ok: true };
}

async function flattenOwnedPaperRules(input: {
  supabase: NonNullable<ReturnType<typeof createServiceClient>>;
  userId: string;
  accountId: string;
  accountMode: TradingAccountMode;
  layers: { id: number | null; mode: string }[];
}): Promise<string | null> {
  for (const layer of flattenOwnedRuleIds(input.layers)) {
    const opens = await loadOpenPaperCarriesByRuleId(Number(layer.id), {
      accountId: input.accountId,
      userId: input.userId,
    });
    for (const row of opens) {
      const closed = await closePaperCarryMarket({
        supabase: input.supabase,
        userId: input.userId,
        accountId: input.accountId,
        accountMode: input.accountMode,
        row,
      });
      if (!closed.ok) {
        return closed.error;
      }
    }
  }
  return null;
}

export async function savePaperSettings(formData: FormData) {
  const session = await requireCashAndCarrySession();
  const { member: user, account } = session;
  const nameChange = await readDeskNameFromSettingsForm({
    formData,
    userId: user.id,
    accountId: account.id,
    currentName: account.name,
  });
  if (!nameChange.ok) {
    settingsFail(account.id, nameChange.error);
  }

  const parsed = parseUsableBookShare(formData.get("usableBookShare"));
  if (typeof parsed !== "number") {
    settingsFail(account.id, parsed.error);
  }
  const reduceOnly = parseReduceOnly(formData.get("reduceOnly"));

  const supabase = createServiceClient();
  if (!supabase) {
    settingsFail(account.id, "Auth is not configured.");
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
        openCount: row?.carryOpenCount ?? 0,
        automationsRunning: Boolean(row?.automationsRunning),
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
      } else if (match.status !== "active" && match.id !== currentId) {
        settingsFail(account.id, "That connection is not active.");
      } else {
        const bound = await applyDeskBindRules({
          userId: user.id,
          account,
          connectionId,
        });
        if (bound.error) {
          settingsFail(account.id, bound.error);
        }
      }
    }
  }

  const { error } = await supabase.from("paper_engine_settings").upsert({
    user_id: user.id,
    account_id: account.id,
    usable_book_share: parsed,
    reduce_only: reduceOnly,
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
    settingsFail(account.id, error.message);
  }

  if (nameChange.changed) {
    const renamed = await commitDeskRename({
      userId: user.id,
      accountId: account.id,
      name: nameChange.name,
    });
    if (renamed.error) {
      settingsFail(account.id, renamed.error);
    }
  }

  await writeEventLog({
    scope: "strategy",
    event: "settings.saved",
    message: "Saved desk settings",
    userId: user.id,
    accountId: account.id,
    strategy: "cash-and-carry",
    data: {
      usableBookShare: parsed,
      reduceOnly,
      ...(bindSubmitted ? { exchangeConnectionId: connectionId } : {}),
    },
  });

  revalidatePath("/account/exchanges");
  revalidatePath("/strategies/cash-and-carry");
  redirect(deskPath(SETTINGS_PATH, account.id, { saved: "1" }));
}

export async function detachStrategyConnection() {
  const session = await requireCashAndCarrySession();
  const { member: user, account } = session;
  if (!accountCanHoldConnections(account.mode)) {
    redirect(deskPath(SETTINGS_PATH, account.id));
  }
  const supabase = createServiceClient();
  if (!supabase) {
    settingsFail(account.id, "Auth is not configured.");
  }
  const usage = await loadAccountUsage([account]);
  const row = usage.get(account.id);
  if (!row?.strategyConnectionId) {
    redirect(deskPath(SETTINGS_PATH, account.id));
  }
  const blocks = strategyDetachBlockers({
    openCount: row.carryOpenCount,
    automationsRunning: row.automationsRunning,
  });
  if (blocks.length > 0) {
    settingsFail(account.id, formatStrategyDetachBlockers(blocks));
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
    settingsFail(account.id, error.message);
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
  revalidatePath("/strategies/cash-and-carry");
  redirect(deskPath(SETTINGS_PATH, account.id, { saved: "1" }));
}
