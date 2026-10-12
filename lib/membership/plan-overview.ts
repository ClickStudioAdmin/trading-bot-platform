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
import {
  capTrialOffer,
  effectiveCap,
  featureTrialOffer,
  trialPhase,
  type MemberTrialGrant,
  type TrialPhase,
} from "@/lib/membership/trials";

export type PlanOverviewLine = {
  key: string;
  label: string;
  text: string;
  included: boolean;
  over: boolean;
  note: string | null;
  trial: {
    phase: TrialPhase;
    endsAt: string;
    emphasize: boolean;
  } | null;
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

type OverviewPlan = Pick<MembershipPlan, "features" | "caps"> &
  Partial<Pick<MembershipPlan, "trials">> &
  PlanAffiliateRates;

const COUNTED_CAPS = new Set<PlanCapKey>([
  "max_paper_desks",
  "max_demo_desks",
  "max_live_env_desks",
  "max_bots",
  "max_copy_follows",
  "max_followers_accepted",
  "max_stored_backtests",
]);

/** True once usage is within 10% of a finite cap, including past that cap. */
export function usageNearLimit(used: number, limit: number | null): boolean {
  if (limit == null) {
    return false;
  }
  if (limit <= 0) {
    return used > 0;
  }
  return used * 10 >= limit * 9;
}

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
  trials?: {
    grants: readonly MemberTrialGrant[];
    nowMs: number;
  },
): PlanOverviewGroup[] {
  return PLAN_COMPARE_SECTIONS.map((section) => ({
    title: section.title,
    lines: section.rows.map((row) => overviewLine(plan, row, usage, trials)),
  }));
}

function sharingOff(plan: OverviewPlan): boolean {
  return !plan.features.copy_share && !plan.features.copy_catalogue;
}

function overviewLine(
  plan: OverviewPlan,
  row: PlanCompareRow,
  usage: PlanUsageCounts,
  trials?: {
    grants: readonly MemberTrialGrant[];
    nowMs: number;
  },
): PlanOverviewLine {
  const key = `${row.kind}:${row.key}`;
  if (row.kind === "feature") {
    const on = plan.features[row.key];
    const offer = featureTrialOffer(plan, row.key);
    const clock = offer ? trialClock(trials, offer.key) : null;
    if (!on && offer && clock) {
      return {
        key,
        label: row.label,
        text: clock.phase === "ended" ? "Trial ended" : `${offer.days}-day trial`,
        included: false,
        over: false,
        note: null,
        trial: {
          phase: clock.phase,
          endsAt: clock.endsAt,
          emphasize: true,
        },
      };
    }
    return {
      key,
      label: row.label,
      text: on ? "Included" : "Not included",
      included: on,
      over: false,
      note: null,
      trial: null,
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
      trial: null,
    };
  }
  return usageLine(plan, key, row.key, row.label, usage, trials);
}

function trialClock(
  trials:
    | {
        grants: readonly MemberTrialGrant[];
        nowMs: number;
      }
    | undefined,
  key: string,
): { phase: TrialPhase; endsAt: string } | null {
  const grant = trials?.grants.find((row) => row.key === key);
  if (!grant || !trials) {
    return null;
  }
  const phase = trialPhase(grant.endsAt, trials.nowMs);
  if (!phase) {
    return null;
  }
  return { phase, endsAt: grant.endsAt };
}

function usageLine(
  plan: OverviewPlan,
  key: string,
  cap: PlanCapKey,
  label: string,
  usage: PlanUsageCounts,
  trials?: {
    grants: readonly MemberTrialGrant[];
    nowMs: number;
  },
): PlanOverviewLine {
  const standing = plan.caps[cap];
  const offer = capTrialOffer(plan, cap);
  const clock = offer ? trialClock(trials, offer.key) : null;
  const limit = effectiveCap({
    standing,
    offer,
    phase: clock?.phase ?? null,
  });
  const trialBase = clock
    ? { phase: clock.phase, endsAt: clock.endsAt }
    : null;
  if (cap === "max_followers_accepted" && sharingOff(plan)) {
    return {
      key,
      label,
      text: "Not included",
      included: false,
      over: false,
      note: null,
      trial: null,
    };
  }
  if (!COUNTED_CAPS.has(cap)) {
    const closed = limit === 0;
    const amount =
      cap === "max_backtest_years"
        ? formatBacktestTimeframe(limit)
        : formatPlanCap(limit);
    const trial = trialBase
      ? {
          ...trialBase,
          emphasize:
            trialBase.phase === "active" ||
            (trialBase.phase === "ended" && standing === 0),
        }
      : null;
    return {
      key,
      label,
      text: closed
        ? trial?.phase === "ended"
          ? "Trial ended"
          : "Not included"
        : trial?.phase === "active"
          ? `${amount} · trial`
          : amount,
      included: false,
      over: false,
      note: null,
      trial: closed && trial?.phase !== "ended" ? null : trial,
    };
  }
  const used = usage[cap as keyof PlanUsageCounts] ?? 0;
  const trial = trialBase
    ? {
        ...trialBase,
        emphasize:
          trialBase.phase === "active" ||
          (trialBase.phase === "ended" && standing === 0 && used === 0),
      }
    : null;
  if (limit === 0 && used === 0) {
    return {
      key,
      label,
      text: trial?.phase === "ended" ? "Trial ended" : "Not included",
      included: false,
      over: false,
      note: null,
      trial: trial?.phase === "ended" ? trial : null,
    };
  }
  const limitText = limit == null ? "Unlimited" : String(limit);
  const activeTrial = trial?.phase === "active";
  return {
    key,
    label,
    text: `${used} of ${limitText}${activeTrial ? " · trial" : ""}`,
    included: false,
    over: usageNearLimit(used, limit),
    note: cap === "max_followers_accepted" ? "Highest on one desk" : null,
    trial,
  };
}
