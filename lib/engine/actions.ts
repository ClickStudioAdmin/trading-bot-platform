"use server";

import { paperRulesToRow, parsePaperRulesForm } from "@/lib/engine/rules";
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

  const { error } = await supabase
    .from("paper_rules")
    .upsert(paperRulesToRow(user.id, parsed.rules), { onConflict: "user_id" });

  if (error) {
    redirect(`${RULES_PATH}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`${RULES_PATH}?saved=1`);
}
