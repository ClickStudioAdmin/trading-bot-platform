import { createServiceClient } from "@/lib/supabase/admin";
import {
  DEFAULT_COPY_MIN_ACTIVITY_DAYS,
  parseCopyFollowerLimits,
  parseCopyMinActivityDays,
  type CopyPlatformSettings,
} from "./model";

const EMPTY_SETTINGS: CopyPlatformSettings = {
  minActivityDays: DEFAULT_COPY_MIN_ACTIVITY_DAYS,
  maxFollowersDefault: null,
  maxFollowersCeiling: null,
};

export async function loadCopyPlatformSettings(): Promise<CopyPlatformSettings> {
  const supabase = createServiceClient();
  if (!supabase) {
    return EMPTY_SETTINGS;
  }
  const { data, error } = await supabase
    .from("platform_settings")
    .select(
      "copy_min_activity_days, copy_max_followers_default, copy_max_followers_ceiling",
    )
    .eq("id", "tbp")
    .maybeSingle();
  if (error || !data) {
    return EMPTY_SETTINGS;
  }
  const days = parseCopyMinActivityDays(
    (data as { copy_min_activity_days?: unknown }).copy_min_activity_days,
  );
  const limits = parseCopyFollowerLimits({
    defaultValue: (data as { copy_max_followers_default?: unknown })
      .copy_max_followers_default,
    ceiling: (data as { copy_max_followers_ceiling?: unknown })
      .copy_max_followers_ceiling,
  });
  return {
    minActivityDays: days.ok ? days.days : DEFAULT_COPY_MIN_ACTIVITY_DAYS,
    maxFollowersDefault: limits.ok ? limits.maxFollowersDefault : null,
    maxFollowersCeiling: limits.ok ? limits.maxFollowersCeiling : null,
  };
}

export async function loadCopyMinActivityDays(): Promise<number> {
  const settings = await loadCopyPlatformSettings();
  return settings.minActivityDays;
}

export async function saveCopyPlatformSettings(input: {
  minActivityDays: number;
  maxFollowersDefault: number | null;
  maxFollowersCeiling: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const days = parseCopyMinActivityDays(input.minActivityDays);
  if (!days.ok) {
    return days;
  }
  const limits = parseCopyFollowerLimits({
    defaultValue: input.maxFollowersDefault,
    ceiling: input.maxFollowersCeiling,
  });
  if (!limits.ok) {
    return limits;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase.from("platform_settings").upsert({
    id: "tbp",
    copy_min_activity_days: days.days,
    copy_max_followers_default: limits.maxFollowersDefault,
    copy_max_followers_ceiling: limits.maxFollowersCeiling,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return { ok: false, error: "Could not save copy settings." };
  }
  return { ok: true };
}

export async function saveCopyMinActivityDays(
  days: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await loadCopyPlatformSettings();
  return saveCopyPlatformSettings({
    minActivityDays: days,
    maxFollowersDefault: current.maxFollowersDefault,
    maxFollowersCeiling: current.maxFollowersCeiling,
  });
}
