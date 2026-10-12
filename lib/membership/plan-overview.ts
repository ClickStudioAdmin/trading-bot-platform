import { deskDisplayMode, type TradingAccountMode } from "@/lib/accounts/model";
import {
  formatBacktestTimeframe,
  formatPlanCap,
  PLAN_COMPARE_SECTIONS,
  type MembershipPlan,
  type PlanCapKey,
} from "@/lib/membership/catalog";

export type PlanPrivilegeGroup = {
  title: string;
  items: string[];
};

export type PlanUsageCounts = {
  max_paper_desks: number;
  max_demo_desks: number;
  max_live_env_desks: number;
  max_bots: number;
  max_copy_follows: number;
  max_followers_accepted: number;
  max_stored_backtests: number;
};

export type PlanUsageRow = {
  key: PlanCapKey;
  label: string;
  text: string;
  over: boolean;
  note: string | null;
};

type PlanSlice = Pick<MembershipPlan, "features" | "caps">;

const COUNTED_CAPS = new Set<PlanCapKey>([
  "max_paper_desks",
  "max_demo_desks",
  "max_live_env_desks",
  "max_bots",
  "max_copy_follows",
  "max_followers_accepted",
  "max_stored_backtests",
]);

export function emptyPlanUsageCounts(): PlanUsageCounts {
  return {
    max_paper_desks: 0,
    max_demo_desks: 0,
    max_live_env_desks: 0,
    max_bots: 0,
    max_copy_follows: 0,
    max_followers_accepted: 0,
    max_stored_backtests: 0,
  };
}

export function planDeskCounts(
  desks: readonly {
    mode: TradingAccountMode;
    venueEnvironment: string | null;
    copyOfAccountId?: string | null;
  }[],
): Pick<
  PlanUsageCounts,
  | "max_paper_desks"
  | "max_demo_desks"
  | "max_live_env_desks"
  | "max_copy_follows"
> {
  const counts = {
    max_paper_desks: 0,
    max_demo_desks: 0,
    max_live_env_desks: 0,
    max_copy_follows: 0,
  };
  for (const desk of desks) {
    const mode = deskDisplayMode(desk);
    if (mode === "paper") {
      counts.max_paper_desks += 1;
    } else if (mode === "demo") {
      counts.max_demo_desks += 1;
    } else {
      counts.max_live_env_desks += 1;
    }
    if (desk.copyOfAccountId) {
      counts.max_copy_follows += 1;
    }
  }
  return counts;
}

export function overviewPlanPrivileges(plan: PlanSlice): PlanPrivilegeGroup[] {
  const groups: PlanPrivilegeGroup[] = [];
  for (const section of PLAN_COMPARE_SECTIONS) {
    const items = section.rows
      .filter((row) => row.kind === "feature" && plan.features[row.key])
      .map((row) => row.label);
    if (items.length > 0) {
      groups.push({ title: section.title, items });
    }
  }
  return groups;
}

function sharingOff(plan: PlanSlice): boolean {
  return !plan.features.copy_share && !plan.features.copy_catalogue;
}

export function overviewPlanUsage(
  plan: PlanSlice,
  usage: PlanUsageCounts,
): PlanUsageRow[] {
  const rows: PlanUsageRow[] = [];
  for (const section of PLAN_COMPARE_SECTIONS) {
    for (const row of section.rows) {
      if (row.kind !== "cap") {
        continue;
      }
      rows.push(usageRow(plan, row.key, row.label, usage));
    }
  }
  return rows;
}

function usageRow(
  plan: PlanSlice,
  key: PlanCapKey,
  label: string,
  usage: PlanUsageCounts,
): PlanUsageRow {
  const limit = plan.caps[key];
  if (
    key === "max_followers_accepted" &&
    sharingOff(plan)
  ) {
    return { key, label, text: "Not included", over: false, note: null };
  }
  if (!COUNTED_CAPS.has(key)) {
    return {
      key,
      label,
      text:
        limit === 0
          ? "Not included"
          : key === "max_backtest_years"
            ? formatBacktestTimeframe(limit)
            : formatPlanCap(limit),
      over: false,
      note: null,
    };
  }
  const used = usage[key as keyof PlanUsageCounts] ?? 0;
  if (limit === 0 && used === 0) {
    return { key, label, text: "Not included", over: false, note: null };
  }
  const limitText = limit == null ? "Unlimited" : String(limit);
  return {
    key,
    label,
    text: `${used} of ${limitText}`,
    over: limit != null && used > limit,
    note:
      key === "max_followers_accepted" ? "Highest on one desk" : null,
  };
}
