import { createServiceClient } from "@/lib/supabase/admin";
import {
  DEFAULT_COPY_MIN_ACTIVITY_DAYS,
  parseCopyMinActivityDays,
} from "./model";

export async function loadCopyMinActivityDays(): Promise<number> {
  const supabase = createServiceClient();
  if (!supabase) {
    return DEFAULT_COPY_MIN_ACTIVITY_DAYS;
  }
  const { data, error } = await supabase
    .from("platform_settings")
    .select("copy_min_activity_days")
    .eq("id", "tbp")
    .maybeSingle();
  if (error || !data) {
    return DEFAULT_COPY_MIN_ACTIVITY_DAYS;
  }
  const parsed = parseCopyMinActivityDays(
    (data as { copy_min_activity_days?: unknown }).copy_min_activity_days,
  );
  return parsed.ok ? parsed.days : DEFAULT_COPY_MIN_ACTIVITY_DAYS;
}

export async function saveCopyMinActivityDays(
  days: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = parseCopyMinActivityDays(days);
  if (!parsed.ok) {
    return parsed;
  }
  const supabase = createServiceClient();
  if (!supabase) {
    return { ok: false, error: "Database is not configured." };
  }
  const { error } = await supabase.from("platform_settings").upsert({
    id: "tbp",
    copy_min_activity_days: parsed.days,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return { ok: false, error: "Could not save copy settings." };
  }
  return { ok: true };
}
