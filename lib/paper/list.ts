import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import { type OpportunityPaperProps } from "@/lib/paper/open";
import {
  attachOrders,
  parsePaperOrderRow,
  type PaperCarryWithOrders,
  type PaperOrderRow,
} from "@/lib/paper/orders";
import {
  markOpenCarries,
  parsePaperCarryRow,
  type MarkedPaperCarry,
  type PaperCarryRow,
} from "@/lib/paper/rows";
import { getSessionMember } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";

export async function getOpportunityPaperProps(
  next: OpportunityPaperProps["next"],
): Promise<OpportunityPaperProps> {
  const user = await getSessionMember();
  return {
    signedIn: Boolean(user),
    next,
  };
}

export async function listPaperCarries(): Promise<PaperCarryRow[]> {
  const user = await getSessionMember();
  const supabase = createServiceClient();
  if (!user || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("paper_carries")
    .select("*")
    .eq("user_id", user.id)
    .order("opened_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => parsePaperCarryRow(row as Record<string, unknown>));
}

export async function listPaperOrders(): Promise<PaperOrderRow[]> {
  try {
    const user = await getSessionMember();
    const supabase = createServiceClient();
    if (!user || !supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from("paper_orders")
      .select("*")
      .eq("user_id", user.id)
      .order("filled_at", { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map((row) => parsePaperOrderRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function loadPaperDesk(scan: ScannedOpportunity[]): Promise<{
  signedIn: boolean;
  open: (MarkedPaperCarry & { orders: PaperOrderRow[] })[];
  closed: PaperCarryWithOrders[];
}> {
  const user = await getSessionMember();
  if (!user) {
    return { signedIn: false, open: [], closed: [] };
  }

  const [rows, orders] = await Promise.all([
    listPaperCarries(),
    listPaperOrders(),
  ]);
  const open = attachOrders(
    markOpenCarries(
      rows.filter((row) => row.status !== "closed"),
      scan,
    ),
    orders,
  );
  const closed = attachOrders(
    rows.filter((row) => row.status === "closed"),
    orders,
  );
  return { signedIn: true, open, closed };
}
