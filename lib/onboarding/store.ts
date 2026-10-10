import { createServiceClient } from "@/lib/supabase/admin";
import {
  emptySetupDraft,
  parseSetupDraft,
  type OnboardingStatus,
  type OnboardingTour,
  type SetupDraft,
  type SetupSummary,
} from "@/lib/onboarding/model";

export type MemberOnboarding = {
  userId: string;
  status: OnboardingStatus;
  draft: SetupDraft;
  createdAccountIds: string[];
  appliedTemplateKeys: string[];
  tour: OnboardingTour | null;
  tourStep: number;
  updatedAtMs: number;
};

const STALE_FINISH_MS = 120_000;

function parseStatus(value: unknown): OnboardingStatus {
  if (
    value === "finishing" ||
    value === "skipped" ||
    value === "completed"
  ) {
    return value;
  }
  return "pending";
}

function parseTour(value: unknown): OnboardingTour | null {
  if (
    value === "declined" ||
    value === "in_progress" ||
    value === "completed" ||
    value === "skipped"
  ) {
    return value;
  }
  return null;
}

function parseRow(row: Record<string, unknown>): MemberOnboarding {
  const parsed = parseSetupDraft(row.draft);
  const draft = parsed.ok ? parsed.draft : emptySetupDraft();
  const created = Array.isArray(row.created_account_ids)
    ? row.created_account_ids.map((id) => String(id))
    : [];
  const applied = Array.isArray(row.applied_template_keys)
    ? row.applied_template_keys.map((id) => String(id))
    : [];
  const mergedApplied = [...new Set([...draft.applied, ...applied])];
  return {
    userId: String(row.user_id),
    status: parseStatus(row.status),
    draft: { ...draft, applied: mergedApplied },
    createdAccountIds: created,
    appliedTemplateKeys: mergedApplied,
    tour: parseTour(row.tour),
    tourStep: Number(row.tour_step) || 0,
    updatedAtMs: Date.parse(String(row.updated_at ?? "")) || 0,
  };
}

export async function loadMemberOnboarding(
  userId: string,
): Promise<MemberOnboarding | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("member_onboarding")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return parseRow(data as Record<string, unknown>);
}

async function writeRow(
  userId: string,
  patch: Record<string, unknown>,
): Promise<MemberOnboarding | null> {
  const supabase = createServiceClient();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("member_onboarding")
    .upsert(
      {
        user_id: userId,
        updated_at: new Date().toISOString(),
        ...patch,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (error || !data) {
    return null;
  }
  return parseRow(data as Record<string, unknown>);
}

export async function saveOnboardingDraft(
  userId: string,
  draft: SetupDraft,
): Promise<MemberOnboarding | null> {
  const existing = await loadMemberOnboarding(userId);
  if (
    existing &&
    existing.status !== "pending" &&
    existing.status !== "finishing"
  ) {
    return existing;
  }
  return writeRow(userId, {
    status: "pending",
    draft,
    created_account_ids: draft.desks
      .map((desk) => desk.accountId)
      .filter((id): id is string => Boolean(id)),
    applied_template_keys: draft.applied,
  });
}

export async function skipMemberOnboarding(
  userId: string,
): Promise<MemberOnboarding | null> {
  const existing = await loadMemberOnboarding(userId);
  if (
    existing &&
    existing.status !== "pending" &&
    existing.status !== "finishing"
  ) {
    return existing;
  }
  return writeRow(userId, {
    status: "skipped",
    draft: null,
  });
}

export async function skipOnboardingForExternalDesk(
  userId: string,
): Promise<void> {
  const existing = await loadMemberOnboarding(userId);
  if (existing && existing.status !== "pending") {
    return;
  }
  await writeRow(userId, {
    status: "skipped",
    draft: null,
  });
}

export async function claimOnboardingFinish(
  userId: string,
): Promise<
  | { ok: true; row: MemberOnboarding }
  | { ok: false; error: string; done: boolean }
> {
  const existing = await loadMemberOnboarding(userId);
  if (existing?.status === "completed") {
    return { ok: false, error: "Setup is already finished.", done: true };
  }
  if (existing?.status === "skipped") {
    return { ok: false, error: "Setup was skipped.", done: true };
  }
  if (
    existing?.status === "finishing" &&
    Date.now() - existing.updatedAtMs < STALE_FINISH_MS
  ) {
    return {
      ok: false,
      error: "Setup is already finishing. Refresh in a moment.",
      done: false,
    };
  }
  const row = await writeRow(userId, {
    status: "finishing",
    draft: existing?.draft ?? emptySetupDraft(),
    created_account_ids: existing?.createdAccountIds ?? [],
    applied_template_keys: existing?.appliedTemplateKeys ?? [],
    tour: existing?.tour ?? null,
    tour_step: existing?.tourStep ?? 0,
  });
  if (!row) {
    return { ok: false, error: "Could not save setup.", done: false };
  }
  return { ok: true, row };
}

export async function saveOnboardingProgress(input: {
  userId: string;
  draft: SetupDraft;
}): Promise<MemberOnboarding | null> {
  return writeRow(input.userId, {
    status: "finishing",
    draft: input.draft,
    created_account_ids: input.draft.desks
      .map((desk) => desk.accountId)
      .filter((id): id is string => Boolean(id)),
    applied_template_keys: input.draft.applied,
  });
}

export async function completeMemberOnboarding(input: {
  userId: string;
  summary: SetupSummary;
  tour: OnboardingTour;
  createdAccountIds: string[];
  applied: string[];
}): Promise<MemberOnboarding | null> {
  const draft: SetupDraft = {
    desks: [],
    deskChoice: null,
    botChoice: null,
    tourChoice: input.tour === "in_progress" ? "yes" : "not_now",
    applied: input.applied,
    summary: input.summary,
    readyForTour: false,
  };
  return writeRow(input.userId, {
    status: "completed",
    draft,
    created_account_ids: input.createdAccountIds,
    applied_template_keys: input.applied,
    tour: input.tour,
    tour_step: 0,
  });
}

export async function dismissOnboardingSummary(
  userId: string,
): Promise<void> {
  const existing = await loadMemberOnboarding(userId);
  if (!existing?.draft.summary) {
    return;
  }
  await writeRow(userId, {
    status: existing.status,
    draft: {
      ...existing.draft,
      summary: { ...existing.draft.summary, dismissed: true },
    },
    tour: existing.tour,
    tour_step: existing.tourStep,
  });
}

export async function setOnboardingTour(input: {
  userId: string;
  tour: OnboardingTour;
  tourStep: number;
}): Promise<void> {
  const existing = await loadMemberOnboarding(input.userId);
  await writeRow(input.userId, {
    status: existing?.status ?? "completed",
    draft: existing?.draft ?? emptySetupDraft(),
    tour: input.tour,
    tour_step: input.tourStep,
    created_account_ids: existing?.createdAccountIds ?? [],
    applied_template_keys: existing?.appliedTemplateKeys ?? [],
  });
}
