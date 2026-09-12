import { createServiceClient } from "@/lib/supabase/admin";
import {
  canArchivePlan,
  canDeletePlan,
  parseCaps,
  parseFeatures,
  parsePlanVisibility,
  slugifyPlanName,
  type MembershipPlan,
} from "./catalog";
import { clonePlanValues, type PlanFormValues } from "./form";

type PlanRow = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  public: boolean;
  visibility?: string | null;
  preview?: boolean | null;
  archived_at: string | null;
  is_default: boolean;
  price_usd: number | string;
  stripe_price_id: string | null;
  affiliate_l1_pct: number | string;
  affiliate_l2_pct: number | string;
  affiliate_l3_pct: number | string;
  affiliate_l4_pct: number | string;
  affiliate_l5_pct: number | string;
  features: unknown;
  caps: unknown;
  created_at: string;
  updated_at: string;
  member_count?: number | string | null;
};

const PLAN_COLUMNS =
  "id, slug, name, sort_order, public, visibility, preview, archived_at, is_default, price_usd, stripe_price_id, affiliate_l1_pct, affiliate_l2_pct, affiliate_l3_pct, affiliate_l4_pct, affiliate_l5_pct, features, caps, created_at, updated_at";

function asNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function mapPlan(row: PlanRow, memberCount = 0): MembershipPlan {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sortOrder: row.sort_order,
    visibility:
      parsePlanVisibility(row.visibility) ??
      (row.public ? "public" : "private"),
    preview: row.preview === true,
    archivedAt: row.archived_at,
    isDefault: row.is_default,
    priceUsd: asNumber(row.price_usd),
    stripePriceId: row.stripe_price_id,
    affiliateL1Pct: asNumber(row.affiliate_l1_pct),
    affiliateL2Pct: asNumber(row.affiliate_l2_pct),
    affiliateL3Pct: asNumber(row.affiliate_l3_pct),
    affiliateL4Pct: asNumber(row.affiliate_l4_pct ?? 0),
    affiliateL5Pct: asNumber(row.affiliate_l5_pct ?? 0),
    features: parseFeatures(row.features),
    caps: parseCaps(row.caps),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memberCount,
  };
}

async function memberCounts(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  ids: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ids.length === 0) {
    return counts;
  }
  const { data } = await supabase
    .from("members")
    .select("plan_id")
    .in("plan_id", ids);
  for (const row of data ?? []) {
    const id = String((row as { plan_id?: unknown }).plan_id ?? "");
    if (!id) {
      continue;
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export async function listMembershipPlans(): Promise<
  { ok: true; plans: MembershipPlan[] } | { ok: false; error: string }
> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data, error } = await supabase
    .from("membership_plans")
    .select(PLAN_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not load plans." };
  }
  const rows = data as PlanRow[];
  const counts = await memberCounts(
    supabase,
    rows.map((row) => row.id),
  );
  return {
    ok: true,
    plans: rows.map((row) => mapPlan(row, counts.get(row.id) ?? 0)),
  };
}

export async function getMembershipPlan(
  id: string,
): Promise<
  { ok: true; plan: MembershipPlan } | { ok: false; error: string }
> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data, error } = await supabase
    .from("membership_plans")
    .select(PLAN_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Plan not found." };
  }
  const row = data as PlanRow;
  const counts = await memberCounts(supabase, [row.id]);
  return { ok: true, plan: mapPlan(row, counts.get(row.id) ?? 0) };
}

export async function getMembershipPlanByStripePriceId(
  stripePriceId: string,
): Promise<MembershipPlan | null> {
  const supabase = createServiceClient();
  if (!supabase || !stripePriceId) {
    return null;
  }
  const { data } = await supabase
    .from("membership_plans")
    .select(PLAN_COLUMNS)
    .eq("stripe_price_id", stripePriceId)
    .maybeSingle();
  if (!data) {
    return null;
  }
  return mapPlan(data as PlanRow);
}

export async function getDefaultMembershipPlan(): Promise<MembershipPlan | null> {
  const listed = await listMembershipPlans();
  if (!listed.ok) {
    return null;
  }
  return listed.plans.find((plan) => plan.isDefault) ?? null;
}

