import { defaultPaperConfig, parsePaperRulesRow } from "@/lib/engine/rules";
import type { PaperEngineConfig } from "@/lib/engine/decide";
import { getSessionMember } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";

export async function loadPaperRules(): Promise<{
  signedIn: boolean;
  config: PaperEngineConfig;
  inUseRuleIds: number[];
}> {
  const user = await getSessionMember();
  if (!user) {
    return { signedIn: false, config: defaultPaperConfig(), inUseRuleIds: [] };
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return { signedIn: true, config: defaultPaperConfig(), inUseRuleIds: [] };
  }

  const [{ data: settings }, { data: rows }, { data: openRows }] =
    await Promise.all([
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
      supabase
        .from("paper_carries")
        .select("rule_id")
        .eq("user_id", user.id)
        .in("status", ["open", "closing"])
        .not("rule_id", "is", null),
    ]);

  const layers = (rows ?? []).map((row, index) =>
    parsePaperRulesRow(row as Record<string, unknown>, index),
  );
  const inUseRuleIds = [
    ...new Set(
      (openRows ?? [])
        .map((row) => Number((row as { rule_id: unknown }).rule_id))
        .filter((id) => Number.isFinite(id)),
    ),
  ];

  return {
    signedIn: true,
    config: {
      enabled: Boolean(settings?.enabled),
      layers,
    },
    inUseRuleIds,
  };
}
