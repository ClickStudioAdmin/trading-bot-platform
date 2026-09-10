"use server";

import { flattenOwnedRuleIds } from "@/lib/bots/status";
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
import type { PaperEngineLayer } from "@/lib/engine/decide";
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
import { deskActionError, type DeskActionResult } from "@/lib/ui/desk-action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const SETTINGS_PATH = "/strategies/cash-and-carry/settings";

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

  if (one) {
    const flattenErrors = await flattenOwnedPaperRules({
      supabase,
      userId: user.id,
      accountId: account.id,
      accountMode: account.mode,
      layers: parsed.config.layers,
    });
    if (flattenErrors) {
      return deskActionError(flattenErrors);
    }
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
    notice: one ? "Bot saved." : "Bots saved.",
    layers: paperConfigToFormValues(loaded.config).layers,
    inUseRuleIds: loaded.inUseRuleIds,
    reduceOnly: loaded.config.reduceOnly,
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
      ...(bindSubmitted ? { exchangeConnectionId: connectionId } : {}),
    },
  });

  revalidatePath("/account/exchanges");
  revalidatePath("/account/book");
  revalidatePath("/strategies/cash-and-carry");
  redirect(deskPath(SETTINGS_PATH, account.id, { saved: "1" }));
}

export type SaveReduceOnlyResult = DeskActionResult & {
  reduceOnly?: boolean;
};

export async function saveAccountReduceOnly(
  formData: FormData,
): Promise<SaveReduceOnlyResult> {
  const session = await requireCashAndCarrySession();
  const { member: user, account } = session;
  const supabase = createServiceClient();
  if (!supabase) {
    return deskActionError("Auth is not configured.");
  }

  const { count: setCount, error: countError } = await supabase
    .from("paper_rules")
    .select("id", { count: "exact", head: true })
    .eq("account_id", account.id);
  if (countError) {
    return deskActionError(countError.message);
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
    return deskActionError(error.message);
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

  return {
    ok: true,
    notice: reduceOnly ? "Reduce only is on." : "Reduce only is off.",
    reduceOnly,
  };
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
  revalidatePath("/account/book");
  revalidatePath("/strategies/cash-and-carry");
  redirect(deskPath(SETTINGS_PATH, account.id, { saved: "1" }));
}
