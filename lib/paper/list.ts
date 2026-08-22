import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import { pairKey, type OpportunityPaperProps } from "@/lib/paper/open";
import {
  markOpenCarries,
  parsePaperCarryRow,
  type MarkedPaperCarry,
  type PaperCarryRow,
} from "@/lib/paper/rows";
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

export async function listPaperCarries(): Promise<PaperCarryRow[]> {
  const supabase = await createUserClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("paper_carries")
    .select("*")
    .order("opened_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => parsePaperCarryRow(row as Record<string, unknown>));
}

export async function loadPaperDesk(scan: ScannedOpportunity[]): Promise<{
  signedIn: boolean;
  open: MarkedPaperCarry[];
  closed: PaperCarryRow[];
}> {
  const user = await getAuthUser();
  if (!user) {
    return { signedIn: false, open: [], closed: [] };
  }

  const rows = await listPaperCarries();
  const open = markOpenCarries(
    rows.filter((row) => row.status === "open"),
    scan,
  );
  const closed = rows.filter((row) => row.status === "closed");
  return { signedIn: true, open, closed };
}
