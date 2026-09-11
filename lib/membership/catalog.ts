export const PLAN_NAME_MAX = 40;
export const AFFILIATE_LEVEL_MAX = 5;
export const AFFILIATE_RATE_KEYS = ["l1", "l2", "l3", "l4", "l5"] as const;
export type AffiliateRateKey = (typeof AFFILIATE_RATE_KEYS)[number];
export const AFFILIATE_PCT_MAX = 100;

export const PLAN_FEATURE_KEYS = [
  "desk_cash_and_carry",
  "desk_perps",
  "desk_perps_bots",
  "desk_signal_follower",
  "desk_dca",
  "desk_scale_in",
  "mode_paper",
  "mode_live",
  "venue_non_bybit",
  "copy_follow",
  "copy_share",
  "copy_catalogue",
  "research_chart",
  "research_backtest",
  "signals_inbound_webhooks",
  "extras_advanced_dca",
  "extras_templates",
  "extras_starter_pack",
  "affiliate_enroll",
] as const;

export type PlanFeatureKey = (typeof PLAN_FEATURE_KEYS)[number];
export type PlanFeatures = Record<PlanFeatureKey, boolean>;

export const PLAN_CAP_KEYS = [
  "max_desk_cash_and_carry",
  "max_desk_perps",
  "max_desk_perps_bots",
  "max_desk_signal_follower",
  "max_desk_dca",
  "max_paper_desks",
  "max_demo_desks",
  "max_live_env_desks",
  "max_bots_per_desk",
  "max_inbound_webhooks",
  "max_copy_follows",
  "max_followers_accepted",
  "max_stored_backtests",
  "max_backtest_bars",
  "affiliate_max_depth",
] as const;

export type PlanCapKey = (typeof PLAN_CAP_KEYS)[number];
export type PlanCaps = Record<PlanCapKey, number | null>;

export type PlanFeatureGroup = {
  title: string;
  keys: readonly PlanFeatureKey[];
};

export type PlanCapGroup = {
  title: string;
  keys: readonly PlanCapKey[];
};

export const PLAN_FEATURE_GROUPS: readonly PlanFeatureGroup[] = [
  {
    title: "Manual Desks",
    keys: ["desk_perps"],
  },
  {
    title: "Automated Desks",
    keys: [
      "desk_perps_bots",
      "desk_dca",
      "desk_cash_and_carry",
      "desk_signal_follower",
    ],
  },
  {
    title: "Automation",
    keys: ["extras_templates"],
  },
  {
    title: "Webhooks",
    keys: ["signals_inbound_webhooks"],
  },
  {
    title: "Copy Trading",
    keys: ["copy_follow", "copy_share", "copy_catalogue"],
  },
  {
    title: "Backtesting",
    keys: ["research_backtest"],
  },
  {
    title: "Affiliates",
    keys: ["affiliate_enroll"],
  },
  {
    title: "Extras",
    keys: ["research_chart", "extras_starter_pack"],
  },
];

export const PLAN_CAP_GROUPS: readonly PlanCapGroup[] = [
  {
    title: "Manual Desks",
    keys: ["max_desk_perps"],
  },
  {
    title: "Automated Desks",
    keys: [
      "max_desk_perps_bots",
      "max_desk_dca",
      "max_desk_cash_and_carry",
      "max_desk_signal_follower",
    ],
  },
  {
    title: "Desk Resources",
    keys: [
      "max_paper_desks",
      "max_demo_desks",
      "max_live_env_desks",
    ],
  },
  {
    title: "Automation",
    keys: ["max_bots_per_desk"],
  },
  {
    title: "Webhooks",
    keys: ["max_inbound_webhooks"],
  },
  {
    title: "Copy Trading",
    keys: ["max_copy_follows", "max_followers_accepted"],
  },
  {
    title: "Backtesting",
    keys: ["max_stored_backtests", "max_backtest_bars"],
  },
  {
    title: "Affiliates",
    keys: ["affiliate_max_depth"],
  },
];

export const PLAN_FEATURE_LABELS: Record<PlanFeatureKey, string> = {
  desk_cash_and_carry: "Cash & Carry",
  desk_perps: "Perps",
  desk_perps_bots: "Perps bots",
  desk_signal_follower: "TradingView Strategy",
  desk_dca: "DCA",
  desk_scale_in: "Scale-in (off until that desk type exists)",
  mode_paper: "Paper desks",
  mode_live: "Live / Connected desks",
  venue_non_bybit: "Non-Bybit venues",
  copy_follow: "Follow a desk",
  copy_share: "Share / list a desk",
  copy_catalogue: "Appear in the public catalogue",
  research_chart: "Positions Chart",
  research_backtest: "Backtesting tool",
  signals_inbound_webhooks: "Inbound TradingView / Signal webhooks",
  extras_advanced_dca: "Advanced DCA (Confirm, Exit-if, ATR)",
  extras_templates: "Templates (save, apply, folders, export)",
  extras_starter_pack: "Starter Pack apply",
  affiliate_enroll: "Affiliate enroll",
};

