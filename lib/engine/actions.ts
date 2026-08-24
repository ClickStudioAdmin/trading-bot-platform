"use server";

import {
  blockedRuleDeletes,
  paperLayerToRow,
  parsePaperRulesForm,
} from "@/lib/engine/rules";
import { parseReduceOnly } from "@/lib/engine/settings";
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

  const { error: settingsError } = await supabase
    .from("paper_engine_settings")
    .upsert({
      user_id: user.id,
      account_id: account.id,
      enabled: parsed.config.enabled,
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
    },
  });

  revalidatePath("/account/exchanges");
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

  const { error } = await supabase.from("paper_engine_settings").upsert({
    user_id: user.id,
    account_id: account.id,
    usable_book_share: parsed,
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
    data: { usableBookShare: parsed },
  });

  revalidatePath("/account/exchanges");
  redirect(`${SETTINGS_PATH}?saved=1`);
}

export async function saveAccountReduceOnly(formData: FormData) {
  const session = await getSessionContext();
  if (!session) {
    redirect("/sign-in");
  }
  const { member: user, account } = session;
  const reduceOnly = parseReduceOnly(formData.get("reduceOnly"));

  const supabase = createServiceClient();
  if (!supabase) {
    redirect(
      `${RULES_PATH}?error=${encodeURIComponent("Auth is not configured.")}`,
    );
  }

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
  revalidatePath("/strategies/cash-and-carry");
  redirect(`${RULES_PATH}?reduce=1`);
}
