import {
  AFFILIATE_LEVEL_MAX,
  AFFILIATE_PCT_MAX,
  PLAN_CAP_KEYS,
  PLAN_FEATURE_KEYS,
  PLAN_NAME_MAX,
  affiliateRatesOk,
  emptyCaps,
  emptyFeatures,
  parseCapValue,
  slugifyPlanName,
  type PlanCaps,
  type PlanFeatures,
} from "./catalog";

export type PlanFormValues = {
  name: string;
  slug: string;
  sortOrder: number;
  public: boolean;
  isDefault: boolean;
  priceUsd: number;
  stripePriceId: string | null;
  affiliateL1Pct: number;
  affiliateL2Pct: number;
  affiliateL3Pct: number;
  features: PlanFeatures;
  caps: PlanCaps;
};

export type PlanFormResult =
  | { ok: true; values: PlanFormValues }
  | { ok: false; error: string };

function readString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function readCheckbox(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "1" || value === "on" || value === "true";
}

function readPct(formData: FormData, key: string): number | null {
  const raw = readString(formData, key);
  if (raw === "") {
    return 0;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return null;
  }
  return n;
}

function readSort(formData: FormData): number | null {
  const raw = readString(formData, "sortOrder");
  const n = raw === "" ? 0 : Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 9999) {
    return null;
  }
  return n;
}

function readPrice(formData: FormData): number | null {
  const raw = readString(formData, "priceUsd");
  if (raw === "") {
    return 0;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
    return null;
  }
  return Math.round(n * 100) / 100;
}

export function parsePlanForm(formData: FormData): PlanFormResult {
  const name = readString(formData, "name");
  if (name.length < 1 || name.length > PLAN_NAME_MAX) {
    return { ok: false, error: `Enter a plan name (1–${PLAN_NAME_MAX} characters).` };
  }

  const sortOrder = readSort(formData);
  if (sortOrder === null) {
    return { ok: false, error: "Sort order must be a whole number from 0 to 9999." };
  }

  const priceUsd = readPrice(formData);
  if (priceUsd === null) {
    return { ok: false, error: "Price must be zero or a positive dollar amount." };
  }

  const l1 = readPct(formData, "affiliateL1Pct");
  const l2 = readPct(formData, "affiliateL2Pct");
  const l3 = readPct(formData, "affiliateL3Pct");
  if (l1 === null || l2 === null || l3 === null) {
    return { ok: false, error: "Affiliate percents must be numbers." };
  }
  if (!affiliateRatesOk(l1, l2, l3)) {
    return {
      ok: false,
      error: `Affiliate L1–L3 must each be 0–${AFFILIATE_PCT_MAX} and cannot add up to more than ${AFFILIATE_PCT_MAX}%.`,
    };
  }
  if (l3 > 0 && AFFILIATE_LEVEL_MAX < 3) {
    return { ok: false, error: "Affiliate depth cannot exceed 3." };
  }

  const stripeRaw = readString(formData, "stripePriceId");
  const existingSlug = readString(formData, "slug");

  const features = emptyFeatures();
  for (const key of PLAN_FEATURE_KEYS) {
    features[key] = readCheckbox(formData, `feature_${key}`);
  }

  const caps = emptyCaps();
  for (const key of PLAN_CAP_KEYS) {
    const raw = readString(formData, `cap_${key}`);
    if (raw === "") {
      caps[key] = null;
      continue;
    }
    const parsed = parseCapValue(raw);
    if (parsed === null) {
      return {
        ok: false,
        error: "Caps must be empty (unlimited) or a whole number of 0 or more.",
      };
    }
    if (key === "affiliate_max_depth" && parsed > AFFILIATE_LEVEL_MAX) {
      return { ok: false, error: "Affiliate earn depth cannot be more than 3." };
    }
    caps[key] = parsed;
  }

  return {
    ok: true,
    values: {
      name,
      slug: existingSlug || slugifyPlanName(name),
      sortOrder,
      public: readCheckbox(formData, "public"),
      isDefault: readCheckbox(formData, "isDefault"),
      priceUsd,
      stripePriceId: stripeRaw || null,
      affiliateL1Pct: l1,
      affiliateL2Pct: l2,
      affiliateL3Pct: l3,
      features,
      caps,
    },
  };
}

export function parsePlanId(value: string): string | null {
  const id = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  return id;
}
