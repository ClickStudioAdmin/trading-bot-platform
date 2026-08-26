import { parseDeskType } from "@/lib/accounts/model";
import { parseAutomationMode } from "@/lib/engine/decide";
import { createServiceClient } from "@/lib/supabase/admin";

export type AdminOverviewIssue = {
  id: number;
  createdAt: string;
  level: "warning" | "error";
  event: string;
  message: string;
};

export type AdminOverview = {
  configured: boolean;
  members: {
    total: number;
    active: number;
    disabled: number;
    admins: number;
  };
  desks: {
    total: number;
    paper: number;
    live: number;
    cashAndCarry: number;
    perps: number;
    signalFollower: number;
  };
  keys: { total: number };
  positions: {
    cashAndCarryOpen: number;
    cashAndCarryClosing: number;
    perpsOpen: number;
  };
  automations: {
    running: number;
    cashAndCarry: number;
    perps: number;
  };
  scan: { count: number; lastAtMs: number | null };
  lastTick: { at: string; event: string; message: string } | null;
  issues: AdminOverviewIssue[];
};

const emptyOverview: AdminOverview = {
  configured: false,
  members: { total: 0, active: 0, disabled: 0, admins: 0 },
  desks: {
    total: 0,
    paper: 0,
    live: 0,
    cashAndCarry: 0,
    perps: 0,
    signalFollower: 0,
  },
  keys: { total: 0 },
  positions: {
    cashAndCarryOpen: 0,
    cashAndCarryClosing: 0,
    perpsOpen: 0,
  },
  automations: { running: 0, cashAndCarry: 0, perps: 0 },
  scan: { count: 0, lastAtMs: null },
  lastTick: null,
  issues: [],
};

export async function loadAdminOverview(): Promise<AdminOverview> {
  const supabase = createServiceClient();
  if (!supabase) {
    return emptyOverview;
  }

  const [
    members,
    desks,
    carries,
    futuresOpens,
    settings,
    paperRules,
    futuresRules,
    keys,
    opportunityCount,
    latestScan,
    lastTick,
    issues,
  ] = await Promise.all([
    supabase.from("members").select("role, status"),
    supabase.from("trading_accounts").select("id, mode, desk_type"),
    supabase
      .from("paper_carries")
      .select("status")
      .in("status", ["open", "closing"]),
    supabase
      .from("futures_positions")
      .select("id")
      .eq("status", "open"),
    supabase.from("paper_engine_settings").select("account_id, enabled"),
    supabase.from("paper_rules").select("account_id, mode"),
    supabase.from("futures_automation_rules").select("account_id, mode"),
    supabase
      .from("exchange_connections")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("opportunities")
      .select("spot_symbol", { count: "exact", head: true }),
    supabase
      .from("opportunities")
      .select("scanned_at")
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("event_logs")
      .select("created_at, event, message")
      .in("event", ["engine.tick", "engine.tick_admin"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("event_logs")
      .select("id, created_at, level, event, message")
      .in("level", ["error", "warning"])
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const memberRows = members.data ?? [];
  const deskRows = desks.data ?? [];
  const cashAndCarryIds = new Set<string>();
  const perpsIds = new Set<string>();
  let paper = 0;
  let live = 0;
  let cashAndCarry = 0;
  let perps = 0;
  let signalFollower = 0;
  for (const row of deskRows) {
    const id = String((row as { id: string }).id);
    const type = parseDeskType((row as { desk_type?: unknown }).desk_type);
    if ((row as { mode?: unknown }).mode === "live") {
      live += 1;
    } else {
      paper += 1;
    }
    if (type === "perps") {
      perps += 1;
      perpsIds.add(id);
    } else if (type === "signal_follower") {
      signalFollower += 1;
    } else {
      cashAndCarry += 1;
      cashAndCarryIds.add(id);
    }
  }

  const carryRows = carries.data ?? [];
  const enabled = new Set(
    (settings.data ?? [])
      .filter((row) => Boolean((row as { enabled?: unknown }).enabled))
      .map((row) => String((row as { account_id: string }).account_id)),
  );
  const paperRuleDesks = new Set<string>();
  for (const row of paperRules.data ?? []) {
    const id = String((row as { account_id: string }).account_id);
    if (
      id &&
      parseAutomationMode((row as { mode?: unknown }).mode) !== "disabled"
    ) {
      paperRuleDesks.add(id);
    }
  }
  const futuresRuleDesks = new Set<string>();
  for (const row of futuresRules.data ?? []) {
    const id = String((row as { account_id: string }).account_id);
    if (
      id &&
      parseAutomationMode((row as { mode?: unknown }).mode) !== "disabled"
    ) {
      futuresRuleDesks.add(id);
    }
  }
  const cashAndCarryRunning = [...enabled].filter(
    (id) => cashAndCarryIds.has(id) && paperRuleDesks.has(id),
  ).length;
  const perpsRunning = [...futuresRuleDesks].filter((id) =>
    perpsIds.has(id),
  ).length;
  const scanMs = latestScan.data?.scanned_at
    ? new Date(String(latestScan.data.scanned_at)).getTime()
    : NaN;
  const tick = lastTick.data;

  return {
    configured: true,
    members: {
      total: memberRows.length,
      active: memberRows.filter((row) => row.status === "active").length,
      disabled: memberRows.filter((row) => row.status === "disabled").length,
      admins: memberRows.filter((row) => row.role === "admin").length,
    },
    desks: {
      total: deskRows.length,
      paper,
      live,
      cashAndCarry,
      perps,
      signalFollower,
    },
    keys: { total: keys.count ?? 0 },
    positions: {
      cashAndCarryOpen: carryRows.filter((row) => row.status === "open").length,
      cashAndCarryClosing: carryRows.filter((row) => row.status === "closing")
        .length,
      perpsOpen: (futuresOpens.data ?? []).length,
    },
    automations: {
      running: cashAndCarryRunning + perpsRunning,
      cashAndCarry: cashAndCarryRunning,
      perps: perpsRunning,
    },
    scan: {
      count: opportunityCount.count ?? 0,
      lastAtMs: Number.isFinite(scanMs) ? scanMs : null,
    },
    lastTick: tick
      ? {
          at: String(tick.created_at),
          event: String(tick.event),
          message: String(tick.message),
        }
      : null,
    issues: (issues.data ?? [])
      .filter(
        (row) => row.level === "error" || row.level === "warning",
      )
      .map((row) => ({
        id: Number(row.id),
        createdAt: String(row.created_at),
        level: row.level as "warning" | "error",
        event: String(row.event),
        message: String(row.message),
      })),
  };
}
