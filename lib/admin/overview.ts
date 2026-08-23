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
  accounts: { total: number; paper: number; live: number };
  positions: { open: number; closing: number };
  automations: { running: number };
  scan: { count: number; lastAtMs: number | null };
  lastTick: { at: string; event: string; message: string } | null;
  issues: AdminOverviewIssue[];
};

const emptyOverview: AdminOverview = {
  configured: false,
  members: { total: 0, active: 0, disabled: 0, admins: 0 },
  accounts: { total: 0, paper: 0, live: 0 },
  positions: { open: 0, closing: 0 },
  automations: { running: 0 },
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
    accounts,
    carries,
    settings,
    rules,
    opportunityCount,
    latestScan,
    lastTick,
    issues,
  ] = await Promise.all([
    supabase.from("members").select("role, status"),
    supabase.from("trading_accounts").select("mode"),
    supabase
      .from("paper_carries")
      .select("status")
      .in("status", ["open", "closing"]),
    supabase.from("paper_engine_settings").select("account_id, enabled"),
    supabase.from("paper_rules").select("account_id"),
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
  const accountRows = accounts.data ?? [];
  const carryRows = carries.data ?? [];
  const enabled = new Set(
    (settings.data ?? [])
      .filter((row) => Boolean((row as { enabled?: unknown }).enabled))
      .map((row) => String((row as { account_id: string }).account_id)),
  );
  const withRules = new Set(
    (rules.data ?? []).map((row) =>
      String((row as { account_id: string }).account_id),
    ),
  );
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
    accounts: {
      total: accountRows.length,
      paper: accountRows.filter((row) => row.mode === "paper").length,
      live: accountRows.filter((row) => row.mode === "live").length,
    },
    positions: {
      open: carryRows.filter((row) => row.status === "open").length,
      closing: carryRows.filter((row) => row.status === "closing").length,
    },
    automations: {
      running: [...enabled].filter((id) => withRules.has(id)).length,
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
