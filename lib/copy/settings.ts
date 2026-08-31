import { createServiceClient } from "@/lib/supabase/admin";
import {
  DEFAULT_COPY_MIN_ACTIVITY_DAYS,
  parseCopyMaxFollowers,
  parseCopyMinActivityDays,
  type CopyPlatformSettings,
} from "./model";

const EMPTY_SETTINGS: CopyPlatformSettings = {
  minActivityDays: DEFAULT_COPY_MIN_ACTIVITY_DAYS,
  maxFollowersDefault: null,
};

export async function loadCopyPlatformSettings(): Promise<CopyPlatformSettings> {
  const supabase = createServiceClient();
  if (!supabase) {
    return EMPTY_SETTINGS;
  }
  const { data, error } = await supabase
    .from("platform_settings")
    .select("copy_min_activity_days, copy_max_followers_default")
    .eq("id", "tbp")
    .maybeSingle();
  if (error || !data) {
    return EMPTY_SETTINGS;
  }
  const days = parseCopyMinActivityDays(
    (data as { copy_min_activity_days?: unknown }).copy_min_activity_days,
  );
  const cap = parseCopyMaxFollowers(
    (data as { copy_max_followers_default?: unknown }).copy_max_followers_default,
  );
  return {
    minActivityDays: days.ok ? days.days : DEFAULT_COPY_MIN_ACTIVITY_DAYS,
    maxFollowersDefault: cap.ok ? cap.maxFollowers : null,
  };
}

export async function loadCopyMinActivityDays(): Promise<number> {
  const settings = await loadCopyPlatformSettings();
  return settings.minActivityDays;
}

export async function saveCopyPlatformSettings(input: {
  minActivityDays: number;
  maxFollowersDefault: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const days = parseCopyMinActivityDays(input.minActivityDays);
  if (!days.ok) {
    return days;
  }
  const cap = parseCopyMaxFollowers(input.maxFollowersDefault);
  if (!cap.ok) {
    return cap;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase.from("platform_settings").upsert({
    id: "tbp",
    copy_min_activity_days: days.days,
    copy_max_followers_default: cap.maxFollowers,
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
  });
}