export async function getMemberPlanId(
  userId: string,
): Promise<string | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data } = await supabase
    .from("members")
    .select("plan_id")
    .eq("user_id", userId)
    .maybeSingle();
  const id = (data as { plan_id?: unknown } | null)?.plan_id;
  return typeof id === "string" ? id : null;
}

export async function getMemberPaySubscriptionFromAffiliate(
  userId: string,
): Promise<boolean> {
  const supabase = createServiceClient();
  if (!supabase) {
    return false;
  }
  const { data } = await supabase
    .from("members")
    .select("pay_subscription_from_affiliate")
    .eq("user_id", userId)
    .maybeSingle();
  return (
    (data as { pay_subscription_from_affiliate?: unknown } | null)
      ?.pay_subscription_from_affiliate === true
  );
}

async function nextUniqueSlug(
  supabase: NonNullable<ReturnType<typeof createServiceClient>>,
  name: string,
): Promise<string> {
  const base = slugifyPlanName(name);
  for (let i = 0; i < 20; i += 1) {
    const slug = i === 0 ? base : `${base}-${i + 1}`.slice(0, 40);
    const { data } = await supabase
      .from("membership_plans")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    const existing = data as { id?: string } | null;
    if (!existing?.id) {
      return slug;
    }
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 40);
}

export async function saveMembershipPlan(input: {
  id?: string;
  values: PlanFormValues;
}): Promise<
  { ok: true; id: string } | { ok: false; error: string }
> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }

  if (input.values.isDefault && input.values.visibility === "draft") {
    return { ok: false, error: "The default plan cannot be a draft." };
  }

  if (input.id) {
    const existing = await getMembershipPlan(input.id);
    if (!existing.ok) {
      return existing;
    }
    if (existing.plan.isDefault && !input.values.isDefault) {
      return { ok: false, error: "Set another plan as the default first." };
    }
  }

  if (input.values.isDefault) {
    const { error: clearError } = await supabase
      .from("membership_plans")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("is_default", true)
      .neq("id", input.id ?? "00000000-0000-0000-0000-000000000000");
    if (clearError) {
      return { ok: false, error: clearError.message };
    }
  }

  const now = new Date().toISOString();
  const slug = input.id
    ? input.values.slug
    : await nextUniqueSlug(supabase, input.values.name);

  const payload = {
    slug,
    name: input.values.name,
    sort_order: input.values.sortOrder,
    public: input.values.visibility === "public",
    visibility: input.values.visibility,
    preview: input.values.preview,
    is_default: input.values.isDefault,
    price_usd: input.values.priceUsd,
    stripe_price_id: input.values.stripePriceId,
    affiliate_l1_pct: input.values.affiliateL1Pct,
    affiliate_l2_pct: input.values.affiliateL2Pct,
    affiliate_l3_pct: input.values.affiliateL3Pct,
    affiliate_l4_pct: input.values.affiliateL4Pct,
    affiliate_l5_pct: input.values.affiliateL5Pct,
    features: input.values.features,
    caps: input.values.caps,
    updated_at: now,
  };

  if (input.id) {
    const { error } = await supabase
      .from("membership_plans")
      .update(payload)
      .eq("id", input.id);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabase
    .from("membership_plans")
    .insert({ ...payload, created_at: now })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create plan." };
  }
  return { ok: true, id: String((data as { id: string }).id) };
}

export async function cloneMembershipPlan(
  id: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const existing = await getMembershipPlan(id);
  if (!existing.ok) {
    return existing;
  }
  return saveMembershipPlan({ values: clonePlanValues(existing.plan) });
}

export async function archiveMembershipPlan(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getMembershipPlan(id);
  if (!existing.ok) {
    return existing;
  }
  if (!canArchivePlan(existing.plan)) {
    return {
      ok: false,
      error: existing.plan.isDefault
        ? "The default plan cannot be archived."
        : "This plan is already archived.",
    };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase
    .from("membership_plans")
    .update({
      archived_at: new Date().toISOString(),
      public: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function unarchiveMembershipPlan(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase
    .from("membership_plans")
    .update({
      archived_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteMembershipPlan(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await getMembershipPlan(id);
  if (!existing.ok) {
    return existing;
  }
  if (!canDeletePlan(existing.plan)) {
    return {
      ok: false,
      error: "This plan cannot be deleted. Archive it instead.",
    };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase.from("membership_plans").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
