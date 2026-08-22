import { defaultPaperConfig, parsePaperRulesRow } from "@/lib/engine/rules";
import type { PaperEngineConfig } from "@/lib/engine/decide";
import { createUserClient, getAuthUser } from "@/lib/supabase/server";

export async function loadPaperRules(): Promise<{
  signedIn: boolean;
  config: PaperEngineConfig;
}> {
  const user = await getAuthUser();
  if (!user) {
    return { signedIn: false, config: defaultPaperConfig() };
  }

  const supabase = await createUserClient();
  if (!supabase) {
    return { signedIn: true, config: defaultPaperConfig() };
  }

  const [{ data: settings }, { data: rows }] = await Promise.all([
    supabase
      .from("paper_engine_settings")
      .select("enabled")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("paper_rules")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
  ]);

  const layers = (rows ?? []).map((row, index) =>
    parsePaperRulesRow(row as Record<string, unknown>, index),
  );

  return {
    signedIn: true,
    config: {
      enabled: Boolean(settings?.enabled),
      layers: layers.length > 0 ? layers : defaultPaperConfig().layers,
    },
  };
}
