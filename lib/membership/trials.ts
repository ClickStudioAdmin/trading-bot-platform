import {
  PLAN_COMPARE_SECTIONS,
  type PlanCapKey,
  type PlanCaps,
  type PlanCompareRow,
  type PlanFeatureKey,
  type PlanFeatures,
} from "@/lib/membership/catalog";

export const TRIAL_DAYS_MIN = 1;
export const TRIAL_DAYS_MAX = 365;

export type FeatureTrialSetting = { days: number };
export type CapTrialSetting = { days: number; limit: number };

export type PlanTrials = {
  features: Partial<Record<PlanFeatureKey, FeatureTrialSetting>>;
  caps: Partial<Record<PlanCapKey, CapTrialSetting>>;
};

export type TrialPlan = {
  features: PlanFeatures;
  caps: PlanCaps;
  trials?: PlanTrials;
};

export type MemberTrialGrant = {
  key: string;
  startedAt: string;
  endsAt: string;
};

export type TrialPhase = "active" | "ended";

export type TrialOffer = {
  key: string;
  days: number;
  limit: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function emptyPlanTrials(): PlanTrials {
  return { features: {}, caps: {} };
}

export function parseTrialDays(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < TRIAL_DAYS_MIN || n > TRIAL_DAYS_MAX) {
    return null;
  }
  return n;
}

export function parseTrialLimit(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1) {
    return null;
  }
  return n;
}

export function parsePlanTrials(value: unknown): PlanTrials {
  const next = emptyPlanTrials();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return next;
  }
  const record = value as {
    features?: unknown;
    caps?: unknown;
  };
  if (record.features && typeof record.features === "object" && !Array.isArray(record.features)) {
    for (const [key, raw] of Object.entries(record.features)) {
      if (!isFeatureKey(key) || !raw || typeof raw !== "object" || Array.isArray(raw)) {
        continue;
      }
      const days = parseTrialDays((raw as { days?: unknown }).days);
      if (days === null) {
        continue;
      }
      next.features[key] = { days };
    }
  }
  if (record.caps && typeof record.caps === "object" && !Array.isArray(record.caps)) {
    for (const [key, raw] of Object.entries(record.caps)) {
      if (!isCapKey(key) || !raw || typeof raw !== "object" || Array.isArray(raw)) {
        continue;
      }
      const days = parseTrialDays((raw as { days?: unknown }).days);
      const limit = parseTrialLimit((raw as { limit?: unknown }).limit);
      if (days === null || limit === null) {
        continue;
      }
      next.caps[key] = { days, limit };
    }
  }
  return next;
}

export function trialEndIso(startedAtMs: number, days: number): string {
  return new Date(startedAtMs + days * DAY_MS).toISOString();
}

export function trialPhase(endsAt: string, nowMs: number): TrialPhase | null {
  const ends = Date.parse(endsAt);
  if (!Number.isFinite(ends)) {
    return null;
  }
  return nowMs < ends ? "active" : "ended";
}

export function featureTrialOffer(
  plan: TrialPlan,
  key: PlanFeatureKey,
): TrialOffer | null {
  if (plan.features[key]) {
    return null;
  }
  const setting = plan.trials?.features[key];
  if (!setting) {
    return null;
  }
  return { key, days: setting.days, limit: null };
}

export function capTrialOffer(
  plan: TrialPlan,
  key: PlanCapKey,
): TrialOffer | null {
  const setting = plan.trials?.caps[key];
  if (!setting) {
    return null;
  }
  const standing = plan.caps[key];
  if (standing == null || setting.limit <= standing) {
    return null;
  }
  if (
    key === "max_followers_accepted" &&
    !plan.features.copy_share &&
    !plan.features.copy_catalogue
  ) {
    return null;
  }
  return { key, days: setting.days, limit: setting.limit };
}

