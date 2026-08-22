"use server";

import { paperLayerToRow, parsePaperRulesForm } from "@/lib/engine/rules";
import { createUserClient, getAuthUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const RULES_PATH = "/strategies/cash-and-carry/rules";

export async function savePaperRules(formData: FormData) {
  const user = await getAuthUser();
  if (!user) {
    redirect("/sign-in");
  }

  const parsed = parsePaperRulesForm(formData);
  if (!parsed.ok) {
    redirect(`${RULES_PATH}?error=${encodeURIComponent(parsed.error)}`);
  }

  const supabase = await createUserClient();
  if (!supabase) {
    redirect(`${RULES_PATH}?error=${encodeURIComponent("Auth is not configured.")}`);
  }

  const { error: settingsError } = await supabase
    .from("paper_engine_settings")
    .upsert({
      user_id: user.id,
      enabled: parsed.config.enabled,
      updated_at: new Date().toISOString(),
    });

  if (settingsError) {
    redirect(`${RULES_PATH}?error=${encodeURIComponent(settingsError.message)}`);
  }

  const { data: existing, error: loadError } = await supabase
    .from("paper_rules")
    .select("id")
    .eq("user_id", user.id);

  if (loadError) {
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
    const { error } = await supabase
      .from("paper_rules")
      .delete()
      .eq("user_id", user.id)
      .in("id", staleIds);
    if (error) {
      redirect(`${RULES_PATH}?error=${encodeURIComponent(error.message)}`);
    }
  }

  for (const layer of parsed.config.layers) {
    const payload = paperLayerToRow(user.id, layer);
    if (layer.id !== null) {
      const { error } = await supabase
        .from("paper_rules")
        .update(payload)
        .eq("id", layer.id)
        .eq("user_id", user.id);
      if (error) {
        redirect(`${RULES_PATH}?error=${encodeURIComponent(error.message)}`);
      }
    } else {
      const { error } = await supabase.from("paper_rules").insert(payload);
      if (error) {
        redirect(`${RULES_PATH}?error=${encodeURIComponent(error.message)}`);
      }
    }
  }

  redirect(`${RULES_PATH}?saved=1`);
}
