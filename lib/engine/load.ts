import { defaultPaperRules, parsePaperRulesRow } from "@/lib/engine/rules";
import type { PaperEngineRules } from "@/lib/engine/decide";
import { createUserClient, getAuthUser } from "@/lib/supabase/server";

export async function loadPaperRules(): Promise<{
  signedIn: boolean;
  rules: PaperEngineRules;
}> {
  const user = await getAuthUser();
  if (!user) {
    return { signedIn: false, rules: defaultPaperRules() };
  }

  const supabase = await createUserClient();
  if (!supabase) {
    return { signedIn: true, rules: defaultPaperRules() };
  }

  const { data, error } = await supabase
    .from("paper_rules")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return { signedIn: true, rules: defaultPaperRules() };
  }

  return {
    signedIn: true,
    rules: parsePaperRulesRow(data as Record<string, unknown>),
  };
}
