import { defaultPaperConfig, parsePaperRulesRow } from "@/lib/engine/rules";
import { parseAutomationMode, type PaperEngineConfig } from "@/lib/engine/decide";
import { selectPaperEngineSettings } from "@/lib/engine/settings";
import { getSessionContext } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";

export async function loadPaperRules(): Promise<{
  signedIn: boolean;
  config: PaperEngineConfig;
  inUseRuleIds: number[];
}> {
  const session = await getSessionContext();
  if (!session) {
    return { signedIn: false, config: defaultPaperConfig(), inUseRuleIds: [] };
  }

  const supabase = createServiceClient();
  if (!supabase) {
    return { signedIn: true, config: defaultPaperConfig(), inUseRuleIds: [] };
  }

  const [settingsRows, { data: rows }, { data: openRows }] =
    await Promise.all([
      selectPaperEngineSettings(supabase, { accountId: session.account.id }),
      supabase
        .from("paper_rules")
        .select("*")
        .eq("account_id", session.account.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("paper_carries")
        .select("rule_id")
        .eq("account_id", session.account.id)
        .in("status", ["open", "closing"])
        .not("rule_id", "is", null),
    ]);
  const settings = settingsRows[0];

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
      reduceOnly: Boolean(settings?.reduce_only),
      layers,
    },
    inUseRuleIds,
  };
}

/** Nav dot only. Modes, not full recipes. */
export async function loadCashAndCarryNavModes(accountId: string): Promise<{
  anyLive: boolean;
  anyActive: boolean;
}> {
  const supabase = createServiceClient();
  const id = accountId.trim();
  if (!supabase || !id) {
    return { anyLive: false, anyActive: false };
  }
  const { data, error } = await supabase
    .from("paper_rules")
    .select("mode")
    .eq("account_id", id);
  if (error || !data) {
    return { anyLive: false, anyActive: false };
  }
  const modes = data.map((row) =>
    parseAutomationMode((row as { mode?: unknown }).mode),
  );
  return {
    anyLive: modes.some((mode) => mode !== "disabled"),
    anyActive: modes.some((mode) => mode === "active"),
  };
}
