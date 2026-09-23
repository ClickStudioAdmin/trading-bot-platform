import { getSessionContext } from "@/lib/auth/session";
import { deskHref } from "@/lib/accounts/model";
import { loadEngineSettings } from "@/lib/engine/settings";
import { listExchangeConnections } from "@/lib/exchanges/store";
import { accountCanHoldConnections } from "@/lib/exchanges/venues";
import {
  attachLogs,
  listEventLogs,
  listEventLogsForAnchors,
  mergeEventLogs,
  type EventLogRow,
} from "@/lib/logs/list";
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
  const stamped = deskHref(next, session?.account.id);
  if (!session) {
    return { signedIn: false, canOpen: false, venueOpen: false, next: stamped };
  }
  if (session.account.mode === "paper") {
    return { signedIn: true, canOpen: true, venueOpen: false, next: stamped };
  }
  if (!accountCanHoldConnections(session.account.mode)) {
    return { signedIn: true, canOpen: false, venueOpen: false, next: stamped };
  }
  const settings = await loadEngineSettings();
  if (!settings.connectionId) {
    return { signedIn: true, canOpen: false, venueOpen: false, next: stamped };
  }
  const connections = await listExchangeConnections(session.member.id);
  const bound = connections.find(
    (row) => row.id === settings.connectionId && row.status === "active",
  );
  return {
    signedIn: true,
    canOpen: Boolean(bound),
    venueOpen: Boolean(bound),
    next: stamped,
  };
}

export async function loadOpenPaperCarriesByRuleId(
  ruleId: number,
  scope: { accountId: string; userId: string },
): Promise<PaperCarryRow[]> {
  const supabase = createServiceClient();
  const id = Number(ruleId);
  if (!supabase || !Number.isFinite(id)) {
    return [];
  }
  const { data, error } = await supabase
    .from("paper_carries")
    .select("*")
    .eq("account_id", scope.accountId)
    .eq("user_id", scope.userId)
    .eq("rule_id", id)
    .in("status", ["open", "closing"]);
  if (error || !data) {
    return [];
  }
  return data.map((row) => parsePaperCarryRow(row as Record<string, unknown>));
}

type PaperCarryQuery = {
  eq(column: string, value: string | number): PaperCarryQuery;
  in(column: string, values: readonly string[]): PaperCarryQuery;
  order(column: string, options: { ascending: boolean }): PaperCarryQuery;
  then: PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>["then"];
};

function paperCarryQuery(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  accountId: string,
  input?: { status?: "open" | "closed"; ruleId?: number },
): PaperCarryQuery {
  let query = supabase.from("paper_carries").select("*") as unknown as PaperCarryQuery;
  query = query.eq("account_id", accountId).order("opened_at", { ascending: false });
  if (input?.status === "closed") {
    query = query.eq("status", "closed");
  } else if (input?.status === "open") {
    query = query.in("status", ["open", "closing"]);
  }
  if (input?.ruleId != null) {
    query = query.eq("rule_id", input.ruleId);
  }
  return query;
}

export async function listPaperCarriesFiltered(input?: {
  status?: "open" | "closed";
  ruleId?: number;
}): Promise<PaperCarryRow[]> {
  const session = await getSessionContext();
  const supabase = createServiceClient();
  if (!session || !supabase) {
    return [];
  }
  const { data, error } = await paperCarryQuery(
    supabase,
    session.account.id,
    input,
  );
  if (error || !data) {
    return [];
  }
  return data.map((row) => parsePaperCarryRow(row as Record<string, unknown>));
}

export async function listPaperCarries(): Promise<PaperCarryRow[]> {
  return listPaperCarriesFiltered();
}

export async function listPaperBotOptions(): Promise<
  { id: string; name: string }[]
