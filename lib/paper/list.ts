import { pairKey, type OpportunityPaperProps } from "@/lib/paper/open";
import { createUserClient, getAuthUser } from "@/lib/supabase/server";

export async function listOpenPaperPairKeys(): Promise<Set<string>> {
  const supabase = await createUserClient();
  if (!supabase) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("paper_carries")
    .select("spot_symbol, future_symbol")
    .eq("status", "open");

  if (error || !data) {
    return new Set();
  }

  return new Set(
    data.map((row) => pairKey(row.spot_symbol, row.future_symbol)),
  );
}

export async function getOpportunityPaperProps(
  next: OpportunityPaperProps["next"],
): Promise<OpportunityPaperProps> {
  const user = await getAuthUser();
  return {
    signedIn: Boolean(user),
    openKeys: user ? await listOpenPaperPairKeys() : new Set(),
    next,
  };
}
