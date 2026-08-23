import { getSessionContext } from "@/lib/auth/session";
import { attachLogs, listEventLogs, type EventLogRow } from "@/lib/logs/list";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import { type OpportunityPaperProps } from "@/lib/paper/open";
import {
  attachOrders,
  parsePaperOrderRow,
  type PaperOrderRow,
} from "@/lib/paper/orders";
import {
  markOpenCarries,
  parsePaperCarryRow,
  type MarkedPaperCarry,
  type PaperCarryRow,
} from "@/lib/paper/rows";
import { createServiceClient } from "@/lib/supabase/admin";

export async function getOpportunityPaperProps(
  next: OpportunityPaperProps["next"],
): Promise<OpportunityPaperProps> {
  const session = await getSessionContext();
  return {
    signedIn: Boolean(session),
    canOpen: session?.account.mode === "paper",
    next,
  };
}

export async function listPaperCarries(): Promise<PaperCarryRow[]> {
  const session = await getSessionContext();
  const supabase = createServiceClient();
  if (!session || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("paper_carries")
    .select("*")
    .eq("account_id", session.account.id)
    .order("opened_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => parsePaperCarryRow(row as Record<string, unknown>));
}

export async function listPaperOrders(): Promise<PaperOrderRow[]> {
  try {
    const session = await getSessionContext();
    const supabase = createServiceClient();
    if (!session || !supabase) {
      return [];
    }

    const { data, error } = await supabase
      .from("paper_orders")
      .select("*")
      .eq("account_id", session.account.id)
      .order("filled_at", { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map((row) => parsePaperOrderRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export type PaperDeskCarry<T> = T & {
  orders: PaperOrderRow[];
  logs: EventLogRow[];
};

export async function loadPaperDesk(scan: ScannedOpportunity[]): Promise<{
  signedIn: boolean;
  open: PaperDeskCarry<MarkedPaperCarry>[];
  closed: PaperDeskCarry<PaperCarryRow>[];
}> {
  const session = await getSessionContext();
  if (!session) {
    return { signedIn: false, open: [], closed: [] };
  }

  const [rows, orders, logs] = await Promise.all([
    listPaperCarries(),
    listPaperOrders(),
    listEventLogs(
      { scope: "trade", level: "", event: "" },
      { accountId: session.account.id, limit: 400 },
    ),
  ]);
  const open = attachLogs(
    attachOrders(
      markOpenCarries(
        rows.filter((row) => row.status !== "closed"),
        scan,
      ),
      orders,
    ),
    logs,
  );
  const closed = attachLogs(
    attachOrders(
      rows.filter((row) => row.status === "closed"),
      orders,
    ),
    logs,
  );
  return { signedIn: true, open, closed };
}