> {
  const session = await getSessionContext();
  const supabase = createServiceClient();
  if (!session || !supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("paper_rules")
    .select("id,name")
    .eq("account_id", session.account.id)
    .order("sort_order", { ascending: true });
  if (error || !data) {
    return [];
  }
  return data.flatMap((row) => {
    const id = Number((row as { id?: unknown }).id);
    if (!Number.isFinite(id)) {
      return [];
    }
    const name = String((row as { name?: unknown }).name ?? "").trim();
    return [{ id: String(id), name: name || "Bot" }];
  });
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

async function listOpenFillClips(
  accountId: string,
  carryIds: readonly number[],
): Promise<{ carryId: number; notionalUsdt: number; fillBasis: number; hasFillPrices: boolean }[]> {
  const supabase = createServiceClient();
  if (!supabase || carryIds.length === 0) {
    return [];
  }
  const clips: {
    carryId: number;
    notionalUsdt: number;
    fillBasis: number;
    hasFillPrices: boolean;
  }[] = [];
  for (let index = 0; index < carryIds.length; index += 40) {
    const batch = carryIds.slice(index, index + 40);
    const { data, error } = await supabase
      .from("paper_orders")
      .select("carry_id,notional_usdt,fill_basis,fill_spot_price,fill_future_price")
      .eq("account_id", accountId)
      .eq("side", "open")
      .in("carry_id", batch);
    if (error || !data) {
      continue;
    }
    for (const row of data) {
      const record = row as {
        carry_id?: unknown;
        notional_usdt?: unknown;
        fill_basis?: unknown;
        fill_spot_price?: unknown;
        fill_future_price?: unknown;
      };
      const carryId = Number(record.carry_id);
      const notionalUsdt = Number(record.notional_usdt);
      const fillBasis = Number(record.fill_basis);
      if (!Number.isFinite(carryId) || !(notionalUsdt > 0) || !Number.isFinite(fillBasis)) {
        continue;
      }
      clips.push({
        carryId,
        notionalUsdt,
        fillBasis,
        hasFillPrices:
          Number(record.fill_spot_price) > 0 &&
          Number(record.fill_future_price) > 0,
      });
    }
  }
  return clips;
}

export async function loadPaperOpenCarryRows(input?: {
  ruleId?: number;
}): Promise<{
  signedIn: boolean;
  exchangeBook: boolean;
  rows: PaperCarryRow[];
  fills: {
    carryId: number;
    notionalUsdt: number;
    fillBasis: number;
    hasFillPrices: boolean;
  }[];
}> {
  const session = await getSessionContext();
  if (!session) {
    return { signedIn: false, exchangeBook: false, rows: [], fills: [] };
  }
  const rows = await listPaperCarriesFiltered({
    status: "open",
    ruleId: input?.ruleId,
  });
  const fills = await listOpenFillClips(
    session.account.id,
    rows.map((row) => row.id),
  );
  return {
    signedIn: true,
    exchangeBook: accountCanHoldConnections(session.account.mode),
    rows,
    fills,
  };
}

export function paperBotRuleId(bot: string): number | undefined {
  if (!/^\d+$/.test(bot)) {
    return undefined;
  }
  const id = Number(bot);
  return id > 0 ? id : undefined;
}

export async function loadPaperPerformanceBook(input?: {
  ruleId?: number;
}): Promise<{
  signedIn: boolean;
  exchangeBook: boolean;
  closed: (PaperCarryRow & { orders: PaperOrderRow[]; logs: EventLogRow[] })[];
}> {
  const session = await getSessionContext();
  if (!session) {
    return { signedIn: false, exchangeBook: false, closed: [] };
  }
  const closed = await listPaperCarriesFiltered({
    status: "closed",
    ruleId: input?.ruleId,
  });
  return {
    signedIn: true,
    exchangeBook: accountCanHoldConnections(session.account.mode),
    closed: closed.map((row) => ({ ...row, orders: [], logs: [] })),
  };
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

  const [rows, orders] = await Promise.all([
    listPaperCarries(),
    listPaperOrders(),
  ]);
  const liveOpenedMs = rows.reduce((oldest, row) => {
    if (row.status === "closed" || !(row.openedAtMs > 0)) {
      return oldest;
    }
    return oldest === 0 ? row.openedAtMs : Math.min(oldest, row.openedAtMs);
  }, 0);
  const [recentLogs, anchoredLogs] = await Promise.all([
    listEventLogs(
      { scope: "", level: "", event: "" },
      {
        accountId: session.account.id,
        limit: 500,
        scopes: ["trade", "strategy"],
        since:
          liveOpenedMs > 0
            ? new Date(liveOpenedMs - 60_000).toISOString()
            : undefined,
      },
    ),
    listEventLogsForAnchors({
      accountId: session.account.id,
      field: "carryId",
      ids: rows.map((row) => String(row.id)),
    }),
  ]);
  const logs = mergeEventLogs(recentLogs, anchoredLogs);
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
