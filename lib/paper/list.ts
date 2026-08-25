import { getSessionContext } from "@/lib/auth/session";
import { loadEngineSettings } from "@/lib/engine/settings";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import { attachLogs, listEventLogs, type EventLogRow } from "@/lib/logs/list";
import type { ScannedOpportunity } from "@/lib/opportunities/scan";
import { type OpportunityPaperProps } from "@/lib/paper/open";
import {
  attachOrders,
  parsePaperOrderRow,
  type PaperOrderRow,
} from "@/lib/paper/orders";
import { weightedOpenFillBasis } from "@/lib/paper/math";
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
  if (!session) {
    return { signedIn: false, canOpen: false, venueOpen: false, next };
  }
  if (session.account.mode === "paper") {
    return { signedIn: true, canOpen: true, venueOpen: false, next };
  }
  if (!accountCanHoldConnections(session.account.mode)) {
    return { signedIn: true, canOpen: false, venueOpen: false, next };
  }
  const settings = await loadEngineSettings();
  if (!settings.connectionId) {
    return { signedIn: true, canOpen: false, venueOpen: false, next };
  }
  const connections = await listExchangeConnections(
    session.member.id,
    session.account.id,
  );
  const bound = connections.find(
    (row) => row.id === settings.connectionId && row.status === "active",
  );
  return {
    signedIn: true,
    canOpen: Boolean(bound),
    venueOpen: Boolean(bound),
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
  exchangeBook: boolean;
  open: PaperDeskCarry<MarkedPaperCarry>[];
  closed: PaperDeskCarry<PaperCarryRow>[];
}> {
  const session = await getSessionContext();
  if (!session) {
    return { signedIn: false, exchangeBook: false, open: [], closed: [] };
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
        orders
          .filter((order) => order.side === "open")
          .map((order) => ({
            carryId: order.carryId,
            notionalUsdt: order.notionalUsdt,
            fillBasis: order.fillBasis,
            hasFillPrices:
              order.fillSpotPrice !== null && order.fillFuturePrice !== null,
          })),
      ),
      orders,
    ),
    logs,
  );
  const closed = attachLogs(
    attachOrders(
      rows
        .filter((row) => row.status === "closed")
        .map((row) => {
          const entry = weightedOpenFillBasis(
            orders.filter(
              (order) => order.carryId === row.id && order.side === "open",
            ),
          );
          return entry === null ? row : { ...row, entryBasis: entry };
        }),
      orders,
    ),
    logs,
  );
  return {
    signedIn: true,
    exchangeBook: accountCanHoldConnections(session.account.mode),
    open,
    closed,
  };
}
