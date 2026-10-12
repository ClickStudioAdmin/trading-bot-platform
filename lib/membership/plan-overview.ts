import { deskDisplayMode, type TradingAccountMode } from "@/lib/accounts/model";
import {
  formatBacktestTimeframe,
  formatPlanCap,
  planAffiliateRate,
  PLAN_COMPARE_SECTIONS,
  type MembershipPlan,
  type PlanAffiliateRates,
  type PlanCapKey,
  type PlanCompareRow,
} from "@/lib/membership/catalog";

export type PlanOverviewLine = {
  key: string;
  label: string;
  text: string;
  included: boolean;
  over: boolean;
  note: string | null;
};

export type PlanOverviewGroup = {
  title: string;
  lines: PlanOverviewLine[];
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

type OverviewPlan = Pick<MembershipPlan, "features" | "caps"> & PlanAffiliateRates;

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

export function overviewPlanGroups(
  plan: OverviewPlan,
  usage: PlanUsageCounts,
): PlanOverviewGroup[] {
  return PLAN_COMPARE_SECTIONS.map((section) => ({
    title: section.title,
    lines: section.rows.map((row) => overviewLine(plan, row, usage)),
  }));
}

function sharingOff(plan: OverviewPlan): boolean {
  return !plan.features.copy_share && !plan.features.copy_catalogue;
}

function overviewLine(
  plan: OverviewPlan,
  row: PlanCompareRow,
  usage: PlanUsageCounts,
): PlanOverviewLine {
  const key = `${row.kind}:${row.key}`;
  if (row.kind === "feature") {
    const on = plan.features[row.key];
    return {
      key,
      label: row.label,
      text: on ? "Included" : "Not included",
      included: on,
      over: false,
      note: null,
    };
  }
  if (row.kind === "rate") {
    const pct = planAffiliateRate(plan, row.key);
    return {
      key,
      label: row.label,
      text: pct === 0 ? "Not included" : `${pct}%`,
      included: false,
      over: false,
      note: null,
    };
  }
  return usageLine(plan, key, row.key, row.label, usage);
}

function usageLine(
  plan: OverviewPlan,
  key: string,
  cap: PlanCapKey,
  label: string,
  usage: PlanUsageCounts,
): PlanOverviewLine {
  const limit = plan.caps[cap];
  if (cap === "max_followers_accepted" && sharingOff(plan)) {
    return {
      key,
      label,
      text: "Not included",
      included: false,
      over: false,
      note: null,
    };
  }
  if (!COUNTED_CAPS.has(cap)) {
    return {
      key,
      label,
      text:
        limit === 0
          ? "Not included"
          : cap === "max_backtest_years"
            ? formatBacktestTimeframe(limit)
            : formatPlanCap(limit),
      included: false,
      over: false,
      note: null,
    };
  }
  const used = usage[cap as keyof PlanUsageCounts] ?? 0;
  if (limit === 0 && used === 0) {
    return {
      key,
      label,
      text: "Not included",
      included: false,
      over: false,
      note: null,
    };
  }
  const limitText = limit == null ? "Unlimited" : String(limit);
  return {
    key,
    label,
    text: `${used} of ${limitText}`,
    included: false,
    over: limit != null && used > limit,
    note: cap === "max_followers_accepted" ? "Highest on one desk" : null,
  };
}