export function planTrialOffers(plan: TrialPlan): TrialOffer[] {
  const offers: TrialOffer[] = [];
  for (const section of PLAN_COMPARE_SECTIONS) {
    for (const row of section.rows) {
      if (row.kind === "feature") {
        const offer = featureTrialOffer(plan, row.key);
        if (offer) {
          offers.push(offer);
        }
      } else if (row.kind === "cap") {
        const offer = capTrialOffer(plan, row.key);
        if (offer) {
          offers.push(offer);
        }
      }
    }
  }
  return offers;
}

export function missingTrialGrants(input: {
  offers: readonly TrialOffer[];
  existing: readonly MemberTrialGrant[];
  nowMs: number;
}): MemberTrialGrant[] {
  const have = new Set(input.existing.map((grant) => grant.key));
  const created: MemberTrialGrant[] = [];
  for (const offer of input.offers) {
    if (have.has(offer.key)) {
      continue;
    }
    created.push({
      key: offer.key,
      startedAt: new Date(input.nowMs).toISOString(),
      endsAt: trialEndIso(input.nowMs, offer.days),
    });
  }
  return created;
}

export function effectiveCap(input: {
  standing: number | null;
  offer: TrialOffer | null;
  phase: TrialPhase | null;
}): number | null {
  if (input.standing == null) {
    return null;
  }
  if (input.offer && input.phase === "active" && input.offer.limit != null) {
    return Math.max(input.standing, input.offer.limit);
  }
  return input.standing;
}

export function featureAccess(input: {
  included: boolean;
  phase: TrialPhase | null;
}): "included" | "trial" | "closed" {
  if (input.included) {
    return "included";
  }
  if (input.phase === "active") {
    return "trial";
  }
  return "closed";
}

export type TrialMark = {
  phase: TrialPhase | "offer";
  label: string;
  endsAt: string | null;
  keepStanding: boolean;
};

export function trialMark(input: {
  plan: TrialPlan;
  row: PlanCompareRow;
  grant?: { endsAt: string } | null;
  nowMs: number;
}): TrialMark | null {
  const offer = offerForRow(input.plan, input.row);
  if (!offer) {
    return null;
  }
  const phase = input.grant ? trialPhase(input.grant.endsAt, input.nowMs) : "offer";
  if (!phase) {
    return null;
  }
  const ended = phase === "ended";
  const keepStanding = input.row.kind === "cap" && standingVisible(input.plan, input.row);
  return {
    phase,
    label: trialLabel(offer, ended),
    endsAt: input.grant?.endsAt ?? null,
    keepStanding,
  };
}

export function grantForKey(
  grants: readonly { key: string; endsAt: string }[],
  key: string,
): { endsAt: string } | null {
  return grants.find((grant) => grant.key === key) ?? null;
}

function trialLabel(offer: TrialOffer, ended: boolean): string {
  if (ended) {
    return "Trial ended";
  }
  if (offer.limit != null) {
    return `${offer.limit} · ${offer.days}-day trial`;
  }
  return `${offer.days}-day trial`;
}

function standingVisible(plan: TrialPlan, row: PlanCompareRow): boolean {
  if (row.kind !== "cap") {
    return false;
  }
  const standing = plan.caps[row.key];
  if (standing == null || standing > 0) {
    if (
      row.key === "max_followers_accepted" &&
      !plan.features.copy_share &&
      !plan.features.copy_catalogue
    ) {
      return false;
    }
    return standing == null || standing > 0;
  }
  return false;
}

function offerForRow(plan: TrialPlan, row: PlanCompareRow): TrialOffer | null {
  if (row.kind === "feature") {
    return featureTrialOffer(plan, row.key);
  }
  if (row.kind === "cap") {
    return capTrialOffer(plan, row.key);
  }
  return null;
}

function isFeatureKey(key: string): key is PlanFeatureKey {
  return PLAN_COMPARE_SECTIONS.some((section) =>
    section.rows.some((row) => row.kind === "feature" && row.key === key),
  );
}

function isCapKey(key: string): key is PlanCapKey {
  return PLAN_COMPARE_SECTIONS.some((section) =>
    section.rows.some((row) => row.kind === "cap" && row.key === key),
  );
}
