export const PLAN_NAME_MAX = 40;
export const AFFILIATE_LEVEL_MAX = 3;
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
  "max_desks",
  "max_live_desks",
  "max_paper_desks",
  "max_exchange_connections",
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
    title: "Desk types",
    keys: [
      "desk_cash_and_carry",
      "desk_perps",
      "desk_perps_bots",
      "desk_signal_follower",
      "desk_dca",
      "desk_scale_in",
    ],
  },
  {
    title: "Mode and venue",
    keys: ["mode_paper", "mode_live", "venue_non_bybit"],
  },
  {
    title: "Copy trading",
    keys: ["copy_follow", "copy_share", "copy_catalogue"],
  },
  {
    title: "Research",
    keys: ["research_chart", "research_backtest"],
  },
  {
    title: "Signals and extras",
    keys: [
      "signals_inbound_webhooks",
      "extras_advanced_dca",
      "extras_templates",
      "extras_starter_pack",
    ],
  },
  {
    title: "Affiliate",
    keys: ["affiliate_enroll"],
  },
];

export const PLAN_CAP_GROUPS: readonly PlanCapGroup[] = [
  {
    title: "Desks and keys",
    keys: [
      "max_desks",
      "max_live_desks",
      "max_paper_desks",
      "max_exchange_connections",
    ],
  },
  {
    title: "Bots and signals",
    keys: ["max_bots_per_desk", "max_inbound_webhooks"],
  },
  {
    title: "Copy and research",
    keys: [
      "max_copy_follows",
      "max_followers_accepted",
      "max_stored_backtests",
      "max_backtest_bars",
    ],
  },
  {
    title: "Affiliate",
    keys: ["affiliate_max_depth"],
  },
];

export const PLAN_FEATURE_LABELS: Record<PlanFeatureKey, string> = {
  desk_cash_and_carry: "Cash and Carry",
  desk_perps: "Perps (ticket)",
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
  max_desks: "Max desks",
  max_live_desks: "Max Live desks",
  max_paper_desks: "Max Paper desks",
  max_exchange_connections: "Max exchange connections",
  max_bots_per_desk: "Max bots / playbooks per desk",
  max_inbound_webhooks: "Max inbound webhooks",
  max_copy_follows: "Max copy follows",
  max_followers_accepted: "Max followers when sharing",
  max_stored_backtests: "Max stored backtests",
  max_backtest_bars: "Max backtest bar length",
  affiliate_max_depth: "Affiliate earn depth (1–3)",
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

export function affiliatePctSum(l1: number, l2: number, l3: number): number {
  return l1 + l2 + l3;
}

export function affiliateRatesOk(l1: number, l2: number, l3: number): boolean {
  if ([l1, l2, l3].some((n) => !Number.isFinite(n) || n < 0 || n > AFFILIATE_PCT_MAX)) {
    return false;
  }
  return affiliatePctSum(l1, l2, l3) <= AFFILIATE_PCT_MAX;
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