export const PLAN_CAP_LABELS: Record<PlanCapKey, string> = {
  max_desk_cash_and_carry: "Cash & Carry",
  max_desk_perps: "Perps",
  max_desk_perps_bots: "Perps bots",
  max_desk_signal_follower: "TradingView Strategy",
  max_desk_dca: "DCA",
  max_paper_desks: "Paper Desks",
  max_demo_desks: "Exchange Connected Desks (Demo Mode)",
  max_live_env_desks: "Exchange Connected Desks (Live Mode)",
  max_bots_per_desk: "Max bots / playbooks per desk",
  max_inbound_webhooks: "Max inbound webhooks",
  max_copy_follows: "Max copy follows",
  max_followers_accepted: "Max followers when sharing",
  max_stored_backtests: "Max stored backtests",
  max_backtest_bars: "Max backtest bar length",
  affiliate_max_depth: "Affiliate earn depth (1–5)",
};

export type MembershipPlan = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  public: boolean;
  archivedAt: string | null;
  isDefault: boolean;
  priceUsd: number;
  stripePriceId: string | null;
  affiliateL1Pct: number;
  affiliateL2Pct: number;
  affiliateL3Pct: number;
  affiliateL4Pct: number;
  affiliateL5Pct: number;
  features: PlanFeatures;
  caps: PlanCaps;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
};

export function emptyFeatures(): PlanFeatures {
  return Object.fromEntries(
    PLAN_FEATURE_KEYS.map((key) => [key, false]),
  ) as PlanFeatures;
}

export function emptyCaps(): PlanCaps {
  return Object.fromEntries(
    PLAN_CAP_KEYS.map((key) => [key, null]),
  ) as PlanCaps;
}

export function parseFeatures(value: unknown): PlanFeatures {
  const next = emptyFeatures();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return next;
  }
  const record = value as Record<string, unknown>;
  for (const key of PLAN_FEATURE_KEYS) {
    next[key] = record[key] === true;
  }
  return next;
}

export function parseCaps(value: unknown): PlanCaps {
  const next = emptyCaps();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return next;
  }
  const record = value as Record<string, unknown>;
  for (const key of PLAN_CAP_KEYS) {
    next[key] = parseCapValue(record[key]);
  }
  return next;
}

export function parseCapValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0) {
    return null;
  }
  return n;
}

export type PlanAffiliateRates = Pick<
  MembershipPlan,
  | "affiliateL1Pct"
  | "affiliateL2Pct"
  | "affiliateL3Pct"
  | "affiliateL4Pct"
  | "affiliateL5Pct"
>;

export function planAffiliateRate(
  plan: PlanAffiliateRates,
  key: AffiliateRateKey,
): number {
  if (key === "l1") {
    return plan.affiliateL1Pct;
  }
  if (key === "l2") {
    return plan.affiliateL2Pct;
  }
  if (key === "l3") {
    return plan.affiliateL3Pct;
  }
  if (key === "l4") {
    return plan.affiliateL4Pct;
  }
  return plan.affiliateL5Pct;
}

export function affiliatePctSum(...pcts: number[]): number {
  return pcts.reduce((sum, n) => sum + n, 0);
}

export function affiliateRatesOk(...pcts: number[]): boolean {
  if (pcts.some((n) => !Number.isFinite(n) || n < 0 || n > AFFILIATE_PCT_MAX)) {
    return false;
  }
  return affiliatePctSum(...pcts) <= AFFILIATE_PCT_MAX;
}

export function planIsArchived(plan: Pick<MembershipPlan, "archivedAt">): boolean {
  return Boolean(plan.archivedAt);
}

export function planIsUsed(plan: Pick<MembershipPlan, "memberCount" | "isDefault">): boolean {
  return plan.isDefault || plan.memberCount > 0;
}

export function canDeletePlan(plan: Pick<MembershipPlan, "memberCount" | "isDefault">): boolean {
  return !planIsUsed(plan);
}

export function canArchivePlan(plan: Pick<MembershipPlan, "isDefault" | "archivedAt">): boolean {
  return !plan.isDefault && !plan.archivedAt;
}

export function slugifyPlanName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "plan";
}

export function formatPlanPrice(priceUsd: number): string {
  if (priceUsd <= 0) {
    return "Free";
  }
  const rounded = Number.isInteger(priceUsd)
    ? String(priceUsd)
    : priceUsd.toFixed(2);
  return `$${rounded} / month`;
}

export function formatPlanCap(value: number | null): string {
  return value === null ? "Unlimited" : String(value);
}

export type PlanCompareSection = {
  title: string;
  rows: readonly PlanCompareRow[];
  /** Keep listed order instead of sorting by unlock plan. */
  fixedOrder?: boolean;
};

export type PlanCompareRow =
  | { kind: "feature"; key: PlanFeatureKey; label: string }
  | { kind: "cap"; key: PlanCapKey; label: string }
  | { kind: "rate"; key: AffiliateRateKey; label: string };

export type PlanCompareCell =
  | { kind: "tick" }
  | { kind: "cross" }
  | { kind: "value"; text: string };

