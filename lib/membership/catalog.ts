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
  "research_backtest",
  "research_backtest_attach_templates",
  "signals_inbound_webhooks",
  "extras_advanced_dca",
  "extras_templates",
  "extras_share_templates",
  "extras_import_export_templates",
  "affiliate_enroll",
] as const;

export type PlanFeatureKey = (typeof PLAN_FEATURE_KEYS)[number];
export type PlanFeatures = Record<PlanFeatureKey, boolean>;

export const PLAN_CAP_KEYS = [
  "max_paper_desks",
  "max_demo_desks",
  "max_live_env_desks",
  "max_bots_per_desk",
  "max_copy_follows",
  "max_followers_accepted",
  "max_stored_backtests",
  "max_backtest_years",
  "affiliate_max_depth",
] as const;

export type PlanCapKey = (typeof PLAN_CAP_KEYS)[number];
export type PlanCaps = Record<PlanCapKey, number | null>;

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
  copy_follow: "Copy other Trader's Desks",
  copy_share: "Desk Sharing - Private",
  copy_catalogue: "Desk Sharing - Public",
  research_backtest: "Backtesting Tool",
  research_backtest_attach_templates: "Attach Results to Bot Template",
  signals_inbound_webhooks: "Inbound TradingView / Signal webhooks",
  extras_advanced_dca: "Advanced DCA (Confirm, Exit-if, ATR)",
  extras_templates: "Save Templates",
  extras_share_templates: "Share Templates",
  extras_import_export_templates: "Import / Export Templates",
  affiliate_enroll: "Affiliate enroll",
};

export const PLAN_CAP_LABELS: Record<PlanCapKey, string> = {
  max_paper_desks: "Paper Trading",
  max_demo_desks: "Exchange Connected - Demo Mode",
  max_live_env_desks: "Exchange Connected - Live Mode",
  max_bots_per_desk: "Max Bots per Desk",
  max_copy_follows: "Max Desk Copies",
  max_followers_accepted: "Max Followers per Desk",
  max_stored_backtests: "Max Saved Backtests",
  max_backtest_years: "Max Backtest Timeframe (years)",
  affiliate_max_depth: "Earning Depth (1–5)",
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

export function affiliateRateFieldName(
  key: AffiliateRateKey,
): keyof PlanAffiliateRates {
  if (key === "l1") {
    return "affiliateL1Pct";
  }
  if (key === "l2") {
    return "affiliateL2Pct";
  }
  if (key === "l3") {
    return "affiliateL3Pct";
  }
  if (key === "l4") {
    return "affiliateL4Pct";
  }
  return "affiliateL5Pct";
}

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

export function assignablePlans<T extends Pick<MembershipPlan, "id" | "archivedAt" | "isDefault">>(
  plans: readonly T[],
  currentPlanId?: string | null,
): T[] {
  return plans.filter(
    (plan) => !planIsArchived(plan) || plan.id === currentPlanId,
  );
}

export function defaultAssignablePlanId(
  plans: readonly Pick<MembershipPlan, "id" | "archivedAt" | "isDefault">[],
): string | null {
  const open = assignablePlans(plans);
  return open.find((plan) => plan.isDefault)?.id ?? open[0]?.id ?? null;
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

export function formatBacktestTimeframe(value: number | null): string {
  if (value === null) {
    return "Unlimited";
  }
  return value === 1 ? "1 year" : `${value} years`;
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
    title: "Manual Desk Types",
    rows: [
      { kind: "feature", key: "desk_perps", label: "Perps" },
    ],
  },
  {
    title: "Automated Desk Types",
    fixedOrder: true,
    rows: [
      { kind: "feature", key: "desk_perps_bots", label: "Perps" },
      { kind: "feature", key: "desk_dca", label: "DCA" },
      { kind: "feature", key: "desk_cash_and_carry", label: "Cash & Carry" },
      { kind: "feature", key: "desk_signal_follower", label: "TradingView Strategy" },
    ],
  },
  {
    title: "Maximum Desks (any type)",
    fixedOrder: true,
    rows: [
      { kind: "cap", key: "max_paper_desks", label: "Paper Trading" },
      { kind: "cap", key: "max_demo_desks", label: "Exchange Connected - Demo Mode" },
      { kind: "cap", key: "max_live_env_desks", label: "Exchange Connected - Live Mode" },
    ],
  },
  {
    title: "Bots & Templates",
    fixedOrder: true,
    rows: [
      { kind: "cap", key: "max_bots_per_desk", label: "Max Bots per Desk" },
      { kind: "feature", key: "extras_templates", label: "Save Templates" },
      { kind: "feature", key: "extras_share_templates", label: "Share Templates" },
      { kind: "feature", key: "extras_import_export_templates", label: "Import / Export Templates" },
    ],
  },
  {
    title: "Webhooks",
    rows: [
      { kind: "feature", key: "signals_inbound_webhooks", label: "Inbound webhooks" },
    ],
  },
  {
    title: "Copy Trading",
    fixedOrder: true,
    rows: [
      { kind: "feature", key: "copy_follow", label: "Copy other Trader's Desks" },
      { kind: "cap", key: "max_copy_follows", label: "Max Desk Copies" },
      { kind: "feature", key: "copy_catalogue", label: "Desk Sharing - Public" },
      { kind: "feature", key: "copy_share", label: "Desk Sharing - Private" },
      { kind: "cap", key: "max_followers_accepted", label: "Max Followers per Desk" },
    ],
  },
  {
    title: "Backtesting",
    fixedOrder: true,
    rows: [
      { kind: "feature", key: "research_backtest", label: "Backtesting Tool" },
      { kind: "feature", key: "research_backtest_attach_templates", label: "Attach Results to Bot Template" },
      { kind: "cap", key: "max_backtest_years", label: "Max Backtest Timeframe" },
      { kind: "cap", key: "max_stored_backtests", label: "Max Saved Backtests" },
    ],
  },
  {
    title: "Affiliates",
    fixedOrder: true,
    rows: [
      { kind: "cap", key: "affiliate_max_depth", label: "Earning Depth" },
      { kind: "rate", key: "l1", label: "L1 Commission" },
      { kind: "rate", key: "l2", label: "L2 Commission" },
      { kind: "rate", key: "l3", label: "L3 Commission" },
      { kind: "rate", key: "l4", label: "L4 Commission" },
      { kind: "rate", key: "l5", label: "L5 Commission" },
    ],
  },
];

export function adminPlanSections(): PlanCompareSection[] {
  return PLAN_COMPARE_SECTIONS.map((section) => {
    if (section.title !== "Affiliates") {
      return section;
    }
    return {
      ...section,
      rows: [
        {
          kind: "feature",
          key: "affiliate_enroll",
          label: PLAN_FEATURE_LABELS.affiliate_enroll,
        },
        ...section.rows,
      ],
    };
  });
}

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
      if (
        row.key === "max_followers_accepted" &&
        !plan.features.copy_share &&
        !plan.features.copy_catalogue
      ) {
        return false;
      }
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
    if (
      row.key === "max_followers_accepted" &&
      !plan.features.copy_share &&
      !plan.features.copy_catalogue
    ) {
      return { kind: "cross" };
    }
    if (value === 0) {
      return { kind: "cross" };
    }
    if (row.key === "max_backtest_years") {
      return { kind: "value", text: formatBacktestTimeframe(value) };
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
  | "extras_advanced_dca"
> {
  return {
    desk_cash_and_carry: true,
    desk_perps: true,
    desk_perps_bots: true,
    desk_signal_follower: true,
    desk_dca: true,
    mode_paper: true,
    extras_advanced_dca: true,
  };
}
