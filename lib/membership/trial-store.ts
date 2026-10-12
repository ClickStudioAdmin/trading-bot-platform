import { createServiceClient } from "@/lib/supabase/admin";
import {
  missingTrialGrants,
  planTrialOffers,
  type MemberTrialGrant,
  type TrialPlan,
} from "@/lib/membership/trials";

type TrialRow = {
  trial_key: string;
  started_at: string;
  ends_at: string;
};

export async function loadMemberTrialGrants(
  userId: string,
): Promise<{ ok: true; grants: MemberTrialGrant[] } | { ok: false; error: string }> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { data, error } = await supabase
    .from("member_feature_trials")
    .select("trial_key, started_at, ends_at")
    .eq("user_id", userId);
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not load feature trials." };
  }
  return {
    ok: true,
    grants: (data as TrialRow[]).map((row) => ({
      key: row.trial_key,
      startedAt: row.started_at,
      endsAt: row.ends_at,
    })),
  };
}

export async function ensureMemberTrialGrants(input: {
  userId: string;
  plan: TrialPlan;
  nowMs?: number;
}): Promise<
  | { ok: true; grants: MemberTrialGrant[]; nowMs: number }
  | { ok: false; error: string }
> {
  const loaded = await loadMemberTrialGrants(input.userId);
  if (!loaded.ok) {
    return loaded;
  }
  const nowMs = input.nowMs ?? Date.now();
  const missing = missingTrialGrants({
    offers: planTrialOffers(input.plan),
    existing: loaded.grants,
    nowMs,
  });
  if (missing.length === 0) {
    return { ok: true, grants: loaded.grants, nowMs };
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase.from("member_feature_trials").insert(
    missing.map((grant) => ({
      user_id: input.userId,
      trial_key: grant.key,
      started_at: grant.startedAt,
      ends_at: grant.endsAt,
    })),
  );
  if (error) {
    const again = await loadMemberTrialGrants(input.userId);
    if (again.ok) {
      return { ok: true, grants: again.grants, nowMs };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, grants: [...loaded.grants, ...missing], nowMs };
}