export const PLAN_COMPARE_SECTIONS: readonly PlanCompareSection[] = [
  {
    title: "Manual Desks",
    rows: [
      { kind: "feature", key: "desk_perps", label: "Perps" },
    ],
  },
  {
    title: "Automated Desks",
    fixedOrder: true,
    rows: [
      { kind: "feature", key: "desk_perps_bots", label: "Perps" },
      { kind: "feature", key: "desk_dca", label: "DCA" },
      { kind: "feature", key: "desk_cash_and_carry", label: "Cash & Carry" },
      { kind: "feature", key: "desk_signal_follower", label: "TradingView Strategy" },
    ],
  },
  {
    title: "Desk Resources",
    rows: [
      { kind: "cap", key: "max_paper_desks", label: "Paper Desks" },
      { kind: "cap", key: "max_demo_desks", label: "Exchange Connected Desks (Demo Mode)" },
      { kind: "cap", key: "max_live_env_desks", label: "Exchange Connected Desks (Live Mode)" },
    ],
  },
  {
    title: "Automation",
    rows: [
      { kind: "feature", key: "extras_templates", label: "Templates" },
      { kind: "cap", key: "max_bots_per_desk", label: "Max bots per desk" },
    ],
  },
  {
    title: "Webhooks",
    rows: [
      { kind: "feature", key: "signals_inbound_webhooks", label: "Inbound webhooks" },
      { kind: "cap", key: "max_inbound_webhooks", label: "Max inbound webhooks" },
    ],
  },
  {
    title: "Copy Trading",
    rows: [
      { kind: "feature", key: "copy_follow", label: "Follow a desk" },
      { kind: "feature", key: "copy_share", label: "Share / list a desk" },
      { kind: "feature", key: "copy_catalogue", label: "Public catalogue" },
      { kind: "cap", key: "max_copy_follows", label: "Max copy follows" },
      { kind: "cap", key: "max_followers_accepted", label: "Max followers when sharing" },
    ],
  },
  {
    title: "Backtesting",
    fixedOrder: true,
    rows: [
      { kind: "feature", key: "research_backtest", label: "Backtesting tool" },
      { kind: "cap", key: "max_stored_backtests", label: "Max stored backtests" },
      { kind: "cap", key: "max_backtest_bars", label: "Max backtest bar length" },
    ],
  },
  {
    title: "Affiliates",
    fixedOrder: true,
    rows: [
      { kind: "cap", key: "affiliate_max_depth", label: "Earn depth" },
      { kind: "rate", key: "l1", label: "L1 commission" },
      { kind: "rate", key: "l2", label: "L2 commission" },
      { kind: "rate", key: "l3", label: "L3 commission" },
      { kind: "rate", key: "l4", label: "L4 commission" },
      { kind: "rate", key: "l5", label: "L5 commission" },
    ],
  },
];

type ComparePlan = Pick<MembershipPlan, "features" | "caps"> & PlanAffiliateRates;

export function rowUnlockIndex(
  plans: readonly ComparePlan[],
  row: PlanCompareRow,
): number {
  const index = plans.findIndex((plan) => {
    if (row.kind === "feature") {
      return plan.features[row.key];
    }
    if (row.kind === "cap") {
      const value = plan.caps[row.key];
      return value === null || value > 0;
    }
    return planAffiliateRate(plan, row.key) > 0;
  });
  return index === -1 ? plans.length : index;
}

export function sortCompareSectionRows(
  plans: readonly ComparePlan[],
  rows: readonly PlanCompareRow[],
): PlanCompareRow[] {
  return rows
    .map((row, order) => ({ row, order, unlock: rowUnlockIndex(plans, row) }))
    .sort((a, b) => a.unlock - b.unlock || a.order - b.order)
    .map((entry) => entry.row);
}

export function comparePlanCell(
  plan: ComparePlan,
  row: PlanCompareRow,
): PlanCompareCell {
  if (row.kind === "feature") {
    return plan.features[row.key] ? { kind: "tick" } : { kind: "cross" };
  }
  if (row.kind === "cap") {
    const value = plan.caps[row.key];
    if (value === 0) {
      return { kind: "cross" };
    }
    return { kind: "value", text: formatPlanCap(value) };
  }
  const pct = planAffiliateRate(plan, row.key);
  if (pct === 0) {
    return { kind: "cross" };
  }
  return { kind: "value", text: `${pct}%` };
}

export function publicCatalogPlans(
  plans: MembershipPlan[],
): MembershipPlan[] {
  return plans
    .filter((plan) => plan.public && !planIsArchived(plan))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function coreDeskFeaturesOn(): Pick<
  PlanFeatures,
  | "desk_cash_and_carry"
  | "desk_perps"
  | "desk_perps_bots"
  | "desk_signal_follower"
  | "desk_dca"
  | "mode_paper"
  | "research_chart"
  | "extras_advanced_dca"
  | "extras_starter_pack"
> {
  return {
    desk_cash_and_carry: true,
    desk_perps: true,
    desk_perps_bots: true,
    desk_signal_follower: true,
    desk_dca: true,
    mode_paper: true,
    research_chart: true,
    extras_advanced_dca: true,
    extras_starter_pack: true,
  };
}
